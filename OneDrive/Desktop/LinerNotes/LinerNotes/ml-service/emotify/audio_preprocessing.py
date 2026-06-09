"""
Audio preprocessing for Emotify.

Converts raw audio files to log-mel-spectrograms for model input.
"""

import numpy as np
import librosa
from pathlib import Path
from typing import Union, Optional


# Audio configuration constants
SAMPLE_RATE = 22050
DURATION = 30.0  # seconds
N_MELS = 128
N_FFT = 2048
HOP_LENGTH = 512


def audio_to_logmel(
    audio_path: Union[str, Path],
    sr: int = SAMPLE_RATE,
    duration: float = DURATION,
    n_mels: int = N_MELS,
    n_fft: int = N_FFT,
    hop_length: int = HOP_LENGTH,
    target_length: Optional[int] = None
) -> np.ndarray:
    """
    Convert an audio file to a log-mel-spectrogram.

    This is the canonical preprocessing function for Emotify. All audio
    inputs go through this pipeline before being fed to the model.

    Parameters
    ----------
    audio_path : str or Path
        Path to the audio file (MP3, WAV, etc.)
    sr : int, default=22050
        Target sample rate
    duration : float, default=30.0
        Target duration in seconds. Audio is padded/looped if shorter,
        truncated if longer
    n_mels : int, default=128
        Number of mel frequency bands
    n_fft : int, default=2048
        FFT window size
    hop_length : int, default=512
        Number of samples between successive frames
    target_length : int, optional
        Exact number of time frames. If provided, spectrogram is padded
        or truncated to this length. Otherwise, length is determined by
        the duration parameter.

    Returns
    -------
    np.ndarray
        Log-mel-spectrogram of shape (n_mels, time_frames)
        Normalized to have zero mean and unit variance

    Examples
    --------
    >>> logmel = audio_to_logmel('preview.mp3')
    >>> logmel.shape
    (128, 1292)  # 30s at 22050 Hz with hop_length=512
    """
    # Load audio
    # librosa automatically resamples to target sr
    y, sr_loaded = librosa.load(audio_path, sr=sr, mono=True, duration=None)

    # Calculate target number of samples
    target_samples = int(sr * duration)

    # Pad or loop if shorter than target duration
    if len(y) < target_samples:
        # Loop the audio to reach target length
        repeats = int(np.ceil(target_samples / len(y)))
        y = np.tile(y, repeats)[:target_samples]
    # Truncate if longer
    elif len(y) > target_samples:
        y = y[:target_samples]

    # Compute mel-spectrogram
    mel_spec = librosa.feature.melspectrogram(
        y=y,
        sr=sr,
        n_mels=n_mels,
        n_fft=n_fft,
        hop_length=hop_length,
        power=2.0  # Use power spectrogram
    )

    # Convert to log scale (dB)
    log_mel_spec = librosa.power_to_db(mel_spec, ref=np.max)

    # Handle target_length if specified
    if target_length is not None:
        current_length = log_mel_spec.shape[1]
        if current_length < target_length:
            # Pad with minimum value
            pad_width = target_length - current_length
            log_mel_spec = np.pad(
                log_mel_spec,
                ((0, 0), (0, pad_width)),
                mode='constant',
                constant_values=log_mel_spec.min()
            )
        elif current_length > target_length:
            # Truncate
            log_mel_spec = log_mel_spec[:, :target_length]

    # Normalize: zero mean, unit variance
    # Add small epsilon to avoid division by zero
    mean = np.mean(log_mel_spec)
    std = np.std(log_mel_spec)
    log_mel_spec = (log_mel_spec - mean) / (std + 1e-8)

    return log_mel_spec


def logmel_to_openl3_format(logmel: np.ndarray) -> np.ndarray:
    """
    Convert log-mel-spectrogram to OpenL3 input format.

    OpenL3 expects input of shape (batch, 1, time, freq) for audio mode.

    Parameters
    ----------
    logmel : np.ndarray
        Log-mel-spectrogram of shape (n_mels, time)

    Returns
    -------
    np.ndarray
        Formatted spectrogram of shape (1, 1, time, n_mels)
    """
    # OpenL3 expects (batch, channels, time, freq)
    # Our logmel is (freq, time), so transpose and add batch/channel dims
    formatted = logmel.T[np.newaxis, np.newaxis, :, :]
    return formatted


def batch_audio_to_logmel(
    audio_paths: list[Union[str, Path]],
    **kwargs
) -> np.ndarray:
    """
    Convert multiple audio files to log-mel-spectrograms.

    Parameters
    ----------
    audio_paths : list of str or Path
        List of audio file paths
    **kwargs
        Additional arguments passed to audio_to_logmel

    Returns
    -------
    np.ndarray
        Batch of log-mel-spectrograms, shape (batch_size, n_mels, time)
    """
    logmels = []
    for path in audio_paths:
        try:
            logmel = audio_to_logmel(path, **kwargs)
            logmels.append(logmel)
        except Exception as e:
            print(f"Warning: Failed to process {path}: {e}")
            # Skip failed files
            continue

    if not logmels:
        raise ValueError("No audio files successfully processed")

    return np.array(logmels)


def estimate_spectrogram_length(
    duration: float = DURATION,
    sr: int = SAMPLE_RATE,
    hop_length: int = HOP_LENGTH
) -> int:
    """
    Estimate the number of time frames in a spectrogram.

    Useful for pre-allocating arrays or verifying output shapes.

    Parameters
    ----------
    duration : float
        Audio duration in seconds
    sr : int
        Sample rate
    hop_length : int
        Hop length between frames

    Returns
    -------
    int
        Estimated number of time frames
    """
    n_samples = int(sr * duration)
    n_frames = 1 + n_samples // hop_length
    return n_frames


if __name__ == "__main__":
    # Test the preprocessing pipeline
    import sys

    if len(sys.argv) > 1:
        test_file = sys.argv[1]
        print(f"Testing audio preprocessing on: {test_file}")

        logmel = audio_to_logmel(test_file)
        print(f"Log-mel-spectrogram shape: {logmel.shape}")
        print(f"Value range: [{logmel.min():.2f}, {logmel.max():.2f}]")
        print(f"Mean: {logmel.mean():.2f}, Std: {logmel.std():.2f}")

        # Test OpenL3 formatting
        formatted = logmel_to_openl3_format(logmel)
        print(f"OpenL3 formatted shape: {formatted.shape}")
    else:
        print("Usage: python audio_preprocessing.py <audio_file>")
        print(f"Expected spectrogram length for {DURATION}s audio: {estimate_spectrogram_length()} frames")

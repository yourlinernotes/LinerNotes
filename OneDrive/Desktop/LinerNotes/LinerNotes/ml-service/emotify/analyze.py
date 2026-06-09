"""
Emotify analyze() function - the main inference interface.

This is the deliverable from the Emotify rebuild spec. Given an audio file,
returns: {valence, arousal, genre, genre_probs, embedding}

No network calls, no Spotify dependency - fully self-contained.
"""

import numpy as np
from pathlib import Path
from typing import Union, Dict, Optional, List
import json

from .audio_preprocessing import audio_to_logmel
from .trunk import AudioTrunk
from .heads import EmotifyHeads


class EmotifyModel:
    """
    Complete Emotify model for inference.

    Combines frozen trunk + three heads to analyze audio files and return
    emotion + genre predictions + rich embeddings.

    Parameters
    ----------
    trunk_type : str, default='openl3'
        Which pretrained trunk to use ('openl3' or 'panns')
    model_dir : Path, optional
        Directory containing saved head weights and genre labels
    genre_labels : list of str, optional
        List of genre labels in order. Required if model_dir not provided.
    """

    def __init__(
        self,
        trunk_type: str = 'openl3',
        model_dir: Optional[Path] = None,
        genre_labels: Optional[List[str]] = None
    ):
        self.trunk_type = trunk_type

        # Load trunk
        self.trunk = AudioTrunk(trunk_type=trunk_type, freeze=True)
        embedding_dim = self.trunk.get_embedding_dim()

        # Load genre labels
        if model_dir is not None:
            model_dir = Path(model_dir)
            with open(model_dir / 'genre_labels.json', 'r') as f:
                self.genre_labels = json.load(f)
        elif genre_labels is not None:
            self.genre_labels = genre_labels
        else:
            raise ValueError("Must provide either model_dir or genre_labels")

        self.num_genres = len(self.genre_labels)

        # Build heads
        self.heads = EmotifyHeads(
            trunk_embedding_dim=embedding_dim,
            num_genres=self.num_genres
        )

        # Load head weights if model_dir provided
        if model_dir is not None:
            self.heads.load_weights(model_dir)
            print(f"✓ Loaded Emotify model from {model_dir}")

    def analyze_from_logmel(self, logmel: np.ndarray) -> Dict:
        """
        Analyze a log-mel-spectrogram.

        Parameters
        ----------
        logmel : np.ndarray
            Log-mel-spectrogram of shape (n_mels, time)

        Returns
        -------
        dict
            {
                'valence': float,
                'arousal': float,
                'genre': str,
                'genre_probs': dict,
                'embedding': np.ndarray
            }
        """
        # Extract trunk embedding
        embedding = self.trunk.extract_embedding(logmel)

        # Get predictions from heads
        predictions = self.heads.predict(embedding)

        # Get top genre
        genre_idx = np.argmax(predictions['genre_probs'])
        genre = self.genre_labels[genre_idx]

        # Format genre probabilities as dict
        genre_probs_dict = {
            label: float(prob)
            for label, prob in zip(self.genre_labels, predictions['genre_probs'])
        }

        return {
            'valence': predictions['valence'],
            'arousal': predictions['arousal'],
            'genre': genre,
            'genre_probs': genre_probs_dict,
            'embedding': embedding  # This is the rich representation for recommenders
        }

    def analyze_audio_file(self, audio_path: Union[str, Path]) -> Dict:
        """
        Analyze an audio file.

        This is the main entry point for Emotify inference.

        Parameters
        ----------
        audio_path : str or Path
            Path to audio file (MP3, WAV, etc.)

        Returns
        -------
        dict
            {
                'valence': float [0-1],
                'arousal': float [0-1],
                'genre': str,
                'genre_probs': {genre: probability},
                'embedding': np.ndarray (the rich track representation)
            }
        """
        # Preprocess audio to log-mel-spectrogram
        logmel = audio_to_logmel(audio_path)

        # Analyze
        return self.analyze_from_logmel(logmel)

    def save(self, save_dir: Path):
        """
        Save the complete model.

        Parameters
        ----------
        save_dir : Path
            Directory to save model components
        """
        save_dir = Path(save_dir)
        save_dir.mkdir(parents=True, exist_ok=True)

        # Save head weights
        self.heads.save_weights(save_dir)

        # Save genre labels
        with open(save_dir / 'genre_labels.json', 'w') as f:
            json.dump(self.genre_labels, f, indent=2)

        # Save config
        config = {
            'trunk_type': self.trunk_type,
            'num_genres': self.num_genres,
            'embedding_dim': self.trunk.get_embedding_dim()
        }
        with open(save_dir / 'config.json', 'w') as f:
            json.dump(config, f, indent=2)

        print(f"✓ Saved Emotify model to {save_dir}")

    @classmethod
    def load(cls, model_dir: Path) -> 'EmotifyModel':
        """
        Load a saved Emotify model.

        Parameters
        ----------
        model_dir : Path
            Directory containing saved model

        Returns
        -------
        EmotifyModel
            Loaded model ready for inference
        """
        model_dir = Path(model_dir)

        # Load config
        with open(model_dir / 'config.json', 'r') as f:
            config = json.load(f)

        # Create model
        model = cls(
            trunk_type=config['trunk_type'],
            model_dir=model_dir
        )

        return model


# Global model instance for convenience
_global_model: Optional[EmotifyModel] = None


def load_model(model_dir: Path) -> EmotifyModel:
    """
    Load the global Emotify model instance.

    Parameters
    ----------
    model_dir : Path
        Directory containing saved model

    Returns
    -------
    EmotifyModel
        Loaded model
    """
    global _global_model
    _global_model = EmotifyModel.load(model_dir)
    return _global_model


def analyze(audio_path: Union[str, Path]) -> Dict:
    """
    Analyze an audio file using the global model.

    This is the main entry point specified in the rebuild spec.
    Must call load_model() first to initialize the global model.

    Parameters
    ----------
    audio_path : str or Path
        Path to audio file (or 30s preview clip)

    Returns
    -------
    dict
        {
            'valence': float [0-1],
            'arousal': float [0-1],
            'genre': str,
            'genre_probs': {genre: probability},
            'embedding': float array (rich representation for recommendations)
        }

    Examples
    --------
    >>> from emotify import load_model, analyze
    >>> load_model('models/emotify_v2')
    >>> result = analyze('preview.mp3')
    >>> print(f"Valence: {result['valence']:.2f}, Genre: {result['genre']}")
    """
    global _global_model

    if _global_model is None:
        raise RuntimeError(
            "No model loaded. Call load_model(model_dir) first."
        )

    return _global_model.analyze_audio_file(audio_path)


def analyze_batch(audio_paths: List[Union[str, Path]]) -> List[Dict]:
    """
    Analyze multiple audio files in batch.

    More efficient than calling analyze() in a loop because trunk
    embeddings are extracted in batches.

    Parameters
    ----------
    audio_paths : list of str or Path
        List of audio file paths

    Returns
    -------
    list of dict
        List of analysis results, one per input file
    """
    global _global_model

    if _global_model is None:
        raise RuntimeError(
            "No model loaded. Call load_model(model_dir) first."
        )

    # Preprocess all audio files
    logmels = []
    valid_indices = []

    for i, path in enumerate(audio_paths):
        try:
            logmel = audio_to_logmel(path)
            logmels.append(logmel)
            valid_indices.append(i)
        except Exception as e:
            print(f"Warning: Failed to process {path}: {e}")

    if not logmels:
        return []

    logmels = np.array(logmels)

    # Extract embeddings in batch
    embeddings = _global_model.trunk.extract_embedding(logmels)

    # Get predictions
    results = []
    for embedding in embeddings:
        predictions = _global_model.heads.predict(embedding)

        genre_idx = np.argmax(predictions['genre_probs'])
        genre = _global_model.genre_labels[genre_idx]

        genre_probs_dict = {
            label: float(prob)
            for label, prob in zip(_global_model.genre_labels, predictions['genre_probs'])
        }

        results.append({
            'valence': predictions['valence'],
            'arousal': predictions['arousal'],
            'genre': genre,
            'genre_probs': genre_probs_dict,
            'embedding': embedding
        })

    return results


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 3:
        print("Usage: python analyze.py <model_dir> <audio_file>")
        print("\nExample:")
        print("  python analyze.py ../models/emotify_v2 preview.mp3")
        sys.exit(1)

    model_dir = Path(sys.argv[1])
    audio_file = Path(sys.argv[2])

    print(f"Loading model from {model_dir}...")
    load_model(model_dir)

    print(f"\nAnalyzing {audio_file}...")
    result = analyze(audio_file)

    print("\nResults:")
    print(f"  Valence: {result['valence']:.3f}")
    print(f"  Arousal: {result['arousal']:.3f}")
    print(f"  Genre: {result['genre']}")
    print(f"  Top 3 genres:")
    sorted_genres = sorted(
        result['genre_probs'].items(),
        key=lambda x: x[1],
        reverse=True
    )
    for genre, prob in sorted_genres[:3]:
        print(f"    {genre}: {prob:.3f}")
    print(f"  Embedding shape: {result['embedding'].shape}")

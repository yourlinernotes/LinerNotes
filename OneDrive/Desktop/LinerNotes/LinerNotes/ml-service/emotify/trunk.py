"""
Frozen pretrained audio embedding trunk for Emotify.

Supports OpenL3 and PANNs as embedding backends. The trunk is frozen
during training - only the task-specific heads are trained.
"""

import numpy as np
import tensorflow as tf
from pathlib import Path
from typing import Literal, Optional
import warnings


# Embedding dimensions for each trunk type
TRUNK_EMBEDDING_DIMS = {
    'openl3': 512,
    'panns': 2048,
}


class AudioTrunk:
    """
    Frozen pretrained audio embedding model.

    This class wraps pretrained models (OpenL3 or PANNs) and provides
    a unified interface for extracting fixed-length embeddings from
    audio spectrograms.

    The trunk is ALWAYS frozen - gradients do not flow through it during
    head training. This allows us to:
    1. Precompute embeddings once and cache them
    2. Train heads on disjoint datasets (MUSE for emotion, FMA for genre)
    3. Get genre-aware representations for free from the pretrained model

    Parameters
    ----------
    trunk_type : {'openl3', 'panns'}
        Which pretrained model to use
    freeze : bool, default=True
        Whether to freeze the trunk (should always be True for this architecture)

    Attributes
    ----------
    embedding_dim : int
        Dimensionality of the output embedding
    model : keras.Model
        The loaded pretrained model
    """

    def __init__(
        self,
        trunk_type: Literal['openl3', 'panns'] = 'openl3',
        freeze: bool = True
    ):
        self.trunk_type = trunk_type
        self.freeze = freeze
        self.embedding_dim = TRUNK_EMBEDDING_DIMS[trunk_type]

        # Load the appropriate model
        if trunk_type == 'openl3':
            self.model = self._load_openl3()
        elif trunk_type == 'panns':
            self.model = self._load_panns()
        else:
            raise ValueError(f"Unknown trunk_type: {trunk_type}")

        # Freeze the model
        if self.freeze:
            self.model.trainable = False
            for layer in self.model.layers:
                layer.trainable = False

        print(f"✓ Loaded {trunk_type} trunk (embedding_dim={self.embedding_dim}, frozen={self.freeze})")

    def _load_openl3(self) -> tf.keras.Model:
        """
        Load OpenL3 audio embedding model.

        OpenL3 is a pretrained model for general-purpose audio embeddings.
        It's trained on AudioSet using a triplet loss objective.

        Returns
        -------
        tf.keras.Model
            The OpenL3 embedding model
        """
        try:
            import openl3
        except ImportError:
            raise ImportError(
                "OpenL3 not installed. Install with: pip install openl3"
            )

        # Load OpenL3 model
        # input_repr='mel256' means it expects mel-spectrograms
        # content_type='music' is better for music than 'env' (environmental sounds)
        # embedding_size=512 is the standard size
        model = openl3.models.load_audio_embedding_model(
            input_repr='mel256',
            content_type='music',
            embedding_size=512
        )

        return model

    def _load_panns(self) -> tf.keras.Model:
        """
        Load PANNs (Pre-trained Audio Neural Networks) embedding model.

        PANNs are trained on AudioSet and provide strong audio representations.
        They typically perform better than OpenL3 but are larger.

        Returns
        -------
        tf.keras.Model
            The PANNs embedding model
        """
        try:
            import panns_inference
            from panns_inference import AudioTagging
        except ImportError:
            raise ImportError(
                "PANNs not installed. Install with: pip install panns-inference"
            )

        # Load PANNs model
        # 'Cnn14' is a good balance of size and performance
        at = AudioTagging(checkpoint_path=None, device='cpu')

        # We'll wrap the PANNs model to extract embeddings rather than tags
        # The embedding is from the final layer before classification
        model = at.model

        # Extract the embedding layer (before final classification)
        # For Cnn14, this is typically 2048-dim
        # We'll create a wrapper that outputs embeddings instead of tags
        embedding_model = tf.keras.Model(
            inputs=model.input,
            outputs=model.layers[-2].output  # Second-to-last layer
        )

        return embedding_model

    def extract_embedding(self, logmel: np.ndarray) -> np.ndarray:
        """
        Extract embedding from a log-mel-spectrogram.

        Parameters
        ----------
        logmel : np.ndarray
            Log-mel-spectrogram of shape (n_mels, time) or (batch, n_mels, time)

        Returns
        -------
        np.ndarray
            Embedding vector(s) of shape (embedding_dim,) or (batch, embedding_dim)
        """
        # Handle single sample vs batch
        if logmel.ndim == 2:
            logmel = logmel[np.newaxis, ...]
            single_sample = True
        else:
            single_sample = False

        # Extract embeddings
        if self.trunk_type == 'openl3':
            # OpenL3 expects (batch, time, freq, channels)
            # Our logmel is (batch, freq, time)
            # Transpose and add channel dimension
            logmel_formatted = np.transpose(logmel, (0, 2, 1))[:, :, :, np.newaxis]
            embeddings = self.model.predict(logmel_formatted, verbose=0)

        elif self.trunk_type == 'panns':
            # PANNs expects (batch, freq, time)
            embeddings = self.model.predict(logmel, verbose=0)

        # Return single embedding if single sample was provided
        if single_sample:
            return embeddings[0]
        return embeddings

    def extract_and_save(
        self,
        logmels: np.ndarray,
        save_path: Path,
        batch_size: int = 32
    ) -> np.ndarray:
        """
        Extract embeddings for a large dataset and save to disk.

        This is for precomputing embeddings before head training.

        Parameters
        ----------
        logmels : np.ndarray
            Array of log-mel-spectrograms, shape (n_samples, n_mels, time)
        save_path : Path
            Where to save the embeddings (.npy file)
        batch_size : int
            Batch size for processing

        Returns
        -------
        np.ndarray
            All embeddings, shape (n_samples, embedding_dim)
        """
        n_samples = len(logmels)
        embeddings = np.zeros((n_samples, self.embedding_dim), dtype=np.float32)

        # Process in batches
        for i in range(0, n_samples, batch_size):
            batch_end = min(i + batch_size, n_samples)
            batch = logmels[i:batch_end]

            batch_embeddings = self.extract_embedding(batch)
            embeddings[i:batch_end] = batch_embeddings

            if (i // batch_size) % 10 == 0:
                print(f"  Processed {batch_end}/{n_samples} samples...")

        # Save to disk
        np.save(save_path, embeddings)
        print(f"✓ Saved {n_samples} embeddings to {save_path}")

        return embeddings

    def get_embedding_dim(self) -> int:
        """Get the dimensionality of embeddings produced by this trunk."""
        return self.embedding_dim

    def get_config(self) -> dict:
        """Get configuration for serialization."""
        return {
            'trunk_type': self.trunk_type,
            'embedding_dim': self.embedding_dim,
            'freeze': self.freeze
        }


def load_precomputed_embeddings(embeddings_path: Path) -> np.ndarray:
    """
    Load precomputed embeddings from disk.

    Parameters
    ----------
    embeddings_path : Path
        Path to .npy file containing embeddings

    Returns
    -------
    np.ndarray
        Embeddings array of shape (n_samples, embedding_dim)
    """
    if not embeddings_path.exists():
        raise FileNotFoundError(f"Embeddings file not found: {embeddings_path}")

    embeddings = np.load(embeddings_path)
    print(f"✓ Loaded {len(embeddings)} embeddings from {embeddings_path}")
    return embeddings


if __name__ == "__main__":
    # Test trunk loading and embedding extraction
    print("Testing AudioTrunk...")

    # Test OpenL3 (if available)
    try:
        trunk = AudioTrunk(trunk_type='openl3')
        print(f"OpenL3 embedding dim: {trunk.get_embedding_dim()}")

        # Test with dummy input
        dummy_logmel = np.random.randn(128, 1292)  # 30s audio
        embedding = trunk.extract_embedding(dummy_logmel)
        print(f"Embedding shape: {embedding.shape}")
        print(f"Embedding range: [{embedding.min():.3f}, {embedding.max():.3f}]")

    except Exception as e:
        print(f"OpenL3 test failed: {e}")
        print("Install with: pip install openl3")

"""
Prediction heads for the Emotify tri-head architecture.

Three separate heads train on the frozen trunk embeddings:
- Valence head: Predicts emotional valence (0-1)
- Arousal head: Predicts emotional arousal (0-1)
- Genre head: Classifies music genre (softmax over classes)
"""

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers, Model
from typing import Optional, List


def build_emotion_head(
    input_dim: int,
    head_name: str,
    hidden_units: List[int] = [128, 64],
    dropout_rate: float = 0.3,
    use_batch_norm: bool = True
) -> Model:
    """
    Build a head for emotion prediction (valence or arousal).

    Architecture: Dense → BatchNorm → Dropout → Dense → Sigmoid

    Parameters
    ----------
    input_dim : int
        Dimension of the trunk embedding
    head_name : str
        Name for the head ('valence' or 'arousal')
    hidden_units : list of int
        Number of units in each hidden layer
    dropout_rate : float
        Dropout rate for regularization
    use_batch_norm : bool
        Whether to use batch normalization

    Returns
    -------
    keras.Model
        The emotion prediction head
    """
    inputs = keras.Input(shape=(input_dim,), name=f'{head_name}_input')
    x = inputs

    # Hidden layers
    for i, units in enumerate(hidden_units):
        x = layers.Dense(units, activation='relu', name=f'{head_name}_hidden_{i+1}')(x)

        if use_batch_norm:
            x = layers.BatchNormalization(name=f'{head_name}_bn_{i+1}')(x)

        x = layers.Dropout(dropout_rate, name=f'{head_name}_dropout_{i+1}')(x)

    # Output layer: sigmoid for [0, 1] range
    output = layers.Dense(1, activation='sigmoid', name=head_name)(x)

    model = Model(inputs=inputs, outputs=output, name=f'{head_name}_head')
    return model


def build_genre_head(
    input_dim: int,
    num_genres: int,
    hidden_units: List[int] = [256, 128],
    dropout_rate: float = 0.4,
    use_batch_norm: bool = True
) -> Model:
    """
    Build a head for genre classification.

    Architecture: Dense → BatchNorm → Dropout → Dense → Softmax

    Parameters
    ----------
    input_dim : int
        Dimension of the trunk embedding
    num_genres : int
        Number of genre classes
    hidden_units : list of int
        Number of units in each hidden layer
    dropout_rate : float
        Dropout rate for regularization
    use_batch_norm : bool
        Whether to use batch normalization

    Returns
    -------
    keras.Model
        The genre classification head
    """
    inputs = keras.Input(shape=(input_dim,), name='genre_input')
    x = inputs

    # Hidden layers - genre classification benefits from more capacity
    for i, units in enumerate(hidden_units):
        x = layers.Dense(units, activation='relu', name=f'genre_hidden_{i+1}')(x)

        if use_batch_norm:
            x = layers.BatchNormalization(name=f'genre_bn_{i+1}')(x)

        x = layers.Dropout(dropout_rate, name=f'genre_dropout_{i+1}')(x)

    # Output layer: softmax for multi-class classification
    output = layers.Dense(num_genres, activation='softmax', name='genre')(x)

    model = Model(inputs=inputs, outputs=output, name='genre_head')
    return model


class EmotifyHeads:
    """
    Container for all three prediction heads.

    This class manages the valence, arousal, and genre heads as a unit,
    allowing them to be trained separately or together.

    Parameters
    ----------
    trunk_embedding_dim : int
        Dimension of embeddings from the frozen trunk
    num_genres : int
        Number of genre classes
    valence_hidden : list of int, optional
        Hidden layer sizes for valence head
    arousal_hidden : list of int, optional
        Hidden layer sizes for arousal head
    genre_hidden : list of int, optional
        Hidden layer sizes for genre head
    dropout_rate : float, default=0.3
        Dropout rate for regularization
    """

    def __init__(
        self,
        trunk_embedding_dim: int,
        num_genres: int,
        valence_hidden: Optional[List[int]] = None,
        arousal_hidden: Optional[List[int]] = None,
        genre_hidden: Optional[List[int]] = None,
        dropout_rate: float = 0.3
    ):
        self.trunk_embedding_dim = trunk_embedding_dim
        self.num_genres = num_genres

        # Default architectures
        valence_hidden = valence_hidden or [128, 64]
        arousal_hidden = arousal_hidden or [128, 64]
        genre_hidden = genre_hidden or [256, 128]

        # Build the three heads
        self.valence_head = build_emotion_head(
            trunk_embedding_dim,
            'valence',
            hidden_units=valence_hidden,
            dropout_rate=dropout_rate
        )

        self.arousal_head = build_emotion_head(
            trunk_embedding_dim,
            'arousal',
            hidden_units=arousal_hidden,
            dropout_rate=dropout_rate
        )

        self.genre_head = build_genre_head(
            trunk_embedding_dim,
            num_genres,
            hidden_units=genre_hidden,
            dropout_rate=dropout_rate
        )

        print(f"✓ Built EmotifyHeads:")
        print(f"  Valence head: {valence_hidden} → 1 (sigmoid)")
        print(f"  Arousal head: {arousal_hidden} → 1 (sigmoid)")
        print(f"  Genre head: {genre_hidden} → {num_genres} (softmax)")

    def compile_heads(
        self,
        learning_rate: float = 1e-3,
        valence_loss_weight: float = 1.0,
        arousal_loss_weight: float = 1.0,
        genre_loss_weight: float = 1.0
    ):
        """
        Compile all three heads with optimizers and losses.

        Parameters
        ----------
        learning_rate : float
            Learning rate for all heads
        valence_loss_weight : float
            Weight for valence loss in multi-task training
        arousal_loss_weight : float
            Weight for arousal loss in multi-task training
        genre_loss_weight : float
            Weight for genre loss in multi-task training
        """
        optimizer = keras.optimizers.Adam(learning_rate=learning_rate)

        # Compile valence head
        self.valence_head.compile(
            optimizer=optimizer,
            loss='mse',
            metrics=['mae']
        )

        # Compile arousal head
        self.arousal_head.compile(
            optimizer=optimizer,
            loss='mse',
            metrics=['mae']
        )

        # Compile genre head
        self.genre_head.compile(
            optimizer=optimizer,
            loss='sparse_categorical_crossentropy',
            metrics=['accuracy']
        )

        print(f"✓ Compiled heads with lr={learning_rate}")

    def train_valence_head(
        self,
        train_embeddings,
        train_labels,
        val_embeddings,
        val_labels,
        epochs: int = 100,
        batch_size: int = 32,
        callbacks: Optional[List] = None
    ):
        """Train the valence head on MUSE embeddings."""
        if callbacks is None:
            callbacks = [
                keras.callbacks.EarlyStopping(
                    monitor='val_loss',
                    patience=20,
                    restore_best_weights=True
                ),
                keras.callbacks.ReduceLROnPlateau(
                    monitor='val_loss',
                    factor=0.5,
                    patience=10,
                    min_lr=1e-6
                )
            ]

        print(f"\nTraining valence head on {len(train_embeddings)} samples...")
        history = self.valence_head.fit(
            train_embeddings,
            train_labels,
            validation_data=(val_embeddings, val_labels),
            epochs=epochs,
            batch_size=batch_size,
            callbacks=callbacks,
            verbose=1
        )
        return history

    def train_arousal_head(
        self,
        train_embeddings,
        train_labels,
        val_embeddings,
        val_labels,
        epochs: int = 100,
        batch_size: int = 32,
        callbacks: Optional[List] = None
    ):
        """Train the arousal head on MUSE embeddings."""
        if callbacks is None:
            callbacks = [
                keras.callbacks.EarlyStopping(
                    monitor='val_loss',
                    patience=20,
                    restore_best_weights=True
                ),
                keras.callbacks.ReduceLROnPlateau(
                    monitor='val_loss',
                    factor=0.5,
                    patience=10,
                    min_lr=1e-6
                )
            ]

        print(f"\nTraining arousal head on {len(train_embeddings)} samples...")
        history = self.arousal_head.fit(
            train_embeddings,
            train_labels,
            validation_data=(val_embeddings, val_labels),
            epochs=epochs,
            batch_size=batch_size,
            callbacks=callbacks,
            verbose=1
        )
        return history

    def train_genre_head(
        self,
        train_embeddings,
        train_labels,
        val_embeddings,
        val_labels,
        epochs: int = 100,
        batch_size: int = 64,
        callbacks: Optional[List] = None
    ):
        """Train the genre head on FMA embeddings."""
        if callbacks is None:
            callbacks = [
                keras.callbacks.EarlyStopping(
                    monitor='val_accuracy',
                    patience=15,
                    restore_best_weights=True,
                    mode='max'
                ),
                keras.callbacks.ReduceLROnPlateau(
                    monitor='val_loss',
                    factor=0.5,
                    patience=7,
                    min_lr=1e-6
                )
            ]

        print(f"\nTraining genre head on {len(train_embeddings)} samples...")
        history = self.genre_head.fit(
            train_embeddings,
            train_labels,
            validation_data=(val_embeddings, val_labels),
            epochs=epochs,
            batch_size=batch_size,
            callbacks=callbacks,
            verbose=1
        )
        return history

    def predict(self, embedding):
        """
        Get predictions from all three heads.

        Parameters
        ----------
        embedding : np.ndarray
            Trunk embedding, shape (trunk_embedding_dim,) or (batch, trunk_embedding_dim)

        Returns
        -------
        dict
            Dictionary with keys 'valence', 'arousal', 'genre_probs'
        """
        import numpy as np

        # Handle single embedding
        if embedding.ndim == 1:
            embedding = embedding[np.newaxis, ...]
            single = True
        else:
            single = False

        # Get predictions
        valence_pred = self.valence_head.predict(embedding, verbose=0)
        arousal_pred = self.arousal_head.predict(embedding, verbose=0)
        genre_probs = self.genre_head.predict(embedding, verbose=0)

        if single:
            return {
                'valence': float(valence_pred[0, 0]),
                'arousal': float(arousal_pred[0, 0]),
                'genre_probs': genre_probs[0]
            }
        else:
            return {
                'valence': valence_pred.flatten(),
                'arousal': arousal_pred.flatten(),
                'genre_probs': genre_probs
            }

    def save_weights(self, save_dir):
        """Save all head weights."""
        from pathlib import Path
        save_dir = Path(save_dir)
        save_dir.mkdir(parents=True, exist_ok=True)

        self.valence_head.save_weights(save_dir / 'valence_head.weights.h5')
        self.arousal_head.save_weights(save_dir / 'arousal_head.weights.h5')
        self.genre_head.save_weights(save_dir / 'genre_head.weights.h5')

        print(f"✓ Saved head weights to {save_dir}")

    def load_weights(self, save_dir):
        """Load all head weights."""
        from pathlib import Path
        save_dir = Path(save_dir)

        self.valence_head.load_weights(save_dir / 'valence_head.weights.h5')
        self.arousal_head.load_weights(save_dir / 'arousal_head.weights.h5')
        self.genre_head.load_weights(save_dir / 'genre_head.weights.h5')

        print(f"✓ Loaded head weights from {save_dir}")


if __name__ == "__main__":
    # Test head building
    print("Testing EmotifyHeads...")

    # Simulate OpenL3 embedding dim
    embedding_dim = 512
    num_genres = 10

    heads = EmotifyHeads(
        trunk_embedding_dim=embedding_dim,
        num_genres=num_genres
    )

    heads.compile_heads()

    # Test prediction with dummy embedding
    import numpy as np
    dummy_embedding = np.random.randn(embedding_dim)

    predictions = heads.predict(dummy_embedding)
    print(f"\nDummy predictions:")
    print(f"  Valence: {predictions['valence']:.3f}")
    print(f"  Arousal: {predictions['arousal']:.3f}")
    print(f"  Genre probs shape: {predictions['genre_probs'].shape}")
    print(f"  Top genre: {np.argmax(predictions['genre_probs'])}")

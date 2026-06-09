"""
Training script for Emotify tri-head model.

Trains the three heads (valence, arousal, genre) on precomputed trunk embeddings.

Usage:
    python train.py --dataset muse --head valence
    python train.py --dataset muse --head arousal
    python train.py --dataset fma --head genre
"""

import argparse
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score, accuracy_score, f1_score
import json
import matplotlib.pyplot as plt

from .trunk import AudioTrunk, load_precomputed_embeddings
from .heads import EmotifyHeads
from .audio_preprocessing import audio_to_logmel, batch_audio_to_logmel


# Paths
PROJECT_ROOT = Path(__file__).parent.parent.parent
DATA_DIR = PROJECT_ROOT / 'data'
MODELS_DIR = PROJECT_ROOT / 'ml-service' / 'models'


def precompute_embeddings_from_audio(
    audio_files: list,
    trunk_type: str = 'openl3',
    save_path: Path = None,
    batch_size: int = 8
) -> np.ndarray:
    """
    Precompute trunk embeddings from raw audio files.

    This is the slow step - only do this once per dataset.

    Parameters
    ----------
    audio_files : list of Path
        List of audio file paths
    trunk_type : str
        Trunk type ('openl3' or 'panns')
    save_path : Path, optional
        Where to save embeddings
    batch_size : int
        Batch size for processing

    Returns
    -------
    np.ndarray
        Embeddings, shape (n_files, embedding_dim)
    """
    print(f"\nPrecomputing {trunk_type} embeddings for {len(audio_files)} files...")

    trunk = AudioTrunk(trunk_type=trunk_type)

    all_embeddings = []

    for i in range(0, len(audio_files), batch_size):
        batch_files = audio_files[i:i+batch_size]

        # Process audio to log-mel-spectrograms
        try:
            logmels = batch_audio_to_logmel(batch_files)
        except Exception as e:
            print(f"Warning: Batch {i} failed: {e}")
            continue

        # Extract embeddings
        embeddings = trunk.extract_embedding(logmels)
        all_embeddings.append(embeddings)

        if (i // batch_size) % 10 == 0:
            print(f"  Processed {i + len(batch_files)}/{len(audio_files)}...")

    embeddings = np.vstack(all_embeddings)

    if save_path:
        np.save(save_path, embeddings)
        print(f"✓ Saved embeddings to {save_path}")

    return embeddings


def load_muse_data(embeddings_path: Path = None) -> tuple:
    """
    Load MUSE dataset with emotion labels.

    Returns
    -------
    tuple
        (embeddings, valence_labels, arousal_labels, metadata_df)
    """
    muse_csv = DATA_DIR / 'muse_v3.csv'

    if not muse_csv.exists():
        raise FileNotFoundError(
            f"MUSE dataset not found at {muse_csv}. "
            "Download from: https://zenodo.org/record/3989267"
        )

    print(f"\nLoading MUSE dataset from {muse_csv}...")
    df = pd.read_csv(muse_csv)

    print(f"  Loaded {len(df)} tracks")
    print(f"  Columns: {list(df.columns)}")

    # Check for required columns
    if 'valence' not in df.columns or 'arousal' not in df.columns:
        raise ValueError("MUSE dataset missing valence/arousal columns")

    # Load or precompute embeddings
    if embeddings_path and embeddings_path.exists():
        embeddings = load_precomputed_embeddings(embeddings_path)
    else:
        # If audio files are available, precompute embeddings
        audio_dir = DATA_DIR / 'muse_audio'
        if audio_dir.exists():
            audio_files = [audio_dir / f"{row['id']}.mp3" for _, row in df.iterrows()]
            embeddings = precompute_embeddings_from_audio(
                audio_files,
                save_path=embeddings_path or DATA_DIR / 'muse_embeddings.npy'
            )
        else:
            raise FileNotFoundError(
                f"Neither embeddings nor audio files found. "
                f"Expected embeddings at {embeddings_path} or audio at {audio_dir}"
            )

    valence = df['valence'].values
    arousal = df['arousal'].values

    # Normalize to [0, 1] if needed
    if valence.max() > 1.0:
        print("  Normalizing valence/arousal to [0, 1]...")
        valence = (valence - valence.min()) / (valence.max() - valence.min())
        arousal = (arousal - arousal.min()) / (arousal.max() - arousal.min())

    print(f"  Valence range: [{valence.min():.3f}, {valence.max():.3f}]")
    print(f"  Arousal range: [{arousal.min():.3f}, {arousal.max():.3f}]")

    return embeddings, valence, arousal, df


def load_fma_data(embeddings_path: Path = None, subset: str = 'medium') -> tuple:
    """
    Load FMA (Free Music Archive) dataset with genre labels.

    Parameters
    ----------
    embeddings_path : Path, optional
        Path to precomputed embeddings
    subset : str
        FMA subset ('small', 'medium', 'large')

    Returns
    -------
    tuple
        (embeddings, genre_labels, genre_names, metadata_df)
    """
    # FMA metadata
    fma_metadata = DATA_DIR / 'fma_metadata' / 'tracks.csv'

    if not fma_metadata.exists():
        raise FileNotFoundError(
            f"FMA metadata not found at {fma_metadata}. "
            "Download from: https://github.com/mdeff/fma"
        )

    print(f"\nLoading FMA {subset} dataset...")

    # Load FMA tracks metadata
    df = pd.read_csv(fma_metadata, index_col=0, header=[0, 1])

    # Filter by subset
    if subset != 'large':
        df = df[df['set', 'subset'] <= subset]

    print(f"  Loaded {len(df)} tracks")

    # Get genre labels
    # FMA has a hierarchical genre taxonomy - use top-level genres
    genres = df['track', 'genre_top'].values
    unique_genres = sorted(set(genres))
    genre_to_idx = {g: i for i, g in enumerate(unique_genres)}
    genre_labels = np.array([genre_to_idx[g] for g in genres])

    print(f"  Found {len(unique_genres)} unique genres")

    # Load or precompute embeddings
    if embeddings_path and embeddings_path.exists():
        embeddings = load_precomputed_embeddings(embeddings_path)
    else:
        # If audio files are available, precompute embeddings
        audio_dir = DATA_DIR / 'fma_medium'  # or fma_small, fma_large
        if audio_dir.exists():
            audio_files = [
                audio_dir / f"{str(idx).zfill(6)}.mp3"
                for idx in df.index
            ]
            embeddings = precompute_embeddings_from_audio(
                audio_files,
                save_path=embeddings_path or DATA_DIR / f'fma_{subset}_embeddings.npy'
            )
        else:
            raise FileNotFoundError(
                f"Neither embeddings nor audio files found. "
                f"Expected embeddings at {embeddings_path} or audio at {audio_dir}"
            )

    return embeddings, genre_labels, unique_genres, df


def train_emotion_head(
    head_name: str,
    embeddings: np.ndarray,
    labels: np.ndarray,
    trunk_dim: int,
    val_split: float = 0.15,
    test_split: float = 0.15,
    epochs: int = 100,
    batch_size: int = 32,
    save_dir: Path = None
):
    """
    Train valence or arousal head on MUSE embeddings.

    Parameters
    ----------
    head_name : str
        'valence' or 'arousal'
    embeddings : np.ndarray
        Precomputed trunk embeddings
    labels : np.ndarray
        Emotion labels [0, 1]
    trunk_dim : int
        Trunk embedding dimension
    val_split : float
        Validation set fraction
    test_split : float
        Test set fraction
    epochs : int
        Max training epochs
    batch_size : int
        Batch size
    save_dir : Path, optional
        Where to save weights

    Returns
    -------
    dict
        Training history and test metrics
    """
    print(f"\n{'='*60}")
    print(f"Training {head_name} head")
    print(f"{'='*60}")

    # Split data
    X_temp, X_test, y_temp, y_test = train_test_split(
        embeddings, labels, test_size=test_split, random_state=42
    )

    val_size = val_split / (1 - test_split)
    X_train, X_val, y_train, y_val = train_test_split(
        X_temp, y_temp, test_size=val_size, random_state=42
    )

    print(f"\nData split:")
    print(f"  Train: {len(X_train)} samples")
    print(f"  Val:   {len(X_val)} samples")
    print(f"  Test:  {len(X_test)} samples")

    # Create heads container (we only train one head, but use the container for convenience)
    heads = EmotifyHeads(trunk_embedding_dim=trunk_dim, num_genres=1)
    heads.compile_heads(learning_rate=1e-3)

    # Train the appropriate head
    if head_name == 'valence':
        history = heads.train_valence_head(
            X_train, y_train,
            X_val, y_val,
            epochs=epochs,
            batch_size=batch_size
        )
        model = heads.valence_head
    elif head_name == 'arousal':
        history = heads.train_arousal_head(
            X_train, y_train,
            X_val, y_val,
            epochs=epochs,
            batch_size=batch_size
        )
        model = heads.arousal_head
    else:
        raise ValueError(f"Unknown head: {head_name}")

    # Evaluate on test set
    print(f"\nEvaluating on test set...")
    y_pred = model.predict(X_test, verbose=0).flatten()

    mae = mean_absolute_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)

    print(f"\nTest Set Results:")
    print(f"  MAE: {mae:.4f}")
    print(f"  R²:  {r2:.4f}")

    # Save weights
    if save_dir:
        save_dir = Path(save_dir)
        save_dir.mkdir(parents=True, exist_ok=True)
        model.save_weights(save_dir / f'{head_name}_head.weights.h5')
        print(f"✓ Saved weights to {save_dir}")

    return {
        'history': history.history,
        'test_mae': float(mae),
        'test_r2': float(r2)
    }


def train_genre_head(
    embeddings: np.ndarray,
    labels: np.ndarray,
    genre_names: list,
    trunk_dim: int,
    val_split: float = 0.15,
    test_split: float = 0.15,
    epochs: int = 100,
    batch_size: int = 64,
    save_dir: Path = None
):
    """
    Train genre head on FMA embeddings.
    """
    print(f"\n{'='*60}")
    print(f"Training genre head")
    print(f"{'='*60}")

    # Split data
    X_temp, X_test, y_temp, y_test = train_test_split(
        embeddings, labels, test_size=test_split, random_state=42, stratify=labels
    )

    val_size = val_split / (1 - test_split)
    X_train, X_val, y_train, y_val = train_test_split(
        X_temp, y_temp, test_size=val_size, random_state=42, stratify=y_temp
    )

    print(f"\nData split:")
    print(f"  Train: {len(X_train)} samples")
    print(f"  Val:   {len(X_val)} samples")
    print(f"  Test:  {len(X_test)} samples")
    print(f"  Genres: {len(genre_names)}")

    # Create and train genre head
    heads = EmotifyHeads(trunk_embedding_dim=trunk_dim, num_genres=len(genre_names))
    heads.compile_heads(learning_rate=1e-3)

    history = heads.train_genre_head(
        X_train, y_train,
        X_val, y_val,
        epochs=epochs,
        batch_size=batch_size
    )

    # Evaluate on test set
    print(f"\nEvaluating on test set...")
    y_pred_probs = heads.genre_head.predict(X_test, verbose=0)
    y_pred = np.argmax(y_pred_probs, axis=1)

    accuracy = accuracy_score(y_test, y_pred)
    macro_f1 = f1_score(y_test, y_pred, average='macro')

    print(f"\nTest Set Results:")
    print(f"  Accuracy:  {accuracy:.4f}")
    print(f"  Macro F1:  {macro_f1:.4f}")

    # Save weights and genre labels
    if save_dir:
        save_dir = Path(save_dir)
        save_dir.mkdir(parents=True, exist_ok=True)

        heads.genre_head.save_weights(save_dir / 'genre_head.weights.h5')

        with open(save_dir / 'genre_labels.json', 'w') as f:
            json.dump(genre_names, f, indent=2)

        print(f"✓ Saved weights and labels to {save_dir}")

    return {
        'history': history.history,
        'test_accuracy': float(accuracy),
        'test_macro_f1': float(macro_f1)
    }


def main():
    parser = argparse.ArgumentParser(description="Train Emotify heads")
    parser.add_argument('--dataset', choices=['muse', 'fma'], required=True,
                        help="Which dataset to use")
    parser.add_argument('--head', choices=['valence', 'arousal', 'genre'], required=True,
                        help="Which head to train")
    parser.add_argument('--trunk', default='openl3', choices=['openl3', 'panns'],
                        help="Trunk type")
    parser.add_argument('--embeddings', type=Path,
                        help="Path to precomputed embeddings (optional)")
    parser.add_argument('--epochs', type=int, default=100,
                        help="Max epochs")
    parser.add_argument('--batch-size', type=int, default=32,
                        help="Batch size")
    parser.add_argument('--save-dir', type=Path, default=MODELS_DIR / 'emotify_v2',
                        help="Where to save trained weights")

    args = parser.parse_args()

    # Validate head/dataset combo
    if args.dataset == 'muse' and args.head == 'genre':
        raise ValueError("MUSE dataset doesn't have genre labels. Use FMA for genre.")
    if args.dataset == 'fma' and args.head in ['valence', 'arousal']:
        raise ValueError("FMA dataset doesn't have emotion labels. Use MUSE for valence/arousal.")

    # Load data
    if args.dataset == 'muse':
        embeddings, valence, arousal, _ = load_muse_data(args.embeddings)
        trunk_dim = embeddings.shape[1]

        if args.head == 'valence':
            train_emotion_head('valence', embeddings, valence, trunk_dim,
                               epochs=args.epochs, batch_size=args.batch_size,
                               save_dir=args.save_dir)
        elif args.head == 'arousal':
            train_emotion_head('arousal', embeddings, arousal, trunk_dim,
                               epochs=args.epochs, batch_size=args.batch_size,
                               save_dir=args.save_dir)

    elif args.dataset == 'fma':
        embeddings, labels, genre_names, _ = load_fma_data(args.embeddings)
        trunk_dim = embeddings.shape[1]

        train_genre_head(embeddings, labels, genre_names, trunk_dim,
                         epochs=args.epochs, batch_size=args.batch_size,
                         save_dir=args.save_dir)


if __name__ == "__main__":
    main()

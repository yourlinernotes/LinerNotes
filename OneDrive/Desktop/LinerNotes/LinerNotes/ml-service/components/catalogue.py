"""
Component 3: Track Catalogue

Persistent storage for analyzed track features. Keyed by ISRC (or generated ID).

CRITICAL: Features are computed ONCE per track and shared across all users.
Never compute at request time, never per-user.

Storage schema:
- track_id (ISRC or hash)
- title, artist, album (identity)
- valence, arousal, genre (for UI/display)
- audio_embedding (512 or 2048-dim)
- genre_embedding (learned or lookup)
- lyric_embedding (128-dim or None)
- track_vector (concatenated representation for recommendations)
- analyzable (bool)
- created_at, updated_at

NO RAW LYRICS STORED.
"""

import sqlite3
import numpy as np
import json
from pathlib import Path
from typing import Optional, Dict, List
from datetime import datetime
import pickle


class TrackCatalogue:
    """
    Persistent catalogue of analyzed track features.

    Uses SQLite for simplicity. For production scale, migrate to PostgreSQL.

    Parameters
    ----------
    db_path : Path
        Path to SQLite database file
    """

    def __init__(self, db_path: Path):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)

        # Initialize database
        self.conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
        self._create_tables()

        print(f"✓ Track catalogue initialized at {db_path}")

    def _create_tables(self):
        """Create database schema."""
        cursor = self.conn.cursor()

        # Main tracks table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tracks (
                track_id TEXT PRIMARY KEY,
                isrc TEXT,
                title TEXT NOT NULL,
                artist TEXT NOT NULL,
                album TEXT,
                duration_ms INTEGER,

                -- ML features
                valence REAL,
                arousal REAL,
                genre TEXT,
                genre_probs TEXT,  -- JSON dict

                -- Embeddings (stored as pickled numpy arrays)
                audio_embedding BLOB,
                genre_embedding BLOB,
                lyric_embedding BLOB,
                track_vector BLOB,  -- Concatenated representation

                -- Metadata
                has_lyrics BOOLEAN,
                analyzable BOOLEAN,
                audio_source TEXT,  -- 'itunes' or 'deezer'

                -- Timestamps
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

                -- Indices
                UNIQUE(isrc)
            )
        """)

        # Index for fast lookups
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_isrc ON tracks(isrc)
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_artist_title ON tracks(artist, title)
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_genre ON tracks(genre)
        """)

        self.conn.commit()

    def _serialize_array(self, arr: Optional[np.ndarray]) -> Optional[bytes]:
        """Serialize numpy array to bytes."""
        if arr is None:
            return None
        return pickle.dumps(arr)

    def _deserialize_array(self, data: Optional[bytes]) -> Optional[np.ndarray]:
        """Deserialize bytes to numpy array."""
        if data is None:
            return None
        return pickle.loads(data)

    def add_track(
        self,
        track_id: str,
        title: str,
        artist: str,
        valence: Optional[float] = None,
        arousal: Optional[float] = None,
        genre: Optional[str] = None,
        genre_probs: Optional[Dict] = None,
        audio_embedding: Optional[np.ndarray] = None,
        genre_embedding: Optional[np.ndarray] = None,
        lyric_embedding: Optional[np.ndarray] = None,
        isrc: Optional[str] = None,
        album: Optional[str] = None,
        duration_ms: Optional[int] = None,
        has_lyrics: bool = False,
        analyzable: bool = True,
        audio_source: Optional[str] = None
    ):
        """
        Add or update a track in the catalogue.

        Parameters
        ----------
        track_id : str
            Unique identifier (ISRC or generated hash)
        title : str
            Track title
        artist : str
            Artist name
        valence : float, optional
            Final valence (after bimodal fusion)
        arousal : float, optional
            Arousal value
        genre : str, optional
            Predicted genre
        genre_probs : dict, optional
            Genre probability distribution
        audio_embedding : np.ndarray, optional
            Embedding from Emotify trunk
        genre_embedding : np.ndarray, optional
            Dense genre embedding
        lyric_embedding : np.ndarray, optional
            SBERT lyric embedding (NOT raw text)
        isrc : str, optional
            ISRC code
        album : str, optional
            Album name
        duration_ms : int, optional
            Track duration in milliseconds
        has_lyrics : bool
            Whether lyrics were found and analyzed
        analyzable : bool
            Whether track could be analyzed
        audio_source : str, optional
            'itunes' or 'deezer'
        """
        # Build track_vector by concatenating embeddings
        track_vector = self._build_track_vector(
            audio_embedding,
            genre_embedding,
            lyric_embedding,
            valence,
            arousal
        )

        cursor = self.conn.cursor()

        cursor.execute("""
            INSERT OR REPLACE INTO tracks (
                track_id, isrc, title, artist, album, duration_ms,
                valence, arousal, genre, genre_probs,
                audio_embedding, genre_embedding, lyric_embedding, track_vector,
                has_lyrics, analyzable, audio_source,
                updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            track_id,
            isrc,
            title,
            artist,
            album,
            duration_ms,
            valence,
            arousal,
            genre,
            json.dumps(genre_probs) if genre_probs else None,
            self._serialize_array(audio_embedding),
            self._serialize_array(genre_embedding),
            self._serialize_array(lyric_embedding),
            self._serialize_array(track_vector),
            has_lyrics,
            analyzable,
            audio_source,
            datetime.now()
        ))

        self.conn.commit()

    def _build_track_vector(
        self,
        audio_embedding: Optional[np.ndarray],
        genre_embedding: Optional[np.ndarray],
        lyric_embedding: Optional[np.ndarray],
        valence: Optional[float],
        arousal: Optional[float]
    ) -> Optional[np.ndarray]:
        """
        Build the augmented track vector for recommendations.

        track_vector = concat(audio_embedding, [valence, arousal], genre_embedding, lyric_embedding)

        This is the rich representation used by recommenders.
        """
        components = []

        if audio_embedding is not None:
            components.append(audio_embedding)

        if valence is not None and arousal is not None:
            components.append(np.array([valence, arousal]))

        if genre_embedding is not None:
            components.append(genre_embedding)

        if lyric_embedding is not None:
            components.append(lyric_embedding)

        if components:
            return np.concatenate(components)
        else:
            return None

    def get_track(self, track_id: str) -> Optional[Dict]:
        """
        Get track features by ID.

        Parameters
        ----------
        track_id : str
            Track ID (ISRC or hash)

        Returns
        -------
        dict or None
            Track features, or None if not found
        """
        cursor = self.conn.cursor()

        cursor.execute("""
            SELECT * FROM tracks WHERE track_id = ?
        """, (track_id,))

        row = cursor.fetchone()

        if row is None:
            return None

        return self._row_to_dict(row, cursor.description)

    def get_track_by_isrc(self, isrc: str) -> Optional[Dict]:
        """Get track by ISRC."""
        cursor = self.conn.cursor()

        cursor.execute("""
            SELECT * FROM tracks WHERE isrc = ?
        """, (isrc,))

        row = cursor.fetchone()

        if row is None:
            return None

        return self._row_to_dict(row, cursor.description)

    def _row_to_dict(self, row, description) -> Dict:
        """Convert SQLite row to dict with deserialized arrays."""
        result = {}
        for idx, col in enumerate(description):
            col_name = col[0]
            value = row[idx]

            # Deserialize arrays
            if col_name in ['audio_embedding', 'genre_embedding', 'lyric_embedding', 'track_vector']:
                result[col_name] = self._deserialize_array(value)
            # Deserialize JSON
            elif col_name == 'genre_probs' and value:
                result[col_name] = json.loads(value)
            else:
                result[col_name] = value

        return result

    def search_by_artist_title(
        self,
        artist: str,
        title: str,
        fuzzy: bool = True
    ) -> List[Dict]:
        """
        Search tracks by artist and title.

        Parameters
        ----------
        artist : str
            Artist name
        title : str
            Track title
        fuzzy : bool
            Use LIKE for fuzzy matching

        Returns
        -------
        list of dict
            Matching tracks
        """
        cursor = self.conn.cursor()

        if fuzzy:
            cursor.execute("""
                SELECT * FROM tracks
                WHERE artist LIKE ? AND title LIKE ?
                LIMIT 10
            """, (f"%{artist}%", f"%{title}%"))
        else:
            cursor.execute("""
                SELECT * FROM tracks
                WHERE artist = ? AND title = ?
            """, (artist, title))

        rows = cursor.fetchall()
        return [self._row_to_dict(row, cursor.description) for row in rows]

    def get_tracks_by_genre(self, genre: str, limit: int = 100) -> List[Dict]:
        """Get tracks of a specific genre."""
        cursor = self.conn.cursor()

        cursor.execute("""
            SELECT * FROM tracks
            WHERE genre = ? AND analyzable = 1
            LIMIT ?
        """, (genre, limit))

        rows = cursor.fetchall()
        return [self._row_to_dict(row, cursor.description) for row in rows]

    def get_all_track_vectors(self, analyzable_only: bool = True) -> tuple:
        """
        Get all track vectors for batch recommendation processing.

        Returns
        -------
        tuple
            (track_ids, track_vectors)
        """
        cursor = self.conn.cursor()

        if analyzable_only:
            cursor.execute("""
                SELECT track_id, track_vector FROM tracks
                WHERE analyzable = 1 AND track_vector IS NOT NULL
            """)
        else:
            cursor.execute("""
                SELECT track_id, track_vector FROM tracks
                WHERE track_vector IS NOT NULL
            """)

        rows = cursor.fetchall()

        track_ids = [row[0] for row in rows]
        track_vectors = [self._deserialize_array(row[1]) for row in rows]

        return track_ids, np.array(track_vectors)

    def get_stats(self) -> Dict:
        """Get catalogue statistics."""
        cursor = self.conn.cursor()

        cursor.execute("SELECT COUNT(*) FROM tracks")
        total = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM tracks WHERE analyzable = 1")
        analyzable = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM tracks WHERE has_lyrics = 1")
        with_lyrics = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(DISTINCT genre) FROM tracks WHERE genre IS NOT NULL")
        unique_genres = cursor.fetchone()[0]

        return {
            'total_tracks': total,
            'analyzable_tracks': analyzable,
            'tracks_with_lyrics': with_lyrics,
            'unique_genres': unique_genres,
            'analyzable_rate': analyzable / total if total > 0 else 0,
            'lyrics_rate': with_lyrics / analyzable if analyzable > 0 else 0
        }

    def close(self):
        """Close database connection."""
        self.conn.close()


if __name__ == "__main__":
    # Test catalogue
    import tempfile

    with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as f:
        test_db = Path(f.name)

    print(f"Creating test catalogue at {test_db}")

    catalogue = TrackCatalogue(test_db)

    # Add test track
    test_audio_emb = np.random.randn(512)
    test_genre_emb = np.random.randn(64)
    test_lyric_emb = np.random.randn(128)

    catalogue.add_track(
        track_id="TEST001",
        isrc="USRC12345678",
        title="Test Song",
        artist="Test Artist",
        album="Test Album",
        valence=0.75,
        arousal=0.60,
        genre="pop",
        genre_probs={"pop": 0.8, "rock": 0.15, "electronic": 0.05},
        audio_embedding=test_audio_emb,
        genre_embedding=test_genre_emb,
        lyric_embedding=test_lyric_emb,
        has_lyrics=True,
        analyzable=True,
        audio_source="itunes"
    )

    print("✓ Added test track")

    # Retrieve track
    track = catalogue.get_track("TEST001")
    print(f"\n✓ Retrieved track: {track['artist']} - {track['title']}")
    print(f"  Valence: {track['valence']:.2f}")
    print(f"  Genre: {track['genre']}")
    print(f"  Track vector shape: {track['track_vector'].shape}")

    # Get stats
    stats = catalogue.get_stats()
    print(f"\nCatalogue stats:")
    print(f"  Total tracks: {stats['total_tracks']}")
    print(f"  Analyzable: {stats['analyzable_tracks']}")
    print(f"  With lyrics: {stats['tracks_with_lyrics']}")

    catalogue.close()

    # Verify no raw lyrics stored
    import sqlite3
    conn = sqlite3.connect(str(test_db))
    cursor = conn.cursor()

    cursor.execute("PRAGMA table_info(tracks)")
    columns = [row[1] for row in cursor.fetchall()]

    if 'lyrics' in columns or 'lyrics_text' in columns:
        print("\n✗ WARNING: Raw lyrics column found in schema!")
    else:
        print("\n✓ Verified: No raw lyrics storage (only embeddings)")

    conn.close()

    # Cleanup
    test_db.unlink()
    print(f"\n✓ Test complete, cleaned up {test_db}")

"""
Component 2: Lyrics NLP

Fetches lyrics from Genius API, computes embeddings and sentiment, then
DISCARDS the raw text (licensing/storage constraint).

Outputs:
- lyric_embedding: Multilingual SBERT sentence embedding
- valence_text: Sentiment score mapped to valence [0-1]
- has_lyrics: Whether lyrics were found

NO RAW LYRIC TEXT IS STORED.
"""

import numpy as np
from typing import Optional, Dict, Tuple
from pathlib import Path
import hashlib


class LyricsAnalyzer:
    """
    Lyrics analysis with Genius API + SBERT embeddings.

    Privacy-conscious design: fetches lyrics, computes features, discards text.

    Parameters
    ----------
    genius_token : str, optional
        Genius API access token. Get from https://genius.com/api-clients
    sbert_model : str, default='paraphrase-multilingual-MiniLM-L12-v2'
        Sentence-BERT model for embeddings. Multilingual to handle
        non-English lyrics.
    cache_dir : Path, optional
        Where to cache lyric features (NOT raw text)
    """

    def __init__(
        self,
        genius_token: Optional[str] = None,
        sbert_model: str = 'paraphrase-multilingual-MiniLM-L12-v2',
        cache_dir: Optional[Path] = None
    ):
        self.genius_token = genius_token
        self.cache_dir = cache_dir

        # Load Genius API client if token provided
        if genius_token:
            try:
                import lyricsgenius
                self.genius = lyricsgenius.Genius(
                    genius_token,
                    verbose=False,
                    remove_section_headers=True,
                    skip_non_songs=True,
                    excluded_terms=["(Remix)", "(Live)"]
                )
                print("✓ Genius API client initialized")
            except ImportError:
                print("Warning: lyricsgenius not installed. Install with: pip install lyricsgenius")
                self.genius = None
        else:
            print("Warning: No Genius token provided. Lyrics analysis disabled.")
            self.genius = None

        # Load SBERT model for embeddings
        try:
            from sentence_transformers import SentenceTransformer
            self.sbert = SentenceTransformer(sbert_model)
            print(f"✓ Loaded SBERT model: {sbert_model}")
        except ImportError:
            print("Warning: sentence-transformers not installed. Install with: pip install sentence-transformers")
            self.sbert = None

    def fetch_lyrics(
        self,
        title: str,
        artist: str,
        max_retries: int = 2
    ) -> Optional[str]:
        """
        Fetch lyrics from Genius.

        Uses fuzzy matching to handle artist/title variations.

        Parameters
        ----------
        title : str
            Track title
        artist : str
            Artist name
        max_retries : int
            Number of retry attempts for fuzzy matching

        Returns
        -------
        str or None
            Lyrics text, or None if not found
        """
        if not self.genius:
            return None

        try:
            # Search for song
            song = self.genius.search_song(title, artist)

            if song is None:
                # Try without artist for better fuzzy matching
                song = self.genius.search_song(title)

            if song is not None:
                return song.lyrics
            else:
                return None

        except Exception as e:
            print(f"Error fetching lyrics for {artist} - {title}: {e}")
            return None

    def compute_lyric_embedding(
        self,
        lyrics: str,
        dimensionality_reduction: Optional[int] = None
    ) -> np.ndarray:
        """
        Compute sentence embedding for lyrics.

        Uses multilingual SBERT to handle non-English lyrics.

        Parameters
        ----------
        lyrics : str
            Full lyrics text
        dimensionality_reduction : int, optional
            If provided, reduce embedding to this dimension via PCA

        Returns
        -------
        np.ndarray
            Embedding vector (384-dim for default model, or reduced)
        """
        if not self.sbert:
            raise RuntimeError("SBERT model not loaded")

        # Encode the full lyrics as a single document
        # This captures the overall semantic content
        embedding = self.sbert.encode(lyrics, convert_to_numpy=True)

        # Optional dimensionality reduction
        if dimensionality_reduction:
            from sklearn.decomposition import PCA
            pca = PCA(n_components=dimensionality_reduction)
            embedding = pca.fit_transform(embedding.reshape(1, -1)).flatten()

        return embedding

    def compute_sentiment_valence(
        self,
        lyrics: str
    ) -> float:
        """
        Compute sentiment score and map to valence [0-1].

        Uses a simple sentiment analyzer. For production, consider
        fine-tuning on music-specific emotion lexicons.

        Parameters
        ----------
        lyrics : str
            Full lyrics text

        Returns
        -------
        float
            Valence score in [0, 1] where:
            - 0.0 = very negative/sad
            - 0.5 = neutral
            - 1.0 = very positive/happy
        """
        try:
            from transformers import pipeline

            # Use a sentiment analysis pipeline
            # For better results, could fine-tune on music lyrics
            sentiment_analyzer = pipeline(
                "sentiment-analysis",
                model="distilbert-base-uncased-finetuned-sst-2-english"
            )

            # Split lyrics into chunks (models have token limits)
            max_length = 512
            words = lyrics.split()
            chunks = []
            current_chunk = []
            current_length = 0

            for word in words:
                current_chunk.append(word)
                current_length += len(word) + 1  # +1 for space
                if current_length >= max_length:
                    chunks.append(' '.join(current_chunk))
                    current_chunk = []
                    current_length = 0

            if current_chunk:
                chunks.append(' '.join(current_chunk))

            # Analyze each chunk
            sentiments = []
            for chunk in chunks:
                if len(chunk.strip()) > 0:
                    result = sentiment_analyzer(chunk[:512])[0]
                    # Convert to valence score
                    if result['label'] == 'POSITIVE':
                        score = 0.5 + (result['score'] * 0.5)
                    else:  # NEGATIVE
                        score = 0.5 - (result['score'] * 0.5)
                    sentiments.append(score)

            # Average across chunks
            if sentiments:
                return float(np.mean(sentiments))
            else:
                return 0.5  # Neutral if no valid chunks

        except Exception as e:
            print(f"Error computing sentiment: {e}")
            return 0.5  # Neutral on error

    def analyze_lyrics(
        self,
        title: str,
        artist: str,
        embedding_dim_reduction: Optional[int] = 128
    ) -> Dict:
        """
        Complete lyrics analysis pipeline.

        Steps:
        1. Fetch lyrics from Genius
        2. Compute SBERT embedding
        3. Compute sentiment → valence
        4. DISCARD raw lyrics text
        5. Return only derived features

        Parameters
        ----------
        title : str
            Track title
        artist : str
            Artist name
        embedding_dim_reduction : int, optional
            Reduce embedding dimensionality (default 128 for storage efficiency)

        Returns
        -------
        dict
            {
                'has_lyrics': bool,
                'lyric_embedding': ndarray or None,
                'valence_text': float or None (0-1)
            }

        Note
        ----
        NO 'lyrics' field in output - raw text is never returned or stored
        """
        # Fetch lyrics
        lyrics_text = self.fetch_lyrics(title, artist)

        if lyrics_text is None or len(lyrics_text.strip()) < 50:
            # No lyrics found or too short (likely instrumental or fetch error)
            return {
                'has_lyrics': False,
                'lyric_embedding': None,
                'valence_text': None
            }

        try:
            # Compute embedding
            embedding = self.compute_lyric_embedding(
                lyrics_text,
                dimensionality_reduction=embedding_dim_reduction
            )

            # Compute sentiment valence
            valence_text = self.compute_sentiment_valence(lyrics_text)

            # CRITICAL: Discard the raw lyrics text
            # Only return derived features
            return {
                'has_lyrics': True,
                'lyric_embedding': embedding,
                'valence_text': valence_text
            }

        except Exception as e:
            print(f"Error analyzing lyrics for {artist} - {title}: {e}")
            return {
                'has_lyrics': False,
                'lyric_embedding': None,
                'valence_text': None
            }

    def fuse_bimodal_valence(
        self,
        valence_audio: float,
        valence_text: Optional[float],
        audio_weight: float = 0.6,
        text_weight: float = 0.4
    ) -> float:
        """
        Fuse audio and text valence into final valence score.

        This is the bimodal emotion fusion specified in the ML layer spec.

        Parameters
        ----------
        valence_audio : float
            Valence from audio analysis
        valence_text : float or None
            Valence from lyric sentiment. None for instrumentals.
        audio_weight : float
            Weight for audio valence
        text_weight : float
            Weight for text valence

        Returns
        -------
        float
            Final valence score in [0, 1]
        """
        if valence_text is None:
            # No lyrics → use audio only
            return valence_audio

        # Weighted fusion
        valence_final = (audio_weight * valence_audio) + (text_weight * valence_text)

        # Ensure in [0, 1]
        return np.clip(valence_final, 0.0, 1.0)


def verify_no_lyrics_stored(catalogue_db_path: Path) -> bool:
    """
    Verify that no raw lyrics text is stored in the catalogue.

    This is an acceptance criterion - grep the datastore to confirm.

    Parameters
    ----------
    catalogue_db_path : Path
        Path to catalogue database or storage

    Returns
    -------
    bool
        True if no lyrics found, False if lyrics text is stored
    """
    # TODO: Implement based on catalogue storage format
    # For SQLite: SELECT COUNT(*) FROM tracks WHERE lyrics IS NOT NULL
    # For JSON/files: grep for large text fields in lyric columns
    pass


if __name__ == "__main__":
    import argparse
    import os

    parser = argparse.ArgumentParser(description="Test lyrics analysis")
    parser.add_argument('--artist', required=True, help="Artist name")
    parser.add_argument('--title', required=True, help="Track title")
    parser.add_argument('--genius-token', help="Genius API token (or set GENIUS_TOKEN env var)")

    args = parser.parse_args()

    # Get Genius token
    genius_token = args.genius_token or os.getenv('GENIUS_TOKEN')

    if not genius_token:
        print("Error: Genius token required. Set --genius-token or GENIUS_TOKEN env var")
        print("Get token from: https://genius.com/api-clients")
        exit(1)

    # Create analyzer
    analyzer = LyricsAnalyzer(genius_token=genius_token)

    print(f"\nAnalyzing lyrics for: {args.artist} - {args.title}")

    # Analyze
    result = analyzer.analyze_lyrics(args.title, args.artist)

    if result['has_lyrics']:
        print("\n✓ Lyrics found and analyzed:")
        print(f"  Embedding shape: {result['lyric_embedding'].shape}")
        print(f"  Embedding preview: {result['lyric_embedding'][:5]}")
        print(f"  Text valence: {result['valence_text']:.3f}")
        print("\nNote: Raw lyrics text was NOT stored (privacy/licensing)")

        # Test bimodal fusion
        test_audio_valence = 0.7
        fused = analyzer.fuse_bimodal_valence(test_audio_valence, result['valence_text'])
        print(f"\nBimodal fusion example:")
        print(f"  Audio valence: {test_audio_valence:.3f}")
        print(f"  Text valence: {result['valence_text']:.3f}")
        print(f"  Fused valence: {fused:.3f}")
    else:
        print("\n✗ No lyrics found (likely instrumental or not in Genius database)")

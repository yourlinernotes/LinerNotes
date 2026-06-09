"""
Component 4: Recommenders

Three recommendation surfaces with different genre strictness:

1. "Songs like this" - Genre-STRICT (same/adjacent genres only, then rank by similarity)
2. Mood playlist - Genre-LOOSE (mood first, genre optional parameter)
3. For You feed - HYBRID (CF + content + emotion, with re-ranking)

Each uses the rich track_vector representation from the catalogue.
"""

import numpy as np
from typing import List, Dict, Optional, Tuple
from scipy.spatial import KDTree
from scipy.spatial.distance import cosine
from pathlib import Path


class SimilarRecommender:
    """
    "Songs like this" recommender - genre-aware similarity.

    Strategy: Restrict to seed's genre (+ adjacent genres), then rank by
    track_vector cosine similarity. Cohesion over diversity.

    Parameters
    ----------
    catalogue : TrackCatalogue
        Track catalogue with feature vectors
    adjacent_genres : dict, optional
        Mapping of genre → list of adjacent genres for expansion
    """

    def __init__(self, catalogue, adjacent_genres: Optional[Dict] = None):
        self.catalogue = catalogue
        self.adjacent_genres = adjacent_genres or self._default_adjacent_genres()

    def _default_adjacent_genres(self) -> Dict:
        """
        Default genre adjacency map.

        In production, learn this from co-listening patterns or genre taxonomies.
        """
        return {
            'rock': ['alternative', 'indie', 'punk'],
            'pop': ['indie', 'electronic', 'dance'],
            'electronic': ['pop', 'dance', 'ambient'],
            'hip-hop': ['r&b', 'rap', 'trap'],
            'jazz': ['blues', 'soul', 'fusion'],
            'classical': ['orchestral', 'chamber', 'opera'],
            # Add more...
        }

    def recommend(
        self,
        seed_track_id: str,
        n: int = 10,
        genre_strict: bool = True,
        user_track_pool: Optional[List[str]] = None
    ) -> List[Tuple[str, float]]:
        """
        Recommend tracks similar to seed.

        Parameters
        ----------
        seed_track_id : str
            Track ID to find similar to
        n : int
            Number of recommendations
        genre_strict : bool
            If True, only recommend from same/adjacent genres
        user_track_pool : list of str, optional
            Restrict candidates to user's library. If None, use full catalogue.

        Returns
        -------
        list of (track_id, score)
            Recommended track IDs with similarity scores
        """
        # Get seed track
        seed = self.catalogue.get_track(seed_track_id)
        if seed is None or seed['track_vector'] is None:
            return []

        seed_vector = seed['track_vector']
        seed_genre = seed['genre']

        # Get candidate pool
        if user_track_pool:
            candidates = [
                self.catalogue.get_track(tid)
                for tid in user_track_pool
                if tid != seed_track_id
            ]
            candidates = [c for c in candidates if c is not None]
        else:
            # Use full catalogue (expensive - prefer user pool)
            if genre_strict and seed_genre:
                # Get tracks in same/adjacent genres
                allowed_genres = [seed_genre] + self.adjacent_genres.get(seed_genre, [])
                candidates = []
                for genre in allowed_genres:
                    candidates.extend(self.catalogue.get_tracks_by_genre(genre, limit=500))
            else:
                # Get all tracks (very expensive, avoid in production)
                track_ids, _ = self.catalogue.get_all_track_vectors()
                candidates = [self.catalogue.get_track(tid) for tid in track_ids[:1000]]

        # Filter out tracks without vectors
        candidates = [c for c in candidates if c['track_vector'] is not None]

        if not candidates:
            return []

        # Compute similarities
        similarities = []
        for candidate in candidates:
            sim = 1 - cosine(seed_vector, candidate['track_vector'])
            similarities.append((candidate['track_id'], sim))

        # Sort by similarity
        similarities.sort(key=lambda x: x[1], reverse=True)

        return similarities[:n]


class MoodPlaylistRecommender:
    """
    Mood playlist recommender - emotion-first with optional genre filter.

    Strategy: KDTree search over (valence, arousal) space, with optional
    genre strictness parameter. Mood matters most.

    Parameters
    ----------
    catalogue : TrackCatalogue
        Track catalogue
    """

    def __init__(self, catalogue):
        self.catalogue = catalogue

    def recommend(
        self,
        valence: float,
        arousal: float,
        user_track_pool: List[str],
        n: int = 10,
        genre_filter: Optional[List[str]] = None,
        recency_weights: Optional[np.ndarray] = None
    ) -> List[Tuple[str, float]]:
        """
        Generate mood playlist from user's recently played tracks.

        Parameters
        ----------
        valence : float
            Target valence [0, 1]
        arousal : float
            Target arousal [0, 1]
        user_track_pool : list of str
            User's recently played + short-term top tracks
        n : int
            Number of tracks in playlist
        genre_filter : list of str, optional
            If provided, restrict to these genres
        recency_weights : np.ndarray, optional
            Weights for recency (newer = higher weight)

        Returns
        -------
        list of (track_id, distance)
            Track IDs with emotion-space distances
        """
        # Get tracks from user pool
        tracks = []
        for tid in user_track_pool:
            track = self.catalogue.get_track(tid)
            if track and track['valence'] is not None and track['arousal'] is not None:
                # Apply genre filter if specified
                if genre_filter and track['genre'] not in genre_filter:
                    continue
                tracks.append(track)

        if not tracks:
            return []

        # Build emotion space
        track_ids = [t['track_id'] for t in tracks]
        emotions = np.array([[t['valence'], t['arousal']] for t in tracks])

        # Build KDTree
        tree = KDTree(emotions)

        # Query for nearest neighbors
        distances, indices = tree.query([valence, arousal], k=min(n, len(tracks)))

        # Handle single result
        if isinstance(indices, (int, np.integer)):
            indices = [indices]
            distances = [distances]

        # Apply recency weights if provided
        if recency_weights is not None:
            # Combine distance with recency (lower distance + higher recency = better)
            # Normalize both to [0, 1] and combine
            norm_distances = distances / (distances.max() + 1e-8)
            norm_recency = recency_weights[indices] / (recency_weights.max() + 1e-8)
            combined_scores = 0.7 * (1 - norm_distances) + 0.3 * norm_recency
            # Re-sort by combined score
            sorted_idx = np.argsort(-combined_scores)
            indices = indices[sorted_idx]
            distances = distances[sorted_idx]

        return [(track_ids[i], float(distances[j])) for j, i in enumerate(indices)]


class ForYouRecommender:
    """
    "For You" hybrid recommender.

    Strategy: ALS collaborative filtering score fused with content+emotion
    cosine score, then re-ranked with mood boost, friend boost, thumbs.

    Parameters
    ----------
    catalogue : TrackCatalogue
        Track catalogue
    """

    def __init__(self, catalogue):
        self.catalogue = catalogue
        self.als_model = None

    def train_cf_model(
        self,
        user_item_matrix: np.ndarray,
        factors: int = 50,
        regularization: float = 0.01,
        iterations: int = 15
    ):
        """
        Train ALS collaborative filtering model.

        Parameters
        ----------
        user_item_matrix : np.ndarray
            Sparse user-item interaction matrix (implicit feedback)
            Shape: (n_users, n_items)
        factors : int
            Number of latent factors
        regularization : float
            Regularization parameter
        iterations : int
            Number of ALS iterations
        """
        try:
            from implicit.als import AlternatingLeastSquares
            import scipy.sparse as sp

            # Convert to sparse if needed
            if not sp.issparse(user_item_matrix):
                user_item_matrix = sp.csr_matrix(user_item_matrix)

            # Train ALS model
            self.als_model = AlternatingLeastSquares(
                factors=factors,
                regularization=regularization,
                iterations=iterations
            )

            self.als_model.fit(user_item_matrix)

            print(f"✓ Trained ALS model ({factors} factors, {iterations} iterations)")

        except ImportError:
            print("Warning: implicit library not installed. Install with: pip install implicit")
            self.als_model = None

    def recommend(
        self,
        user_id: int,
        user_item_matrix: Optional[np.ndarray] = None,
        user_track_history: Optional[List[str]] = None,
        n: int = 20,
        cf_weight: float = 0.4,
        content_weight: float = 0.4,
        emotion_weight: float = 0.2,
        mood_boost: Optional[Tuple[float, float]] = None,
        friend_listening: Optional[List[str]] = None,
        thumbs_down: Optional[List[str]] = None
    ) -> List[Tuple[str, float, str]]:
        """
        Generate personalized For You feed.

        Parameters
        ----------
        user_id : int
            User ID in the CF matrix
        user_item_matrix : np.ndarray, optional
            User-item matrix for CF (if not using pre-trained model)
        user_track_history : list of str, optional
            User's listening history for content-based component
        n : int
            Number of recommendations
        cf_weight : float
            Weight for collaborative filtering score
        content_weight : float
            Weight for content similarity score
        emotion_weight : float
            Weight for emotion similarity score
        mood_boost : tuple of (valence, arousal), optional
            Boost tracks matching current mood
        friend_listening : list of str, optional
            Track IDs friends are listening to (social boost)
        thumbs_down : list of str, optional
            Track IDs user has thumbed down (exclude)

        Returns
        -------
        list of (track_id, score, reason)
            Recommendations with scores and "why this" explanations
        """
        recommendations = []

        # 1. Collaborative Filtering Score
        cf_scores = {}
        if self.als_model and user_item_matrix is not None:
            try:
                from scipy.sparse import csr_matrix

                # Get CF recommendations
                user_items = csr_matrix(user_item_matrix[user_id])
                cf_recs = self.als_model.recommend(
                    user_id,
                    user_items,
                    N=n * 3,  # Get more for fusion
                    filter_already_liked_items=True
                )

                # Map to track IDs (assuming item indices match catalogue order)
                track_ids, _ = self.catalogue.get_all_track_vectors()
                for item_id, score in cf_recs:
                    if item_id < len(track_ids):
                        cf_scores[track_ids[item_id]] = float(score)

            except Exception as e:
                print(f"CF scoring failed: {e}")

        # 2. Content + Emotion Score
        content_scores = {}
        if user_track_history:
            # Build user taste profile from history
            user_vectors = []
            for tid in user_track_history[-50:]:  # Recent history
                track = self.catalogue.get_track(tid)
                if track and track['track_vector'] is not None:
                    user_vectors.append(track['track_vector'])

            if user_vectors:
                user_profile = np.mean(user_vectors, axis=0)

                # Score all candidates
                track_ids, track_vectors = self.catalogue.get_all_track_vectors()
                for tid, tvec in zip(track_ids, track_vectors):
                    if tid not in user_track_history:  # Don't recommend history
                        sim = 1 - cosine(user_profile, tvec)
                        content_scores[tid] = sim

        # 3. Fuse scores
        all_track_ids = set(cf_scores.keys()) | set(content_scores.keys())

        for tid in all_track_ids:
            if thumbs_down and tid in thumbs_down:
                continue  # Skip thumbs down

            cf_score = cf_scores.get(tid, 0.0)
            content_score = content_scores.get(tid, 0.0)

            # Weighted fusion
            combined_score = (
                cf_weight * cf_score +
                (content_weight + emotion_weight) * content_score
            )

            # Mood boost
            reason = []
            if mood_boost:
                track = self.catalogue.get_track(tid)
                if track and track['valence'] is not None:
                    target_v, target_a = mood_boost
                    emotion_dist = np.sqrt(
                        (track['valence'] - target_v)**2 +
                        (track['arousal'] - target_a)**2
                    )
                    if emotion_dist < 0.2:  # Close in emotion space
                        combined_score *= 1.2
                        reason.append("matches your mood")

            # Friend boost
            if friend_listening and tid in friend_listening:
                combined_score *= 1.15
                reason.append("friends are listening")

            # Determine primary reason
            if not reason:
                if cf_score > content_score:
                    reason.append("users like you enjoyed this")
                else:
                    reason.append("similar to your taste")

            recommendations.append((tid, combined_score, ", ".join(reason)))

        # Sort by score
        recommendations.sort(key=lambda x: x[1], reverse=True)

        return recommendations[:n]


if __name__ == "__main__":
    # Test recommenders with mock catalogue
    from catalogue import TrackCatalogue
    import tempfile

    with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as f:
        test_db = Path(f.name)

    catalogue = TrackCatalogue(test_db)

    # Add test tracks
    for i in range(20):
        catalogue.add_track(
            track_id=f"TRACK_{i:03d}",
            title=f"Test Song {i}",
            artist=f"Artist {i % 5}",
            valence=np.random.rand(),
            arousal=np.random.rand(),
            genre=['pop', 'rock', 'electronic', 'hip-hop', 'jazz'][i % 5],
            audio_embedding=np.random.randn(512),
            genre_embedding=np.random.randn(64),
            lyric_embedding=np.random.randn(128) if i % 3 != 0 else None,
            has_lyrics=(i % 3 != 0),
            analyzable=True
        )

    print("✓ Created test catalogue with 20 tracks\n")

    # Test Similar recommender
    print("Testing SimilarRecommender...")
    similar_rec = SimilarRecommender(catalogue)
    recs = similar_rec.recommend("TRACK_000", n=5)
    print(f"  Top 5 similar to TRACK_000:")
    for tid, score in recs:
        print(f"    {tid}: {score:.3f}")

    # Test Mood recommender
    print("\nTesting MoodPlaylistRecommender...")
    mood_rec = MoodPlaylistRecommender(catalogue)
    user_pool = [f"TRACK_{i:03d}" for i in range(20)]
    recs = mood_rec.recommend(0.7, 0.6, user_pool, n=5)
    print(f"  Mood playlist (valence=0.7, arousal=0.6):")
    for tid, dist in recs:
        track = catalogue.get_track(tid)
        print(f"    {tid}: distance={dist:.3f}, v={track['valence']:.2f}, a={track['arousal']:.2f}")

    catalogue.close()
    test_db.unlink()
    print("\n✓ Tests complete")

"""
Component 1: Track Analysis Wrapper

Wraps Emotify's analyze() function and integrates with audio sourcing.
Given track metadata, resolves to audio, analyzes it, and returns features.
"""

from pathlib import Path
from typing import Dict, Optional
import tempfile
import os

from .audio_sourcing import AudioSourcer, TrackMetadata
import sys
sys.path.insert(0, str(Path(__file__).parent.parent / 'emotify'))
from emotify.analyze import analyze as emotify_analyze


class TrackAnalyzer:
    """
    High-level track analysis orchestrator.

    Combines audio sourcing (Component 0) with Emotify analysis to provide
    a single interface for: metadata → audio → ML features.

    Parameters
    ----------
    emotify_model_dir : Path
        Directory containing trained Emotify model
    audio_sourcer : AudioSourcer, optional
        Custom audio sourcer instance. If None, creates default.
    cleanup_audio : bool, default=True
        Whether to delete downloaded audio files after analysis
    """

    def __init__(
        self,
        emotify_model_dir: Path,
        audio_sourcer: Optional[AudioSourcer] = None,
        cleanup_audio: bool = True
    ):
        self.emotify_model_dir = Path(emotify_model_dir)
        self.audio_sourcer = audio_sourcer or AudioSourcer()
        self.cleanup_audio = cleanup_audio

        # Load Emotify model
        from emotify.analyze import load_model
        load_model(self.emotify_model_dir)
        print(f"✓ TrackAnalyzer initialized with model from {emotify_model_dir}")

    def analyze_from_metadata(
        self,
        metadata: TrackMetadata,
        force_redownload: bool = False
    ) -> Optional[Dict]:
        """
        Analyze a track from its metadata.

        This is the main entry point for Component 1.

        Steps:
        1. Resolve metadata to preview clip (Component 0)
        2. Run Emotify analysis on the clip
        3. Clean up audio file if requested
        4. Return combined results

        Parameters
        ----------
        metadata : TrackMetadata
            Track metadata (from Spotify or elsewhere)
        force_redownload : bool
            Re-download audio even if cached

        Returns
        -------
        dict or None
            {
                'valence_audio': float,
                'arousal': float,
                'genre': str,
                'genre_probs': dict,
                'embedding': ndarray,
                'audio_source': str,  # 'itunes' or 'deezer'
                'analyzable': bool
            }
            Returns None if no preview clip found
        """
        # Step 1: Resolve to audio clip
        audio_path = self.audio_sourcer.resolve_and_fetch(
            metadata,
            force_download=force_redownload
        )

        if audio_path is None:
            return {
                'valence_audio': None,
                'arousal': None,
                'genre': None,
                'genre_probs': None,
                'embedding': None,
                'audio_source': None,
                'analyzable': False
            }

        try:
            # Step 2: Run Emotify analysis
            result = emotify_analyze(audio_path)

            # Step 3: Augment with metadata
            result['audio_source'] = 'itunes'  # Determine from audio_sourcer state
            result['analyzable'] = True

            # Rename 'valence' to 'valence_audio' for bimodal fusion later
            result['valence_audio'] = result.pop('valence')

            return result

        except Exception as e:
            print(f"Error analyzing {metadata.artist} - {metadata.title}: {e}")
            return {
                'valence_audio': None,
                'arousal': None,
                'genre': None,
                'genre_probs': None,
                'embedding': None,
                'audio_source': None,
                'analyzable': False
            }

        finally:
            # Step 4: Cleanup
            if self.cleanup_audio and audio_path and audio_path.exists():
                try:
                    os.remove(audio_path)
                except Exception as e:
                    print(f"Warning: Failed to delete {audio_path}: {e}")

    def analyze_from_spotify_track(
        self,
        spotify_track: Dict
    ) -> Optional[Dict]:
        """
        Analyze a track from a Spotify track object.

        Convenience method that extracts metadata from Spotify format.

        Parameters
        ----------
        spotify_track : dict
            Spotify track object with 'name', 'artists', 'album', etc.

        Returns
        -------
        dict or None
            Analysis results (same format as analyze_from_metadata)
        """
        # Extract metadata from Spotify track object
        metadata = TrackMetadata(
            title=spotify_track.get('name', ''),
            artist=spotify_track.get('artists', [{}])[0].get('name', ''),
            album=spotify_track.get('album', {}).get('name'),
            duration_ms=spotify_track.get('duration_ms'),
            isrc=spotify_track.get('external_ids', {}).get('isrc')
        )

        return self.analyze_from_metadata(metadata)

    def batch_analyze(
        self,
        tracks: list,
        from_spotify: bool = True,
        max_workers: int = 4
    ) -> list:
        """
        Analyze multiple tracks in parallel.

        Parameters
        ----------
        tracks : list
            List of Spotify track objects or TrackMetadata objects
        from_spotify : bool
            Whether tracks are Spotify objects (True) or TrackMetadata (False)
        max_workers : int
            Number of parallel workers

        Returns
        -------
        list
            List of analysis results
        """
        from concurrent.futures import ThreadPoolExecutor, as_completed

        results = []

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            if from_spotify:
                futures = {
                    executor.submit(self.analyze_from_spotify_track, track): i
                    for i, track in enumerate(tracks)
                }
            else:
                futures = {
                    executor.submit(self.analyze_from_metadata, track): i
                    for i, track in enumerate(tracks)
                }

            # Collect results in order
            results = [None] * len(tracks)
            for future in as_completed(futures):
                idx = futures[future]
                try:
                    results[idx] = future.result()
                except Exception as e:
                    print(f"Error processing track {idx}: {e}")
                    results[idx] = {
                        'valence_audio': None,
                        'arousal': None,
                        'genre': None,
                        'genre_probs': None,
                        'embedding': None,
                        'audio_source': None,
                        'analyzable': False
                    }

        return results


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Test track analysis")
    parser.add_argument('--model-dir', type=Path, required=True,
                        help="Emotify model directory")
    parser.add_argument('--artist', required=True, help="Artist name")
    parser.add_argument('--title', required=True, help="Track title")
    parser.add_argument('--album', help="Album name (optional)")
    parser.add_argument('--isrc', help="ISRC (optional)")

    args = parser.parse_args()

    # Create analyzer
    analyzer = TrackAnalyzer(emotify_model_dir=args.model_dir)

    # Create metadata
    metadata = TrackMetadata(
        title=args.title,
        artist=args.artist,
        album=args.album,
        isrc=args.isrc
    )

    print(f"\nAnalyzing: {metadata.artist} - {metadata.title}")

    # Analyze
    result = analyzer.analyze_from_metadata(metadata)

    if result and result['analyzable']:
        print("\n✓ Analysis successful:")
        print(f"  Valence (audio): {result['valence_audio']:.3f}")
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
        print(f"  Audio source: {result['audio_source']}")
        print(f"  Embedding shape: {result['embedding'].shape}")
    else:
        print("\n✗ Analysis failed - no preview clip found or analysis error")

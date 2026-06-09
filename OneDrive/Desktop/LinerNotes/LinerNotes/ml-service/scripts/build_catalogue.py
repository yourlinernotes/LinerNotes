#!/usr/bin/env python3
"""
Component 6: Catalogue Builder Pipeline

Batch processing script to build the track catalogue from Spotify track lists.

Usage:
    python scripts/build_catalogue.py \\
        --input user_library.json \\
        --model-dir models/emotify_v2 \\
        --workers 4 \\
        --genius-token $GENIUS_TOKEN

Input format (JSON):
    [
        {
            "name": "Track Title",
            "artists": [{"name": "Artist Name"}],
            "album": {"name": "Album Name"},
            "duration_ms": 200000,
            "external_ids": {"isrc": "USRC12345678"},
            "id": "spotify_track_id"
        },
        ...
    ]

Features:
- Parallel processing with configurable workers
- Progress tracking with tqdm
- Resume capability (skips already-analyzed tracks)
- Error handling with retry logic
- Summary statistics at completion
"""

import argparse
import json
import sys
import os
from pathlib import Path
from typing import List, Dict, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
import time
from tqdm import tqdm

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from components.catalogue import TrackCatalogue
from components.track_analysis import TrackAnalyzer, TrackMetadata
from components.lyrics_nlp import LyricsAnalyzer


@dataclass
class ProcessingStats:
    """Track processing statistics."""
    total: int = 0
    already_in_catalogue: int = 0
    analyzed_success: int = 0
    analyzed_failed: int = 0
    not_analyzable: int = 0
    with_lyrics: int = 0
    errors: List[str] = None

    def __post_init__(self):
        if self.errors is None:
            self.errors = []

    def print_summary(self):
        """Print processing summary."""
        print("\n" + "=" * 60)
        print("CATALOGUE BUILD SUMMARY")
        print("=" * 60)
        print(f"Total tracks processed:      {self.total}")
        print(f"Already in catalogue:        {self.already_in_catalogue}")
        print(f"Newly analyzed (success):    {self.analyzed_success}")
        print(f"  - With lyrics:             {self.with_lyrics}")
        print(f"  - Audio only:              {self.analyzed_success - self.with_lyrics}")
        print(f"Not analyzable (no preview): {self.not_analyzable}")
        print(f"Analysis failed (errors):    {self.analyzed_failed}")
        print("=" * 60)

        if self.errors:
            print(f"\nErrors ({len(self.errors)}):")
            for error in self.errors[:10]:  # Show first 10
                print(f"  - {error}")
            if len(self.errors) > 10:
                print(f"  ... and {len(self.errors) - 10} more")


class CatalogueBuilder:
    """
    Batch catalogue builder.

    Orchestrates parallel track analysis and catalogue population.
    """

    def __init__(
        self,
        catalogue: TrackCatalogue,
        track_analyzer: TrackAnalyzer,
        lyrics_analyzer: Optional[LyricsAnalyzer] = None,
        max_retries: int = 2
    ):
        self.catalogue = catalogue
        self.track_analyzer = track_analyzer
        self.lyrics_analyzer = lyrics_analyzer
        self.max_retries = max_retries
        self.stats = ProcessingStats()

    def _extract_metadata(self, spotify_track: Dict) -> TrackMetadata:
        """Extract TrackMetadata from Spotify track object."""
        return TrackMetadata(
            title=spotify_track.get('name', ''),
            artist=spotify_track.get('artists', [{}])[0].get('name', ''),
            album=spotify_track.get('album', {}).get('name'),
            duration_ms=spotify_track.get('duration_ms'),
            isrc=spotify_track.get('external_ids', {}).get('isrc')
        )

    def _generate_track_id(self, metadata: TrackMetadata) -> str:
        """Generate track ID from metadata."""
        if metadata.isrc:
            return metadata.isrc
        return f"{metadata.artist}_{metadata.title}".replace(" ", "_")

    def _is_in_catalogue(self, metadata: TrackMetadata) -> bool:
        """Check if track is already in catalogue."""
        # Try ISRC lookup
        if metadata.isrc:
            track = self.catalogue.get_track_by_isrc(metadata.isrc)
            if track:
                return True

        # Try fuzzy search
        matches = self.catalogue.search_by_artist_title(
            metadata.artist,
            metadata.title,
            fuzzy=True
        )
        return len(matches) > 0

    def _process_track(self, spotify_track: Dict) -> Dict:
        """
        Process a single track.

        Returns a dict with processing results.
        """
        metadata = self._extract_metadata(spotify_track)
        track_id = self._generate_track_id(metadata)

        result = {
            'track_id': track_id,
            'title': metadata.title,
            'artist': metadata.artist,
            'success': False,
            'already_exists': False,
            'analyzable': False,
            'has_lyrics': False,
            'error': None
        }

        # Check if already in catalogue
        if self._is_in_catalogue(metadata):
            result['already_exists'] = True
            result['success'] = True
            return result

        # Analyze track with retries
        for attempt in range(self.max_retries):
            try:
                # Analyze audio
                audio_result = self.track_analyzer.analyze_from_metadata(metadata)

                if not audio_result or not audio_result.get('analyzable'):
                    # Track not analyzable (no preview clip)
                    self.catalogue.add_track(
                        track_id=track_id,
                        title=metadata.title,
                        artist=metadata.artist,
                        album=metadata.album,
                        isrc=metadata.isrc,
                        duration_ms=metadata.duration_ms,
                        analyzable=False
                    )
                    result['success'] = True
                    result['analyzable'] = False
                    return result

                # Analyze lyrics (if available)
                valence_text = None
                lyric_embedding = None
                has_lyrics = False

                if self.lyrics_analyzer:
                    lyrics_result = self.lyrics_analyzer.analyze_lyrics(
                        metadata.title,
                        metadata.artist
                    )
                    if lyrics_result['has_lyrics']:
                        valence_text = lyrics_result['valence_text']
                        lyric_embedding = lyrics_result['lyric_embedding']
                        has_lyrics = True

                # Fuse bimodal valence
                valence_audio = audio_result.get('valence_audio')
                if valence_text is not None and self.lyrics_analyzer:
                    valence_final = self.lyrics_analyzer.fuse_bimodal_valence(
                        valence_audio,
                        valence_text
                    )
                else:
                    valence_final = valence_audio

                # Store in catalogue
                self.catalogue.add_track(
                    track_id=track_id,
                    title=metadata.title,
                    artist=metadata.artist,
                    album=metadata.album,
                    isrc=metadata.isrc,
                    duration_ms=metadata.duration_ms,
                    valence=valence_final,
                    arousal=audio_result.get('arousal'),
                    genre=audio_result.get('genre'),
                    genre_probs=audio_result.get('genre_probs'),
                    audio_embedding=audio_result.get('embedding'),
                    genre_embedding=None,  # TODO: Implement genre embedding lookup
                    lyric_embedding=lyric_embedding,
                    has_lyrics=has_lyrics,
                    analyzable=True,
                    audio_source=audio_result.get('audio_source')
                )

                result['success'] = True
                result['analyzable'] = True
                result['has_lyrics'] = has_lyrics
                return result

            except Exception as e:
                if attempt == self.max_retries - 1:
                    # Final attempt failed
                    result['error'] = str(e)
                    return result
                else:
                    # Retry after a delay
                    time.sleep(1 * (attempt + 1))

        return result

    def build_from_tracks(
        self,
        spotify_tracks: List[Dict],
        workers: int = 4,
        show_progress: bool = True
    ) -> ProcessingStats:
        """
        Build catalogue from list of Spotify tracks.

        Parameters
        ----------
        spotify_tracks : list of dict
            List of Spotify track objects
        workers : int
            Number of parallel workers
        show_progress : bool
            Show progress bar

        Returns
        -------
        ProcessingStats
            Processing statistics
        """
        self.stats = ProcessingStats(total=len(spotify_tracks))

        print(f"\n🔨 Building catalogue from {len(spotify_tracks)} tracks")
        print(f"  Workers: {workers}")
        print(f"  Lyrics analysis: {'enabled' if self.lyrics_analyzer else 'disabled'}")
        print("")

        # Process tracks in parallel
        with ThreadPoolExecutor(max_workers=workers) as executor:
            # Submit all tasks
            futures = {
                executor.submit(self._process_track, track): i
                for i, track in enumerate(spotify_tracks)
            }

            # Process results with progress bar
            if show_progress:
                pbar = tqdm(total=len(spotify_tracks), desc="Processing tracks")
            else:
                pbar = None

            for future in as_completed(futures):
                result = future.result()

                # Update statistics
                if result['already_exists']:
                    self.stats.already_in_catalogue += 1
                elif result['success']:
                    if result['analyzable']:
                        self.stats.analyzed_success += 1
                        if result['has_lyrics']:
                            self.stats.with_lyrics += 1
                    else:
                        self.stats.not_analyzable += 1
                else:
                    self.stats.analyzed_failed += 1
                    if result['error']:
                        error_msg = f"{result['artist']} - {result['title']}: {result['error']}"
                        self.stats.errors.append(error_msg)

                if pbar:
                    pbar.update(1)
                    # Update description with stats
                    pbar.set_postfix({
                        'cached': self.stats.already_in_catalogue,
                        'success': self.stats.analyzed_success,
                        'failed': self.stats.analyzed_failed
                    })

            if pbar:
                pbar.close()

        return self.stats


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Build LinerNotes track catalogue from Spotify track list"
    )

    parser.add_argument(
        '--input',
        type=Path,
        required=True,
        help="Input JSON file with Spotify track objects"
    )

    parser.add_argument(
        '--catalogue-db',
        type=Path,
        default=Path('/tmp/linernotes_catalogue.db'),
        help="Catalogue database path (default: /tmp/linernotes_catalogue.db)"
    )

    parser.add_argument(
        '--model-dir',
        type=Path,
        required=True,
        help="Emotify model directory"
    )

    parser.add_argument(
        '--genius-token',
        help="Genius API token (or set GENIUS_TOKEN env var)"
    )

    parser.add_argument(
        '--workers',
        type=int,
        default=4,
        help="Number of parallel workers (default: 4)"
    )

    parser.add_argument(
        '--limit',
        type=int,
        help="Limit number of tracks to process (for testing)"
    )

    parser.add_argument(
        '--no-progress',
        action='store_true',
        help="Disable progress bar"
    )

    args = parser.parse_args()

    # Validate input file
    if not args.input.exists():
        print(f"Error: Input file not found: {args.input}")
        sys.exit(1)

    # Load tracks
    print(f"📖 Loading tracks from {args.input}")
    with open(args.input) as f:
        spotify_tracks = json.load(f)

    if args.limit:
        spotify_tracks = spotify_tracks[:args.limit]
        print(f"  Limiting to first {args.limit} tracks")

    print(f"  Loaded {len(spotify_tracks)} tracks")

    # Initialize catalogue
    print(f"\n📦 Initializing catalogue at {args.catalogue_db}")
    catalogue = TrackCatalogue(args.catalogue_db)

    # Show current stats
    stats_before = catalogue.get_stats()
    print(f"  Current catalogue size: {stats_before['total_tracks']} tracks")

    # Initialize track analyzer
    print(f"\n🎵 Initializing Emotify model from {args.model_dir}")
    if not args.model_dir.exists():
        print(f"Error: Model directory not found: {args.model_dir}")
        sys.exit(1)

    track_analyzer = TrackAnalyzer(emotify_model_dir=args.model_dir)

    # Initialize lyrics analyzer
    genius_token = args.genius_token or os.getenv('GENIUS_TOKEN')
    if genius_token:
        print(f"\n📝 Initializing lyrics analyzer")
        lyrics_analyzer = LyricsAnalyzer(genius_token=genius_token)
    else:
        print(f"\n⚠️  No Genius token provided - lyrics analysis disabled")
        print(f"   Set --genius-token or GENIUS_TOKEN env var to enable")
        lyrics_analyzer = None

    # Build catalogue
    builder = CatalogueBuilder(
        catalogue=catalogue,
        track_analyzer=track_analyzer,
        lyrics_analyzer=lyrics_analyzer
    )

    stats = builder.build_from_tracks(
        spotify_tracks,
        workers=args.workers,
        show_progress=not args.no_progress
    )

    # Print summary
    stats.print_summary()

    # Show updated catalogue stats
    stats_after = catalogue.get_stats()
    print(f"\nCatalogue size after build: {stats_after['total_tracks']} tracks")
    print(f"  Analyzable: {stats_after['analyzable_tracks']} ({stats_after['analyzable_rate']:.1%})")
    print(f"  With lyrics: {stats_after['tracks_with_lyrics']} ({stats_after['lyrics_rate']:.1%})")
    print(f"  Unique genres: {stats_after['unique_genres']}")

    # Cleanup
    catalogue.close()

    print(f"\n✓ Catalogue build complete")

    # Exit with error if too many failures
    if stats.analyzed_failed > stats.analyzed_success * 0.5:
        print(f"\n⚠️  Warning: High failure rate ({stats.analyzed_failed}/{stats.total})")
        sys.exit(1)


if __name__ == "__main__":
    main()

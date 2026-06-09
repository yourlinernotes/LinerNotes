"""
Component 0: Audio Sourcing

Resolves Spotify tracks to iTunes/Deezer preview clips and handles
track matching via ISRC or fuzzy matching.

NO SPOTIFY AUDIO. Audio comes from iTunes/Deezer for ML analysis.
"""

import requests
from pathlib import Path
from typing import Optional, Dict, Tuple
from urllib.parse import quote
import time
from dataclasses import dataclass


@dataclass
class TrackMetadata:
    """Metadata for track matching."""
    title: str
    artist: str
    album: Optional[str] = None
    duration_ms: Optional[int] = None
    isrc: Optional[str] = None


class AudioSourcer:
    """
    Resolve tracks to preview clips from iTunes or Deezer.

    This is the foundation of the ML layer - EVERYTHING depends on being able
    to fetch audio for analysis. Spotify provides NO analysable audio, so we
    use iTunes/Deezer.

    The matching strategy is:
    1. ISRC lookup (if available) - most reliable
    2. Fuzzy matching on artist + title + album + duration

    Parameters
    ----------
    preferred_source : str, default='itunes'
        Which API to try first ('itunes' or 'deezer')
    download_dir : Path, optional
        Where to download preview clips (temp directory by default)
    """

    def __init__(
        self,
        preferred_source: str = 'itunes',
        download_dir: Optional[Path] = None
    ):
        self.preferred_source = preferred_source
        self.download_dir = download_dir or Path('/tmp/linernotes_previews')
        self.download_dir.mkdir(parents=True, exist_ok=True)

        # API endpoints
        self.itunes_search_url = "https://itunes.apple.com/search"
        self.deezer_search_url = "https://api.deezer.com/search"

        # Rate limiting
        self.last_request_time = 0
        self.min_request_interval = 0.1  # seconds

    def _rate_limit(self):
        """Simple rate limiting to be respectful to APIs."""
        elapsed = time.time() - self.last_request_time
        if elapsed < self.min_request_interval:
            time.sleep(self.min_request_interval - elapsed)
        self.last_request_time = time.time()

    def search_itunes(
        self,
        metadata: TrackMetadata,
        limit: int = 5
    ) -> Optional[Dict]:
        """
        Search iTunes for a track.

        Parameters
        ----------
        metadata : TrackMetadata
            Track metadata for searching
        limit : int
            Max results to return

        Returns
        -------
        dict or None
            iTunes track data with previewUrl, or None if not found
        """
        self._rate_limit()

        # Try ISRC first if available
        if metadata.isrc:
            params = {
                'term': metadata.isrc,
                'media': 'music',
                'entity': 'song',
                'limit': limit
            }

            try:
                response = requests.get(self.itunes_search_url, params=params, timeout=10)
                response.raise_for_status()
                data = response.json()

                if data.get('resultCount', 0) > 0:
                    # Check if any result has a preview
                    for result in data['results']:
                        if result.get('previewUrl'):
                            return result
            except Exception as e:
                print(f"iTunes ISRC search failed: {e}")

        # Fallback: search by artist + title
        search_term = f"{metadata.artist} {metadata.title}"
        if metadata.album:
            search_term += f" {metadata.album}"

        params = {
            'term': search_term,
            'media': 'music',
            'entity': 'song',
            'limit': limit
        }

        try:
            response = requests.get(self.itunes_search_url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()

            if data.get('resultCount', 0) > 0:
                # Find best match based on title similarity
                best_match = self._find_best_match(
                    data['results'],
                    metadata,
                    title_key='trackName',
                    artist_key='artistName',
                    duration_key='trackTimeMillis'
                )

                if best_match and best_match.get('previewUrl'):
                    return best_match

        except Exception as e:
            print(f"iTunes search failed: {e}")

        return None

    def search_deezer(
        self,
        metadata: TrackMetadata,
        limit: int = 5
    ) -> Optional[Dict]:
        """
        Search Deezer for a track.

        Parameters
        ----------
        metadata : TrackMetadata
            Track metadata for searching
        limit : int
            Max results to return

        Returns
        -------
        dict or None
            Deezer track data with preview URL, or None if not found
        """
        self._rate_limit()

        # Try ISRC first if available
        if metadata.isrc:
            try:
                isrc_url = f"https://api.deezer.com/track/isrc:{metadata.isrc}"
                response = requests.get(isrc_url, timeout=10)
                response.raise_for_status()
                data = response.json()

                if 'id' in data and data.get('preview'):
                    return data
            except Exception as e:
                print(f"Deezer ISRC search failed: {e}")

        # Fallback: search by artist + title
        search_query = f"artist:\"{metadata.artist}\" track:\"{metadata.title}\""

        params = {
            'q': search_query,
            'limit': limit
        }

        try:
            response = requests.get(self.deezer_search_url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()

            if data.get('total', 0) > 0:
                # Find best match
                best_match = self._find_best_match(
                    data['data'],
                    metadata,
                    title_key='title',
                    artist_key='artist',  # Note: artist is nested
                    duration_key='duration'  # Deezer uses seconds
                )

                if best_match and best_match.get('preview'):
                    return best_match

        except Exception as e:
            print(f"Deezer search failed: {e}")

        return None

    def _find_best_match(
        self,
        results: list,
        metadata: TrackMetadata,
        title_key: str,
        artist_key: str,
        duration_key: str
    ) -> Optional[Dict]:
        """
        Find the best matching track from search results.

        Uses fuzzy matching on title, artist, and duration.
        """
        if not results:
            return None

        from difflib import SequenceMatcher

        def similarity(a: str, b: str) -> float:
            """String similarity score."""
            return SequenceMatcher(None, a.lower(), b.lower()).ratio()

        best_score = 0
        best_match = None

        for result in results:
            # Extract fields (handle nested artist in Deezer)
            title = result.get(title_key, '')

            if isinstance(result.get(artist_key), dict):
                # Deezer format
                artist = result.get(artist_key, {}).get('name', '')
            else:
                # iTunes format
                artist = result.get(artist_key, '')

            duration = result.get(duration_key)

            # Calculate similarity
            title_sim = similarity(metadata.title, title)
            artist_sim = similarity(metadata.artist, artist)

            # Duration similarity (if available)
            duration_sim = 0.0
            if metadata.duration_ms and duration:
                # Normalize duration (Deezer uses seconds, iTunes uses ms)
                if duration < 1000:  # Likely seconds
                    duration = duration * 1000

                # Allow 10% deviation
                diff = abs(metadata.duration_ms - duration) / metadata.duration_ms
                duration_sim = max(0, 1 - diff / 0.1)

            # Weighted score
            score = (title_sim * 0.5 + artist_sim * 0.3 + duration_sim * 0.2)

            if score > best_score:
                best_score = score
                best_match = result

        # Only return if score is reasonable (>0.6)
        if best_score > 0.6:
            return best_match

        return None

    def resolve_and_fetch(
        self,
        metadata: TrackMetadata,
        force_download: bool = False
    ) -> Optional[Path]:
        """
        Resolve a track to a preview clip and download it.

        This is the main entry point specified in the ML layer spec.

        Parameters
        ----------
        metadata : TrackMetadata
            Track metadata (from Spotify or elsewhere)
        force_download : bool
            Re-download even if file exists

        Returns
        -------
        Path or None
            Path to downloaded preview clip, or None if unavailable
        """
        # Generate filename from ISRC or track metadata
        if metadata.isrc:
            filename = f"{metadata.isrc}.mp3"
        else:
            # Sanitize title and artist for filename
            safe_title = "".join(c for c in metadata.title if c.isalnum() or c in (' ', '-', '_'))
            safe_artist = "".join(c for c in metadata.artist if c.isalnum() or c in (' ', '-', '_'))
            filename = f"{safe_artist}_{safe_title}.mp3".replace(' ', '_')

        file_path = self.download_dir / filename

        # Return cached file if exists
        if file_path.exists() and not force_download:
            return file_path

        # Try preferred source first
        track_data = None

        if self.preferred_source == 'itunes':
            track_data = self.search_itunes(metadata)
            if not track_data:
                track_data = self.search_deezer(metadata)
        else:
            track_data = self.search_deezer(metadata)
            if not track_data:
                track_data = self.search_itunes(metadata)

        if not track_data:
            print(f"No preview found for: {metadata.artist} - {metadata.title}")
            return None

        # Get preview URL
        preview_url = track_data.get('previewUrl') or track_data.get('preview')

        if not preview_url:
            print(f"No preview URL in track data for: {metadata.artist} - {metadata.title}")
            return None

        # Download preview
        try:
            response = requests.get(preview_url, timeout=30)
            response.raise_for_status()

            with open(file_path, 'wb') as f:
                f.write(response.content)

            print(f"✓ Downloaded preview: {file_path}")
            return file_path

        except Exception as e:
            print(f"Failed to download preview: {e}")
            return None

    def match_to_catalogue(
        self,
        spotify_track: Dict
    ) -> Optional[str]:
        """
        Match a Spotify track to a catalogue ID.

        Uses ISRC if available, otherwise falls back to fuzzy matching.

        Parameters
        ----------
        spotify_track : dict
            Spotify track object with metadata

        Returns
        -------
        str or None
            Catalogue ID (ISRC or generated ID), or None if no match
        """
        # Extract metadata
        metadata = TrackMetadata(
            title=spotify_track.get('name', ''),
            artist=spotify_track.get('artists', [{}])[0].get('name', ''),
            album=spotify_track.get('album', {}).get('name'),
            duration_ms=spotify_track.get('duration_ms'),
            isrc=spotify_track.get('external_ids', {}).get('isrc')
        )

        # ISRC is the primary key
        if metadata.isrc:
            return metadata.isrc

        # Fallback: generate ID from metadata
        # This is less reliable but necessary when ISRC is missing
        id_str = f"{metadata.artist}:{metadata.title}".lower()
        # Use a simple hash as ID
        import hashlib
        return hashlib.md5(id_str.encode()).hexdigest()[:16]


if __name__ == "__main__":
    # Test audio sourcing
    print("Testing Audio Sourcing...")

    sourcer = AudioSourcer()

    # Test with a well-known track
    test_track = TrackMetadata(
        title="Bohemian Rhapsody",
        artist="Queen",
        album="A Night at the Opera",
        duration_ms=354000,
        isrc="GBUM71029604"
    )

    print(f"\nSearching for: {test_track.artist} - {test_track.title}")

    # Try iTunes
    print("\nTrying iTunes...")
    itunes_result = sourcer.search_itunes(test_track)
    if itunes_result:
        print(f"  ✓ Found on iTunes")
        print(f"    Preview URL: {itunes_result.get('previewUrl')}")

    # Try Deezer
    print("\nTrying Deezer...")
    deezer_result = sourcer.search_deezer(test_track)
    if deezer_result:
        print(f"  ✓ Found on Deezer")
        print(f"    Preview URL: {deezer_result.get('preview')}")

    # Test resolve_and_fetch
    print("\nTesting resolve_and_fetch...")
    audio_path = sourcer.resolve_and_fetch(test_track)
    if audio_path:
        print(f"  ✓ Downloaded to: {audio_path}")
        print(f"  File size: {audio_path.stat().st_size / 1024:.1f} KB")

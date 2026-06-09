"""
Component 5: FastAPI Service

REST API for the LinerNotes ML service. Exposes endpoints for:
- Track analysis (with caching via catalogue)
- Similar track recommendations
- Mood-based playlists
- Personalized "For You" feed

Architecture:
- Catalogue-first: Always check catalogue before analyzing
- Async where beneficial (I/O operations)
- Error handling with proper HTTP status codes
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Tuple
from pathlib import Path
import os
import sys
import numpy as np
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from components.catalogue import TrackCatalogue
from components.track_analysis import TrackAnalyzer, TrackMetadata
from components.lyrics_nlp import LyricsAnalyzer
from components.recommenders import (
    SimilarRecommender,
    MoodPlaylistRecommender,
    ForYouRecommender
)

# Initialize FastAPI app
app = FastAPI(
    title="LinerNotes ML Service",
    description="Emotion-aware music recommendation engine",
    version="2.0.0"
)

# CORS middleware for web frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global service components (initialized on startup)
catalogue: Optional[TrackCatalogue] = None
track_analyzer: Optional[TrackAnalyzer] = None
lyrics_analyzer: Optional[LyricsAnalyzer] = None
similar_recommender: Optional[SimilarRecommender] = None
mood_recommender: Optional[MoodPlaylistRecommender] = None
foryou_recommender: Optional[ForYouRecommender] = None


# Pydantic Models
# ================

class TrackMetadataRequest(BaseModel):
    """Request model for track analysis."""
    title: str = Field(..., description="Track title")
    artist: str = Field(..., description="Artist name")
    album: Optional[str] = Field(None, description="Album name")
    duration_ms: Optional[int] = Field(None, description="Track duration in milliseconds")
    isrc: Optional[str] = Field(None, description="ISRC code (preferred for matching)")
    spotify_id: Optional[str] = Field(None, description="Spotify track ID (for reference)")

    class Config:
        json_schema_extra = {
            "example": {
                "title": "Blinding Lights",
                "artist": "The Weeknd",
                "album": "After Hours",
                "duration_ms": 200040,
                "isrc": "USUG11901221"
            }
        }


class AnalysisResponse(BaseModel):
    """Response model for track analysis."""
    track_id: str = Field(..., description="Track ID (ISRC or generated)")
    title: str
    artist: str
    analyzable: bool = Field(..., description="Whether track could be analyzed")
    valence: Optional[float] = Field(None, description="Final valence [0-1] after bimodal fusion")
    valence_audio: Optional[float] = Field(None, description="Audio-only valence")
    valence_text: Optional[float] = Field(None, description="Lyrics sentiment valence")
    arousal: Optional[float] = Field(None, description="Arousal [0-1]")
    genre: Optional[str] = Field(None, description="Predicted genre")
    genre_probs: Optional[Dict[str, float]] = Field(None, description="Genre probability distribution")
    has_lyrics: bool = Field(False, description="Whether lyrics were found")
    audio_source: Optional[str] = Field(None, description="'itunes' or 'deezer'")
    cached: bool = Field(False, description="Whether result was from cache")

    class Config:
        json_schema_extra = {
            "example": {
                "track_id": "USUG11901221",
                "title": "Blinding Lights",
                "artist": "The Weeknd",
                "analyzable": True,
                "valence": 0.68,
                "valence_audio": 0.72,
                "valence_text": 0.61,
                "arousal": 0.85,
                "genre": "pop",
                "genre_probs": {"pop": 0.82, "electronic": 0.15, "dance": 0.03},
                "has_lyrics": True,
                "audio_source": "itunes",
                "cached": False
            }
        }


class MoodPlaylistRequest(BaseModel):
    """Request model for mood-based playlist generation."""
    valence: float = Field(..., ge=0.0, le=1.0, description="Target valence [0-1]")
    arousal: float = Field(..., ge=0.0, le=1.0, description="Target arousal [0-1]")
    user_track_pool: List[str] = Field(..., description="User's track IDs to draw from")
    n: int = Field(10, ge=1, le=50, description="Number of tracks in playlist")
    genre_filter: Optional[List[str]] = Field(None, description="Optional genre restriction")

    class Config:
        json_schema_extra = {
            "example": {
                "valence": 0.7,
                "arousal": 0.6,
                "user_track_pool": ["USUG11901221", "GBUM71505969", "USAT21400346"],
                "n": 10,
                "genre_filter": None
            }
        }


class TrackRecommendation(BaseModel):
    """Single track recommendation."""
    track_id: str
    title: str
    artist: str
    score: float = Field(..., description="Recommendation score")
    reason: Optional[str] = Field(None, description="Explanation for recommendation")
    valence: Optional[float] = None
    arousal: Optional[float] = None
    genre: Optional[str] = None


class RecommendationResponse(BaseModel):
    """Response model for recommendations."""
    recommendations: List[TrackRecommendation]
    count: int

    class Config:
        json_schema_extra = {
            "example": {
                "recommendations": [
                    {
                        "track_id": "GBUM71505969",
                        "title": "Heat Waves",
                        "artist": "Glass Animals",
                        "score": 0.92,
                        "reason": "similar to your taste",
                        "valence": 0.65,
                        "arousal": 0.58,
                        "genre": "indie"
                    }
                ],
                "count": 1
            }
        }


# Startup/Shutdown Events
# =======================

@app.on_event("startup")
async def startup_event():
    """Initialize ML service components on startup."""
    global catalogue, track_analyzer, lyrics_analyzer
    global similar_recommender, mood_recommender, foryou_recommender

    # Configuration from environment variables
    CATALOGUE_DB = os.getenv("CATALOGUE_DB", "/tmp/linernotes_catalogue.db")
    MODEL_DIR = os.getenv("EMOTIFY_MODEL_DIR", "../models/emotify_v2")
    GENIUS_TOKEN = os.getenv("GENIUS_TOKEN")

    print(f"🚀 Initializing LinerNotes ML Service...")
    print(f"  Catalogue DB: {CATALOGUE_DB}")
    print(f"  Emotify Model: {MODEL_DIR}")

    # Initialize catalogue
    catalogue = TrackCatalogue(Path(CATALOGUE_DB))
    stats = catalogue.get_stats()
    print(f"  ✓ Catalogue loaded: {stats['total_tracks']} tracks, {stats['analyzable_rate']:.1%} analyzable")

    # Initialize track analyzer
    model_path = Path(__file__).parent.parent / MODEL_DIR
    if model_path.exists():
        track_analyzer = TrackAnalyzer(emotify_model_dir=model_path)
        print(f"  ✓ Track analyzer ready")
    else:
        print(f"  ⚠ Emotify model not found at {model_path} - analysis disabled")
        track_analyzer = None

    # Initialize lyrics analyzer
    if GENIUS_TOKEN:
        lyrics_analyzer = LyricsAnalyzer(genius_token=GENIUS_TOKEN)
        print(f"  ✓ Lyrics analyzer ready")
    else:
        print(f"  ⚠ GENIUS_TOKEN not set - lyrics analysis disabled")
        lyrics_analyzer = None

    # Initialize recommenders
    similar_recommender = SimilarRecommender(catalogue)
    mood_recommender = MoodPlaylistRecommender(catalogue)
    foryou_recommender = ForYouRecommender(catalogue)
    print(f"  ✓ Recommenders initialized")

    print(f"✓ ML Service ready")


@app.on_event("shutdown")
async def shutdown_event():
    """Clean up resources on shutdown."""
    global catalogue
    if catalogue:
        catalogue.close()
    print("✓ ML Service shutdown")


# Health Check
# ============

@app.get("/health")
async def health_check():
    """Service health check."""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "components": {
            "catalogue": catalogue is not None,
            "track_analyzer": track_analyzer is not None,
            "lyrics_analyzer": lyrics_analyzer is not None,
            "recommenders": all([
                similar_recommender is not None,
                mood_recommender is not None,
                foryou_recommender is not None
            ])
        },
        "catalogue_stats": catalogue.get_stats() if catalogue else None
    }


# Track Analysis Endpoints
# ========================

@app.post("/analyze/track", response_model=AnalysisResponse)
async def analyze_track(
    request: TrackMetadataRequest,
    background_tasks: BackgroundTasks,
    force_reanalyze: bool = False
):
    """
    Analyze a track or retrieve cached features.

    Strategy:
    1. Check catalogue for existing analysis (unless force_reanalyze=True)
    2. If not found, trigger analysis:
       - Resolve to preview clip (iTunes/Deezer)
       - Run Emotify analysis
       - Fetch and analyze lyrics
       - Fuse bimodal valence
       - Store in catalogue
    3. Return analysis results

    Parameters:
    - force_reanalyze: Bypass cache and re-analyze from scratch
    """
    if catalogue is None:
        raise HTTPException(status_code=503, detail="Catalogue not initialized")

    # Step 1: Check catalogue
    track_id = request.isrc or f"{request.artist}_{request.title}".replace(" ", "_")

    if not force_reanalyze:
        # Try ISRC lookup first
        if request.isrc:
            cached_track = catalogue.get_track_by_isrc(request.isrc)
        else:
            cached_track = catalogue.get_track(track_id)

        # Fallback to fuzzy search
        if not cached_track:
            matches = catalogue.search_by_artist_title(request.artist, request.title, fuzzy=True)
            if matches:
                cached_track = matches[0]

        if cached_track:
            # Return cached result
            return AnalysisResponse(
                track_id=cached_track['track_id'],
                title=cached_track['title'],
                artist=cached_track['artist'],
                analyzable=cached_track['analyzable'],
                valence=cached_track['valence'],
                valence_audio=None,  # Not stored separately
                valence_text=None,   # Not stored separately
                arousal=cached_track['arousal'],
                genre=cached_track['genre'],
                genre_probs=cached_track.get('genre_probs'),
                has_lyrics=cached_track['has_lyrics'],
                audio_source=cached_track.get('audio_source'),
                cached=True
            )

    # Step 2: Analyze track
    if track_analyzer is None:
        raise HTTPException(status_code=503, detail="Track analyzer not available (model not loaded)")

    metadata = TrackMetadata(
        title=request.title,
        artist=request.artist,
        album=request.album,
        duration_ms=request.duration_ms,
        isrc=request.isrc
    )

    # Analyze audio
    audio_result = track_analyzer.analyze_from_metadata(metadata)

    if not audio_result or not audio_result.get('analyzable'):
        # Track not analyzable (no preview clip found)
        # Store as non-analyzable
        catalogue.add_track(
            track_id=track_id,
            title=request.title,
            artist=request.artist,
            album=request.album,
            isrc=request.isrc,
            duration_ms=request.duration_ms,
            analyzable=False
        )

        return AnalysisResponse(
            track_id=track_id,
            title=request.title,
            artist=request.artist,
            analyzable=False,
            cached=False
        )

    # Analyze lyrics (if available)
    valence_text = None
    lyric_embedding = None
    has_lyrics = False

    if lyrics_analyzer:
        lyrics_result = lyrics_analyzer.analyze_lyrics(request.title, request.artist)
        if lyrics_result['has_lyrics']:
            valence_text = lyrics_result['valence_text']
            lyric_embedding = lyrics_result['lyric_embedding']
            has_lyrics = True

    # Fuse bimodal valence
    valence_audio = audio_result.get('valence_audio')
    if valence_text is not None and lyrics_analyzer:
        valence_final = lyrics_analyzer.fuse_bimodal_valence(valence_audio, valence_text)
    else:
        valence_final = valence_audio

    # Store in catalogue
    catalogue.add_track(
        track_id=track_id,
        title=request.title,
        artist=request.artist,
        album=request.album,
        isrc=request.isrc,
        duration_ms=request.duration_ms,
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

    return AnalysisResponse(
        track_id=track_id,
        title=request.title,
        artist=request.artist,
        analyzable=True,
        valence=valence_final,
        valence_audio=valence_audio,
        valence_text=valence_text,
        arousal=audio_result.get('arousal'),
        genre=audio_result.get('genre'),
        genre_probs=audio_result.get('genre_probs'),
        has_lyrics=has_lyrics,
        audio_source=audio_result.get('audio_source'),
        cached=False
    )


# Recommendation Endpoints
# ========================

@app.get("/recommend/similar", response_model=RecommendationResponse)
async def recommend_similar(
    track_id: str,
    n: int = 10,
    genre_strict: bool = True,
    user_track_pool: Optional[str] = None  # Comma-separated track IDs
):
    """
    "Songs like this" - genre-aware similar track recommendations.

    Strategy: Restrict to seed's genre (+ adjacent genres) if genre_strict=True,
    then rank by track_vector cosine similarity.

    Parameters:
    - track_id: Seed track ID
    - n: Number of recommendations
    - genre_strict: Enforce genre filtering (default True for cohesion)
    - user_track_pool: Optional comma-separated track IDs to restrict candidates
    """
    if similar_recommender is None:
        raise HTTPException(status_code=503, detail="Recommender not initialized")

    # Parse user track pool
    pool = user_track_pool.split(",") if user_track_pool else None

    # Get recommendations
    try:
        recs = similar_recommender.recommend(
            seed_track_id=track_id,
            n=n,
            genre_strict=genre_strict,
            user_track_pool=pool
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Recommendation failed: {str(e)}")

    # Enrich with track metadata
    recommendations = []
    for rec_id, score in recs:
        track = catalogue.get_track(rec_id)
        if track:
            recommendations.append(TrackRecommendation(
                track_id=rec_id,
                title=track['title'],
                artist=track['artist'],
                score=score,
                reason="similar to seed track",
                valence=track.get('valence'),
                arousal=track.get('arousal'),
                genre=track.get('genre')
            ))

    return RecommendationResponse(
        recommendations=recommendations,
        count=len(recommendations)
    )


@app.post("/recommend/mood", response_model=RecommendationResponse)
async def recommend_mood(request: MoodPlaylistRequest):
    """
    Mood-based playlist generation.

    Strategy: KDTree search over (valence, arousal) space within user's track pool,
    with optional genre filter. Emotion matters most.
    """
    if mood_recommender is None:
        raise HTTPException(status_code=503, detail="Recommender not initialized")

    # Get recommendations
    try:
        recs = mood_recommender.recommend(
            valence=request.valence,
            arousal=request.arousal,
            user_track_pool=request.user_track_pool,
            n=request.n,
            genre_filter=request.genre_filter
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Recommendation failed: {str(e)}")

    # Enrich with track metadata
    recommendations = []
    for rec_id, distance in recs:
        track = catalogue.get_track(rec_id)
        if track:
            # Convert distance to score (lower distance = higher score)
            score = 1.0 / (1.0 + distance)

            recommendations.append(TrackRecommendation(
                track_id=rec_id,
                title=track['title'],
                artist=track['artist'],
                score=score,
                reason=f"matches mood (v={request.valence:.2f}, a={request.arousal:.2f})",
                valence=track.get('valence'),
                arousal=track.get('arousal'),
                genre=track.get('genre')
            ))

    return RecommendationResponse(
        recommendations=recommendations,
        count=len(recommendations)
    )


@app.get("/recommend/foryou", response_model=RecommendationResponse)
async def recommend_foryou(
    user_id: int,
    n: int = 20,
    user_track_history: Optional[str] = None,  # Comma-separated track IDs
    mood_valence: Optional[float] = None,
    mood_arousal: Optional[float] = None,
    friend_listening: Optional[str] = None,  # Comma-separated track IDs
    thumbs_down: Optional[str] = None  # Comma-separated track IDs
):
    """
    Personalized "For You" feed.

    Strategy: Hybrid CF + content + emotion with re-ranking.
    Combines collaborative filtering (if available) with content similarity
    to user's listening history, boosted by mood matching and social signals.

    Parameters:
    - user_id: User ID (for CF if available)
    - n: Number of recommendations
    - user_track_history: User's listening history (comma-separated track IDs)
    - mood_valence: Optional mood boost target valence
    - mood_arousal: Optional mood boost target arousal
    - friend_listening: Tracks friends are listening to (social boost)
    - thumbs_down: Tracks user has thumbed down (exclude)
    """
    if foryou_recommender is None:
        raise HTTPException(status_code=503, detail="Recommender not initialized")

    # Parse parameters
    history = user_track_history.split(",") if user_track_history else []
    friends = friend_listening.split(",") if friend_listening else None
    thumbs = thumbs_down.split(",") if thumbs_down else None
    mood_boost = (mood_valence, mood_arousal) if mood_valence is not None and mood_arousal is not None else None

    if not history:
        raise HTTPException(status_code=400, detail="user_track_history required for For You recommendations")

    # Get recommendations
    try:
        recs = foryou_recommender.recommend(
            user_id=user_id,
            user_track_history=history,
            n=n,
            mood_boost=mood_boost,
            friend_listening=friends,
            thumbs_down=thumbs
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Recommendation failed: {str(e)}")

    # Enrich with track metadata
    recommendations = []
    for rec_id, score, reason in recs:
        track = catalogue.get_track(rec_id)
        if track:
            recommendations.append(TrackRecommendation(
                track_id=rec_id,
                title=track['title'],
                artist=track['artist'],
                score=score,
                reason=reason,
                valence=track.get('valence'),
                arousal=track.get('arousal'),
                genre=track.get('genre')
            ))

    return RecommendationResponse(
        recommendations=recommendations,
        count=len(recommendations)
    )


# Catalogue Query Endpoints
# =========================

@app.get("/catalogue/stats")
async def get_catalogue_stats():
    """Get catalogue statistics."""
    if catalogue is None:
        raise HTTPException(status_code=503, detail="Catalogue not initialized")

    return catalogue.get_stats()


@app.get("/catalogue/track/{track_id}")
async def get_track(track_id: str):
    """Get track features by ID."""
    if catalogue is None:
        raise HTTPException(status_code=503, detail="Catalogue not initialized")

    track = catalogue.get_track(track_id)

    if track is None:
        raise HTTPException(status_code=404, detail=f"Track {track_id} not found in catalogue")

    # Remove binary embeddings from response
    return {
        "track_id": track['track_id'],
        "title": track['title'],
        "artist": track['artist'],
        "album": track.get('album'),
        "valence": track.get('valence'),
        "arousal": track.get('arousal'),
        "genre": track.get('genre'),
        "genre_probs": track.get('genre_probs'),
        "has_lyrics": track.get('has_lyrics'),
        "analyzable": track.get('analyzable'),
        "audio_source": track.get('audio_source'),
        "created_at": track.get('created_at'),
        "updated_at": track.get('updated_at')
    }


if __name__ == "__main__":
    import uvicorn

    # Run with: python api/main.py
    # Or: uvicorn api.main:app --reload --host 0.0.0.0 --port 8000

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )

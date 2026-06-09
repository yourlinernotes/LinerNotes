"""
LinerNotes ML Service Components

Components for the complete ML pipeline:
- Component 0: Audio sourcing (iTunes/Deezer)
- Component 1: Track analysis (wraps Emotify)
- Component 2: Lyrics NLP (Genius + SBERT)
- Component 3: Track catalogue (feature storage)
- Component 4: Recommenders (similar/mood/foryou)
"""

__version__ = "1.0.0"

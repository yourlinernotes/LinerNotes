"""
Emotify - Emotion and Genre Prediction from Raw Audio

Tri-head model architecture:
- Frozen pretrained audio trunk (OpenL3 or PANNs)
- Valence prediction head
- Arousal prediction head
- Genre classification head
"""

__version__ = "2.0.0"
__author__ = "Anusha"

from .analyze import analyze

__all__ = ["analyze"]

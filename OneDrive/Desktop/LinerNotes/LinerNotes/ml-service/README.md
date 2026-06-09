# LinerNotes ML Service

Complete Python ML microservice for emotion-based music recommendations.

**Built following the rebuild specs to avoid deprecated Spotify APIs.**

---

## Architecture Overview

### Emotify Model (Rebuilt)
**Input**: Raw audio → log-mel-spectrogram
**Architecture**: Frozen pretrained trunk + 3 lightweight heads
**Output**: `{valence, arousal, genre, genre_probs, embedding}`

```
Audio file (30s clip)
    ↓
Log-Mel-Spectrogram (128 mels × 1292 frames)
    ↓
Frozen Trunk (OpenL3 512-dim or PANNs 2048-dim)
    ↓
├── Valence Head → [0, 1]
├── Arousal Head → [0, 1]
└── Genre Head → softmax over classes
```

**Key Innovation**: Trunk is frozen, heads train separately on disjoint datasets:
- Valence/Arousal heads: Trained on MUSE dataset
- Genre head: Trained on FMA (Free Music Archive)

This sidesteps the joint-training problem and gives genre-aware embeddings for free.

---

## Critical Design Decisions

### 1. No Spotify Audio Features
**Problem**: Spotify deprecated `audio-features`, `audio-analysis`, and `preview_url` (2024-11-27).
**Solution**: Process raw audio from iTunes/Deezer preview clips.

### 2. ISRC-First Track Matching
**Problem**: Spotify library → ML features requires cross-service matching.
**Solution**: Use ISRC from `external_ids.isrc`, fallback to fuzzy artist+title+duration matching.

### 3. Shared Feature Catalogue
**Problem**: Running Emotify on every request is too slow.
**Solution**: Analyze each track ONCE, store features keyed by ISRC, lookup at request time.

### 4. Bimodal Emotion
**Problem**: Audio-only emotion ignores lyrical content.
**Solution**: Fuse audio valence with text valence from Genius lyrics sentiment.

```
valence_final = w_audio * valence_audio + w_text * valence_text
```

### 5. Genre-Aware Recommendations
**Problem**: Pure emotion matching produces genre-incoherent results.
**Solution**: Different strictness per surface:
- **"Songs like this"**: Genre-strict (same/adjacent genres only)
- **Mood playlist**: Genre-loose (mood first, genre optional)
- **For You**: Hybrid (CF + content + emotion)

---

## Project Structure

```
ml-service/
├── emotify/                    # Rebuilt Emotify model
│   ├── audio_preprocessing.py  # Log-mel-spectrogram generation
│   ├── trunk.py                # Frozen OpenL3/PANNs wrapper
│   ├── heads.py                # Valence/Arousal/Genre heads
│   ├── analyze.py              # Main inference: analyze(audio_path)
│   └── train.py                # Training script for MUSE/FMA
│
├── components/                 # ML service components
│   ├── audio_sourcing.py       # Component 0: iTunes/Deezer resolution
│   ├── track_analysis.py       # Component 1: Wraps Emotify
│   ├── lyrics_nlp.py           # Component 2: Genius + SBERT
│   ├── catalogue.py            # Component 3: Feature storage
│   └── recommenders.py         # Component 4: Similar/Mood/ForYou
│
├── api/
│   └── main.py                 # FastAPI service
│
├── scripts/
│   └── build_catalogue.py      # Catalogue builder pipeline
│
├── models/                     # Trained weights
│   └── emotify_v2/
│       ├── valence_head.weights.h5
│       ├── arousal_head.weights.h5
│       ├── genre_head.weights.h5
│       └── genre_labels.json
│
├── data/                       # Training data (not in git)
│   ├── muse_v3.csv
│   ├── muse_embeddings.npy
│   ├── fma_metadata/
│   └── fma_medium_embeddings.npy
│
├── requirements.txt
└── README.md
```

---

## Components Status

### ✓ Built
- [x] Emotify audio preprocessing (log-mel-spectrogram)
- [x] Frozen trunk wrapper (OpenL3/PANNs)
- [x] Three prediction heads (valence/arousal/genre)
- [x] Training script for MUSE/FMA
- [x] `analyze()` inference function
- [x] Component 0: Audio sourcing (iTunes/Deezer)

### 🔨 In Progress
- [ ] Component 1: Track analysis wrapper
- [ ] Component 2: Lyrics NLP (Genius + SBERT)
- [ ] Component 3: Track catalogue storage
- [ ] Component 4: Recommenders
- [ ] Component 5: FastAPI service
- [ ] Component 6: Catalogue builder pipeline

---

## Setup

### 1. Install Dependencies
```bash
cd ml-service
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Download Training Data

**MUSE Dataset** (emotion labels):
```bash
# Download from Zenodo
wget https://zenodo.org/record/3989267/files/MUSE_v3.csv
mv MUSE_v3.csv data/muse_v3.csv
```

**FMA Dataset** (genre labels):
```bash
# Download FMA medium (30GB)
# https://github.com/mdeff/fma
wget https://os.unil.cloud.switch.ch/fma/fma_medium.zip
unzip fma_medium.zip -d data/
```

### 3. Train Emotify Heads

```bash
# Train valence head on MUSE
python -m emotify.train --dataset muse --head valence --epochs 100

# Train arousal head on MUSE
python -m emotify.train --dataset muse --head arousal --epochs 100

# Train genre head on FMA
python -m emotify.train --dataset fma --head genre --epochs 100
```

This will save trained weights to `models/emotify_v2/`.

### 4. Test Emotify Inference

```python
from emotify import load_model, analyze

# Load trained model
load_model('models/emotify_v2')

# Analyze a preview clip
result = analyze('preview.mp3')

print(f"Valence: {result['valence']:.2f}")
print(f"Arousal: {result['arousal']:.2f}")
print(f"Genre: {result['genre']}")
# Rich embedding for recommendations:
print(f"Embedding: {result['embedding'].shape}")
```

### 5. Run FastAPI Service (Once Complete)

```bash
uvicorn api.main:app --reload --port 8001
```

---

## API Endpoints (Planned)

```
POST /analyze/track
  → Analyze a track, cache features, return representation

GET /recommend/similar?track_id=&genre_strict=
  → Genre-aware "songs like this"

POST /recommend/mood
  → Body: {valence, arousal, user_id, genre_strict?}
  → Returns KDTree mood-matched tracks

GET /recommend/foryou?user_id=
  → Hybrid feed (CF + content + emotion)
```

---

## Acceptance Criteria

Per the rebuild spec, the ML service must:

### Emotify Model
- [x] `analyze()` runs end-to-end on a sample MP3
- [ ] Genre predictions are sane (macro-F1 reported)
- [ ] Two tracks of same genre but different emotion are far in (valence, arousal), close in genre
- [x] Zero references to deprecated Spotify endpoints

### ML Service
- [x] Audio sourced only from iTunes/Deezer (Component 0 built)
- [ ] ISRC-first matching works with measured match rate
- [ ] `/recommend/similar` returns genre-coherent results
- [ ] `/recommend/mood` respects genre strictness
- [ ] Lyric features present when available, absent for instrumentals
- [ ] No raw lyric text stored (only embeddings/sentiment)
- [ ] All track features read from catalogue (no per-request recomputation)

---

## Datasets

### MUSE v3 (Emotion)
- **Size**: 90,000+ tracks
- **Labels**: Valence, Arousal (continuous [0-9], normalized to [0-1])
- **Source**: https://zenodo.org/record/3989267
- **Use**: Train valence/arousal heads

### FMA (Free Music Archive) - Genre
- **Size**:
  - Small: 8,000 tracks
  - Medium: 25,000 tracks
  - Large: 106,000 tracks
- **Labels**: Genre hierarchy (8 top-level genres)
- **Source**: https://github.com/mdeff/fma
- **Use**: Train genre head

---

## Performance Targets

### Emotify Model
| Metric | Target | Dataset |
|--------|--------|---------|
| Valence MAE | < 0.10 | MUSE test set |
| Arousal MAE | < 0.10 | MUSE test set |
| Valence R² | > 0.60 | MUSE test set |
| Arousal R² | > 0.60 | MUSE test set |
| Genre Accuracy | > 0.70 | FMA test set |
| Genre Macro-F1 | > 0.65 | FMA test set |

### ML Service
| Metric | Target |
|--------|--------|
| Audio resolution (iTunes/Deezer) | > 90% |
| ISRC match rate | > 85% |
| Lyric fetch rate (Genius) | > 80% |
| Catalogue lookup time | < 5ms |
| Recommendation latency | < 100ms |

---

## Comparison to Old Emotify

| Aspect | Old (A-Level) | New (Rebuild) |
|--------|---------------|---------------|
| **Input** | Spotify audio features | Raw audio (log-mel-spectrogram) |
| **Architecture** | 128→64→32 dual-head | Frozen trunk + 3 heads |
| **Outputs** | Valence, Arousal | Valence, Arousal, Genre, Embedding |
| **Training** | End-to-end on MUSE | Heads-only on MUSE + FMA |
| **Spotify dependency** | YES (broken) | NO (fully independent) |
| **Recommendations** | KDTree on (valence, arousal) | Rich embedding + genre-aware |
| **Production viable** | NO | YES |

---

## Next Steps

1. Complete remaining components (1-6)
2. Build catalogue from user library seeds
3. Deploy FastAPI service to Railway
4. Integrate with NestJS backend
5. A/B test recommendation quality

---

**Generated**: 2026-06-09
**Status**: Emotify model complete, components in progress

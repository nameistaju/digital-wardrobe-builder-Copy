# AI Worker Service (Planned for Future Phases)

## Overview

The `ai-worker` module will host the background worker and inference service responsible for:
- Extracting individual clothing items from full-body photographs.
- Background removal and garment segmentation (e.g., tops, bottoms, outerwear, footwear, accessories).
- Pre-processing images and storing isolated garment assets into the digital wardrobe storage.

## Phase 1 Status

> **Notice**: As per the Phase 1 architectural roadmap, the AI worker is not active in this phase. No AI models, heavy ML dependencies (PyTorch, SAM 2, SCHP), or GPU workers are installed in Phase 1 to maintain a zero-budget, lightweight foundational environment.

Implementation will begin in Phase 2.

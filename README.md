# Digital Wardrobe Builder

A production-minded, zero-budget Digital Wardrobe Builder that digitizes clothing items, leverages AI vision for background removal and garment extraction from full-body photos, catalogs garments with rich metadata, and provides an interactive Outfit Styling Studio with drag-and-drop layering and PNG image export.

---

## 1. Complete Architecture & Tech Stack

| Layer | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Frontend** | Next.js (App Router), React, TypeScript | 16.4.3 (React 19) | Minimal fashion-tech UI, state management, interactive canvas |
| **Styling** | Tailwind CSS v4, Lucide Icons | Latest | Responsive layout, warm off-white tones, accessible controls |
| **Backend** | Python FastAPI & Uvicorn | >= 0.115.0 | Async REST API, CORS middleware, background worker tasks |
| **Database & ORM** | SQLAlchemy 2.0 & Alembic | 2.0+ / 1.13+ | Async DB access, migrations, user isolation (SQLite / PostgreSQL) |
| **Authentication** | JWT (python-jose) & bcrypt | Latest | Secure token-based auth, password hashing, demo guest mode |
| **AI Segmentation** | Pillow & modular SCHP / rembg adapter | Latest | Zero-budget alpha isolation, human clothing anatomical parsing |
| **Image Storage** | Local Storage Service Adapter | Standard | UUID-hashed secure storage with MIME validation & static serving |
| **Testing** | Pytest, FastAPI TestClient, HTTPX | 9.x / Latest | 8 automated tests covering auth, garments, extraction & outfits |

---

## 2. Directory Structure

```text
digital-wardrobe/
├── frontend/
│   ├── app/
│   │   ├── favicon.ico
│   │   ├── globals.css           # Fashion-tech aesthetic variables
│   │   ├── layout.tsx            # Metadata and fonts
│   │   └── page.tsx              # Dynamic view: Wardrobe Catalog / Outfit Studio
│   ├── components/
│   │   ├── AuthModal.tsx         # Login, Register & Instant One-Click Demo Mode
│   │   ├── BackendStatusBadge.tsx# Live API health monitor
│   │   ├── EmptyState.tsx        # Empty wardrobe prompt & upload CTA
│   │   ├── Footer.tsx            # Minimalist project footer
│   │   ├── FullOutfitExtractionFlow.tsx # Asynchronous AI outfit segmentation & candidate review
│   │   ├── IndividualUploadForm.tsx     # Single garment upload with background removal
│   │   ├── Navbar.tsx            # Brand header, navigation & user profile
│   │   ├── OutfitBuilder.tsx     # Drag-and-drop studio canvas, layering & PNG export
│   │   ├── UploadModal.tsx       # Ingestion selector (Individual vs. Full Outfit)
│   │   └── WardrobeCatalog.tsx   # Search, category pills, season filter, favorites, edit & delete
│   ├── lib/
│   │   └── api.ts                # Type-safe API client for all backend endpoints
│   ├── package.json
│   └── tsconfig.json             # TypeScript strict configuration
├── backend/
│   ├── alembic/                  # Database migration versions
│   ├── app/
│   │   ├── api/
│   │   │   ├── deps.py           # JWT Authentication dependency (get_current_user)
│   │   │   └── v1/
│   │   │       ├── auth.py       # Register, login, /me, demo guest mode
│   │   │       ├── extraction.py # Asynchronous full-body AI garment extraction & review
│   │   │       ├── garments.py   # Upload, list, filter, update, delete garments
│   │   │       ├── health.py     # GET /api/v1/health
│   │   │       └── outfits.py    # Save outfit layouts, list, update & delete
│   │   ├── core/
│   │   │   ├── config.py         # Pydantic Settings & environment loader
│   │   │   ├── database.py       # Async SQLAlchemy engine & session factory
│   │   │   ├── security.py       # Password hashing & JWT generation
│   │   │   └── storage.py        # Local storage adapter with traversal guards
│   │   ├── models/               # SQLAlchemy DB models: User, Garment, Outfit, ExtractionJob
│   │   ├── schemas/              # Pydantic request/response schemas
│   │   ├── services/
│   │   │   └── ai_segmentation.py# Background removal & full-body clothing segmentation
│   │   └── main.py               # FastAPI entry point & lifespan DB initialization
│   ├── tests/
│   │   ├── conftest.py           # Pytest DB setup fixture
│   │   ├── test_auth.py          # User registration, login & profile tests
│   │   ├── test_extraction.py    # Full-body AI extraction & approval tests
│   │   ├── test_garments.py      # Garment upload, filtering, CRUD & isolation tests
│   │   ├── test_health.py        # Health endpoint & CORS tests
│   │   └── test_outfits.py       # Outfit canvas persistence & retrieval tests
│   ├── requirements.txt
│   └── .env.example
├── storage/                      # Image asset storage (garments, outfits, candidates)
├── verify-all.ps1                # Single-command full-stack test verification script
├── docker-compose.yml            # Container definitions
└── README.md
```

---

## 3. Quick Start (Windows PowerShell)

### Step 1: Run All Automated Verification Checks
Verify that the entire system compiles and all 8 backend automated tests pass:
```powershell
powershell -ExecutionPolicy Bypass -File .\verify-all.ps1
```

### Step 2: Start the Backend (Terminal 1)
```powershell
cd backend
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
- API Base URL: `http://127.0.0.1:8000`
- Interactive API Docs: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- Health Status: [http://127.0.0.1:8000/api/v1/health](http://127.0.0.1:8000/api/v1/health)

### Step 3: Start the Frontend (Terminal 2)
```powershell
cd frontend
npm run dev -- --port 3000
```
- Web Application: [http://localhost:3000](http://localhost:3000)

---

## 4. Feature Highlights

### 1. Ingestion Pathways
- **Individual Garment Upload**: Upload tops, bottoms, shoes, bags, or accessories with automated background removal, category assignment, colors, seasons, and notes.
- **Full Outfit Photo (AI Extraction)**: Upload a full-body photograph. The async worker parses human clothing regions (tops, bottoms, footwear, accessories), performs transparent cutout extraction, and surfaces an interactive review interface to approve, edit, or reject candidate pieces into the wardrobe.

### 2. Wardrobe Management
- Instant category tabs with live counts (Tops, Bottoms, Outerwear, Shoes, Bags, Accessories, Dresses/Jumpsuits).
- Live search across names, brands, colors, and style tags.
- Season filter (Spring, Summer, Fall, Winter, All).
- Favorites heart filter with instant state persistence.
- In-place metadata editing and delete confirmations.

### 3. Outfit Styling Studio
- **Interactive Canvas**: Drag and drop clothing items freely, resize, reposition (x, y), and control layering order (Bring Forward, Send Backward, Bring to Front, Send to Back).
- **Client-Side PNG Export**: High-resolution studio canvas render with transparent cutouts, warm studio backdrop, and timestamped look metadata downloaded instantly as PNG.
- **Saved Outfits Persistence**: Save outfit layouts and load them back into the canvas at any time for restyling.

### 4. Zero-Budget Database Architecture
- Uses **SQLAlchemy 2.0** with async connections.
- Defaults out-of-the-box to **SQLite (`aiosqlite`)** for zero-setup local development without requiring external database servers or Docker.
- Supports **PostgreSQL (`asyncpg`)** in production by simply changing `DATABASE_URL` in `.env`.
- Database schema changes are managed cleanly via **Alembic migrations**.

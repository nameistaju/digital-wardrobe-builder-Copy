# Digital Wardrobe Builder — Phase 1: Project Foundation

A production-minded, zero-budget Digital Wardrobe Builder designed to organize garments into a personal digital capsule, eventually leveraging AI vision models to isolate clothing items from full-body photographs.

This repository represents **Phase 1: Project Setup, Application Foundation, and Local Development Environment**. Future phases will introduce database persistence, storage pipelines, segmentation models, and outfit composition.

---

## 1. Architecture & Tech Stack

| Layer | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Frontend** | Next.js (App Router) | 16.x (React 19) | Modern, responsive fashion-tech web interface |
| **Styling** | Tailwind CSS v4 & Lucide React | Latest | Off-white aesthetic, accessible controls, vector icons |
| **Backend** | Python FastAPI | >= 0.115.0 | Async REST API, CORS configuration, health checks |
| **Server** | Uvicorn (Standard) | >= 0.30.0 | High-performance ASGI web server |
| **Testing** | Pytest & FastAPI TestClient (HTTPX) | Latest | Backend unit and integration test runner |
| **Package Managers** | npm & Python pip (venv) | Latest | Zero-budget, open-source dependency management |

---

## 2. Project Directory Structure

```text
digital-wardrobe/
├── frontend/                     # Next.js App Router frontend application
│   ├── app/                      # Layout, root page, and global styling
│   │   ├── favicon.ico
│   │   ├── globals.css           # Warm off-white / stone color tokens
│   │   ├── layout.tsx            # Metadata and root font wrappers
│   │   └── page.tsx              # Landing shell & empty wardrobe view
│   ├── components/               # Small, accessible UI components
│   │   ├── BackendStatusBadge.tsx# Live API connection indicator
│   │   ├── EmptyState.tsx        # Empty wardrobe prompt & CTA
│   │   ├── Footer.tsx            # Minimalist footer
│   │   ├── Navbar.tsx            # Brand header & navigation
│   │   ├── UploadModal.tsx       # Ingestion options dialog (Esc-enabled)
│   │   └── UploadOptionCards.tsx # Reusable Full Outfit vs. Item cards
│   ├── lib/
│   │   └── api.ts                # Backend health fetcher utility
│   ├── public/                   # Static assets
│   ├── .env.example              # Frontend environment template
│   ├── .env.local                # Local development variables (git-ignored)
│   ├── Dockerfile                # Optional container configuration
│   ├── package.json              # Frontend dependencies and scripts
│   └── tsconfig.json             # TypeScript strict configuration
├── backend/                      # FastAPI backend application
│   ├── app/
│   │   ├── api/
│   │   │   └── v1/
│   │   │       ├── health.py     # GET /api/v1/health status endpoint
│   │   │       └── __init__.py   # Router mounting
│   │   ├── core/
│   │   │   └── config.py         # Pydantic Settings & CORS validator
│   │   ├── schemas/
│   │   │   └── health.py         # HealthResponse schema
│   │   └── main.py               # FastAPI entry point & CORS middleware
│   ├── tests/
│   │   ├── test_health.py        # Automated health & CORS unit tests
│   │   └── __init__.py
│   ├── .env.example              # Backend environment template
│   ├── .env                      # Local development variables (git-ignored)
│   ├── Dockerfile                # Optional container configuration
│   └── requirements.txt          # Python dependencies
├── ai-worker/                    # Planned background AI segmentation worker
│   └── README.md                 # Architecture roadmap (Phase 2+)
├── storage/                      # Local asset storage directory (Phase 2+)
│   └── .gitkeep
├── .gitignore                    # Git ignore file for secrets and caches
├── docker-compose.yml            # Optional container composition
└── README.md                     # Comprehensive project documentation
```

---

## 3. Prerequisites & Environment Check

Before getting started, ensure the following tools are installed on your Windows machine:

- **Node.js**: `v20.x` or `v24.x` (LTS recommended)
- **npm**: `v10.x` or `v11.x`
- **Python**: `3.11` to `3.13`
- **Git**: `2.x`

### Verify Installations in Windows PowerShell

Open Windows PowerShell and run:

```powershell
node -v
npm -v
python --version
git --version
```

If any command is not recognized, install the missing software from their official websites:
- Node.js: [https://nodejs.org/](https://nodejs.org/)
- Python: [https://www.python.org/](https://www.python.org/) (ensure "Add Python to PATH" is checked during installation)
- Git: [https://git-scm.com/](https://git-scm.com/)

---

## 4. Setup & Installation (Windows PowerShell)

Clone the repository and enter the project folder:

```powershell
git clone <repository-url>
cd wodrobe
```

### 4.1 Backend Setup

1. **Navigate to the backend directory**:
   ```powershell
   cd backend
   ```

2. **Create a Python virtual environment**:
   ```powershell
   python -m venv venv
   ```

3. **Activate the virtual environment**:
   ```powershell
   .\venv\Scripts\Activate.ps1
   ```
   > *Note on Execution Policies*: If PowerShell blocks script execution, run:
   > `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`

4. **Install Python dependencies**:
   ```powershell
   python -m pip install --upgrade pip
   pip install -r requirements.txt
   ```

5. **Configure environment variables**:
   ```powershell
   Copy-Item .env.example .env
   ```
   Default values inside `backend/.env`:
   ```env
   APP_ENV=development
   FRONTEND_ORIGIN=http://localhost:3000
   HOST=127.0.0.1
   PORT=8000
   ```

6. **Run backend tests**:
   ```powershell
   pytest
   ```

---

### 4.2 Frontend Setup

1. **Open a second terminal and navigate to the frontend directory**:
   ```powershell
   cd frontend
   ```

2. **Install npm dependencies**:
   ```powershell
   npm install
   ```

3. **Configure environment variables**:
   ```powershell
   Copy-Item .env.example .env.local
   ```
   Default value inside `frontend/.env.local`:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```

4. **Verify TypeScript compilation**:
   ```powershell
   npm run build
   ```

---

## 5. Running the Application Locally

Run the frontend and backend in separate terminal windows:

### Terminal 1: Backend API (FastAPI)

```powershell
cd backend
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
- API Base URL: `http://127.0.0.1:8000`
- API Health Status: [http://127.0.0.1:8000/api/v1/health](http://127.0.0.1:8000/api/v1/health)
- Interactive API Docs (Swagger): [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

### Terminal 2: Frontend Web App (Next.js)

```powershell
cd frontend
npm run dev -- --port 3000
```
- Web Application: [http://localhost:3000](http://localhost:3000)

The frontend includes a live backend status badge that pings the FastAPI `/api/v1/health` endpoint and displays a green indicator with API version `v0.1.0`.

---

## 6. Testing

### Run Backend Unit & Integration Tests

From the `backend/` directory:

```powershell
cd backend
.\venv\Scripts\pytest
```

Expected output:
```text
tests/test_health.py ... [100%]
======================== 3 passed in 0.73s ========================
```

The test suite validates:
1. `GET /api/v1/health` returns status HTTP 200 with JSON payload (`status`, `app`, `version`, `environment`).
2. `GET /` root endpoint returns HTTP 200 with links to documentation and health check.
3. CORS headers are returned properly for the configured `FRONTEND_ORIGIN`.

---

## 7. Optional Docker Usage

Docker is not mandatory for Phase 1. If you prefer containerized local development, you can start both services with:

```powershell
docker compose up --build
```

---

## 8. Troubleshooting Common Errors

### 1. Port 8000 or 3000 Already in Use
- Check which process is occupying the port:
  ```powershell
  Get-Process -Id (Get-NetTCPConnection -LocalPort 8000).OwningProcess
  ```
- Change the port in `.env` (backend) or `.env.local` / `npm run dev -- -p 3001` (frontend).

### 2. PowerShell Script Execution Disabled
If running `.\venv\Scripts\Activate.ps1` produces `PSSecurityException`:
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\venv\Scripts\Activate.ps1
```

### 3. CORS Connection Errors in Frontend
- Check `backend/.env`: verify `FRONTEND_ORIGIN` matches the exact URL of the frontend (e.g. `http://localhost:3000`).
- Ensure no trailing slashes in origin configurations.
- Verify that `NEXT_PUBLIC_API_URL` in `frontend/.env.local` points to `http://localhost:8000`.

### 4. Deprecated or Missing Dependencies
- If pip warns about outdated tools:
  ```powershell
  python -m pip install --upgrade pip
  ```
- If node packages need a clean reinstall:
  ```powershell
  cd frontend
  Remove-Item -Recurse -Force node_modules
  npm install
  ```

---

## 9. Roadmap to Phase 2

- **Phase 1 (Completed)**: Project setup, Next.js dashboard shell, FastAPI modular structure, CORS, health endpoints, environment configuration, and verification tests.
- **Phase 2 (Upcoming)**: Local storage pipeline, database schema (PostgreSQL), manual image upload endpoints, and background worker queue for AI garment segmentation.

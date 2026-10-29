# Digital Wardrobe Builder — Cloud Integration & Deployment Guide

A production-minded, zero-budget Digital Wardrobe Builder designed to digitize personal garments, provide an interactive Outfit Styling Studio with drag-and-drop layering, export looks as PNG, and leverage AI vision and background removal.

This project supports **zero-setup local development** (Windows PowerShell, SQLite, local disk storage) and is fully architected for **zero-cost cloud deployment**:
- **Frontend Hosting:** Vercel (Next.js 16, React 19, TypeScript, Tailwind CSS v4)
- **Backend Hosting:** Render Web Service (FastAPI, Uvicorn, Python 3.13)
- **Database:** Supabase PostgreSQL (SQLAlchemy 2.0 Async + asyncpg + Alembic migrations)
- **Image Storage:** Cloudflare R2 Object Storage (Private S3-compatible bucket, zero egress fees)

---

## 1. Cloud Architecture Overview

```text
[ Vercel CDN ]                                    [ Render Free Web Service ]
  Next.js 16 (React 19)                             FastAPI + Uvicorn
  TypeScript + Tailwind v4                          (Port $PORT, 0.0.0.0)
         |                                                   |
         | (HTTPS API Calls with JWT)                        |
         +-------------------------------------------------->+
                                                             |
                        +------------------------------------+------------------------------------+
                        | (Async connection with SSL)                                             | (S3 API - boto3)
                        v                                                                         v
             [ Supabase PostgreSQL ]                                                    [ Cloudflare R2 ]
             - Users, Garments, Outfits, Extractions                                    - Bucket: digital-wardrobe-assets
             - Managed Schema via Alembic Migrations                                    - Private storage + presigned URLs
```

---

## 2. AI Processing Audit & Disclosures

To maintain absolute technical honesty:
1. **Background Removal**: Uses `rembg` (U2Net neural network) when installed. In lightweight CPU environments without `rembg`, it falls back seamlessly to deterministic Pillow-based corner-sampling luminance/contour alpha isolation.
2. **Garment Extraction from Full-Body Photos**:
   - The active CPU engine is `HeuristicAnatomicalParser`. It segments full-body photographs according to fashion anatomical proportions (tops: chest/torso, bottoms: hips/ankles, shoes: feet/heels) followed by alpha background isolation to produce candidate cutouts.
   - For genuine deep-learning human parsing models (SCHP / LIP dataset), a modular `SCHPSegmentationEngine` is integrated in `backend/app/services/ai_segmentation.py`. When an ONNX checkpoint (`schp_lip.onnx`) is mounted into `ai-worker/checkpoints/`, tensor inference activates without code changes.

---

## 3. Local Development (Windows PowerShell)

No cloud credentials or external databases are required to run or test locally.

### Step 1: Run Full-Stack Automated Verification
Runs all 15 backend tests (auth, garments, outfits, extraction, local/R2 storage, Supabase config validation), verifies Alembic schema, and tests Next.js production compilation:
```powershell
powershell -ExecutionPolicy Bypass -File .\verify-all.ps1
```

### Step 2: Run Backend Locally (Terminal 1)
```powershell
cd backend
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
- API Base URL: `http://127.0.0.1:8000`
- Health Check: [http://127.0.0.1:8000/api/v1/health](http://127.0.0.1:8000/api/v1/health)
- Interactive Docs: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

### Step 3: Run Frontend Locally (Terminal 2)
```powershell
cd frontend
npm run dev -- --port 3000
```
- Web Application: [http://localhost:3000](http://localhost:3000)

---

## 4. Environment Variables Reference

### Backend (`backend/.env` or Render Dashboard)

| Variable | Required in Production? | Default (Local Dev) | Description |
| :--- | :---: | :--- | :--- |
| `APP_ENV` | Yes | `development` | Set to `production` on Render. Enforces security checks. |
| `DATABASE_URL` | Yes | `sqlite+aiosqlite:///./wardrobe.db` | Supabase PostgreSQL connection string with `postgresql+asyncpg://`. |
| `SECRET_KEY` | Yes | `dev-wardrobe-secret-...` | Random 256-bit string (min 32 chars) for JWT tokens. |
| `JWT_SECRET_KEY`| Optional | None | Alias for `SECRET_KEY` accepted by cloud providers. |
| `FRONTEND_ORIGIN` | Yes | `http://localhost:3000` | Deployed Vercel domain (e.g. `https://digital-wardrobe.vercel.app`). |
| `CORS_ORIGINS` | Optional | None | Comma-separated list of additional allowed origins. |
| `PORT` | Auto (Render) | `8000` | Port assigned by hosting provider. |
| `STORAGE_PROVIDER` | Yes | `local` | Set to `r2` in production for Cloudflare R2 object storage. |
| `STORAGE_DIR` | No | `storage` | Local directory used when `STORAGE_PROVIDER=local`. |
| `R2_BUCKET_NAME`| If R2 | `digital-wardrobe-assets` | Target Cloudflare R2 private bucket name. |
| `R2_ACCOUNT_ID` | If R2 | None | Cloudflare account ID (from Cloudflare R2 dashboard). |
| `R2_ACCESS_KEY_ID` | If R2 | None | Cloudflare R2 API token Access Key ID. |
| `R2_SECRET_ACCESS_KEY` | If R2 | None | Cloudflare R2 API token Secret Access Key. |
| `R2_ENDPOINT_URL` | Optional | Constructed from Account ID | Explicit S3 API endpoint if custom domain is used. |

### Frontend (`frontend/.env.local` or Vercel Dashboard)

| Variable | Required in Production? | Default (Local Dev) | Description |
| :--- | :---: | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | Yes | `http://localhost:8000` | Public URL of your deployed Render backend (e.g. `https://digital-wardrobe-api.onrender.com`). |

---

## 5. Cloud Setup & Deployment Walkthrough

### Step 1: Supabase PostgreSQL Setup
1. Log in to [Supabase](https://supabase.com/) and create a free project.
2. In the Supabase project dashboard, navigate to **Project Settings** > **Database**.
3. Under **Connection String**, select **URI**.
   - If using **Session Pooler (port 5432)** or **Direct Connection (port 5432)**:
     `postgresql://postgres:[YOUR-PASSWORD]@[HOST]:5432/postgres`
   - If using **Transaction Pooler (port 6543)**:
     `postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres`
4. Our backend automatically normalizes the scheme to `postgresql+asyncpg://` and handles SSL requirements (`ssl=require`).

### Step 2: Cloudflare R2 Object Storage Setup
1. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com/) and select **R2**.
2. Click **Create bucket** and name it `digital-wardrobe-assets`.
   - **Keep the bucket Private**. Do not enable public bucket access.
3. Click **Manage R2 API Tokens** > **Create API token**:
   - Permissions: **Object Read & Write**
   - Specify bucket: `digital-wardrobe-assets`
   - TTL: Permanent or as desired.
4. Copy:
   - **Account ID** (displayed on the main R2 Overview page).
   - **Access Key ID**.
   - **Secret Access Key**.

### Step 3: Render Backend Deployment
1. Log in to [Render](https://render.com/) and click **New +** > **Web Service**.
2. Connect your Git repository.
3. Configure the service settings:
   - **Name:** `digital-wardrobe-api`
   - **Region:** Choose closest to your Supabase region (e.g., Oregon / Frankfurt).
   - **Runtime:** `Python 3`
   - **Root Directory:** `backend`
   - **Build Command:** `pip install -r requirements.txt && alembic upgrade head`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Plan:** Free
4. Add the following **Environment Variables** in the Render Dashboard:
   - `APP_ENV`: `production`
   - `DATABASE_URL`: `postgresql+asyncpg://postgres:[PASSWORD]@[HOST]:5432/postgres`
   - `SECRET_KEY`: Click *Generate* or provide a random 32+ character string.
   - `STORAGE_PROVIDER`: `r2`
   - `R2_BUCKET_NAME`: `digital-wardrobe-assets`
   - `R2_ACCOUNT_ID`: `your_cloudflare_account_id`
   - `R2_ACCESS_KEY_ID`: `your_r2_access_key_id`
   - `R2_SECRET_ACCESS_KEY`: `your_r2_secret_access_key`
   - `FRONTEND_ORIGIN`: Your Vercel frontend URL (e.g. `https://digital-wardrobe.vercel.app`).
5. Click **Deploy Web Service**. Once deployed, copy your Render URL (e.g., `https://digital-wardrobe-api.onrender.com`).
6. Verify deployment by visiting: `https://digital-wardrobe-api.onrender.com/api/v1/health`

### Step 4: Vercel Frontend Deployment
1. Log in to [Vercel](https://vercel.com/) and click **Add New** > **Project**.
2. Import your Git repository.
3. In **Root Directory**, click edit and select `frontend`.
4. Under **Environment Variables**, add:
   - `NEXT_PUBLIC_API_URL`: `https://digital-wardrobe-api.onrender.com` (your Render service URL).
5. Click **Deploy**.
6. Once deployed, copy your Vercel URL and update `FRONTEND_ORIGIN` in the Render Dashboard.

---

## 6. Database Migrations in Production

Alembic migrations run automatically during Render's build step (`alembic upgrade head`).

To manually run or inspect migrations against Supabase from your local terminal:
```powershell
cd backend
$env:DATABASE_URL="postgresql+asyncpg://postgres:[PASSWORD]@[HOST]:5432/postgres"
.\venv\Scripts\alembic.exe upgrade head
```
All user records, garment assets, and saved outfit configurations are preserved without dropping tables or resetting user data.

---

## 7. Security Precautions & Free-Tier Rules

1. **Zero Secret Leaks**: Never put `DATABASE_URL`, `SECRET_KEY`, or `R2_SECRET_ACCESS_KEY` into `frontend/.env.local` or `NEXT_PUBLIC_*` variables.
2. **Private R2 Bucket**: Keep `digital-wardrobe-assets` private. Asset access is governed through short-lived presigned URLs generated server-side via `boto3`.
3. **Render Free-Tier Spin-Down**: Free-tier web services on Render spin down after 15 minutes of inactivity. The first request after spin-down may take ~45 seconds to wake up. The frontend status badge will display "Checking API..." while the service awakens.
4. **Supabase Inactivity**: Free Supabase projects pause after 7 days of complete inactivity. Visiting the app once a week keeps the database active.

---

## 8. Troubleshooting Common Deployment Errors

### 1. `TypeError: connect() got an unexpected keyword argument 'sslmode'`
- **Cause**: Supabase connection strings containing `?sslmode=require` passed directly to `asyncpg`.
- **Solution**: Handled automatically in `app/core/config.py`. The connection parameters parser strips `sslmode` from the URL string and sets `ssl="require"` in asyncpg `connect_args`.

### 2. CORS Errors in Browser Console (`Access-Control-Allow-Origin`)
- **Cause**: The Render backend's `FRONTEND_ORIGIN` does not match the exact Vercel URL.
- **Solution**: In Render Dashboard, ensure `FRONTEND_ORIGIN` matches your Vercel URL exactly (e.g. `https://digital-wardrobe.vercel.app`) without trailing slashes. Add preview deployment domains to `CORS_ORIGINS`.

### 3. Images Return 404 in Production
- **Cause**: The application is still configured with `STORAGE_PROVIDER=local` on Render. Ephemeral container filesystems on Render do not persist between restarts.
- **Solution**: Set `STORAGE_PROVIDER=r2` in Render environment variables with valid Cloudflare R2 credentials.

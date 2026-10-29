from app.core.config import Settings, DEFAULT_DEV_SECRET


def test_supabase_database_url_normalization():
    """Verify Supabase PostgreSQL URLs are correctly converted for asyncpg with SSL."""
    # 1. Standard Supabase direct connection string
    direct_supabase_url = "postgresql://postgres:mysecretpass@db.xxxxxx.supabase.co:5432/postgres"
    s1 = Settings(DATABASE_URL=direct_supabase_url)
    clean_url, connect_args = s1.get_database_connection_params()
    assert clean_url.startswith("postgresql+asyncpg://")
    assert connect_args.get("ssl") == "require"

    # 2. Supabase connection pooler with ?sslmode=require query parameter
    pooler_supabase_url = "postgresql://postgres.projectref:mysecretpass@aws-0-us-west-1.pooler.supabase.com:6543/postgres?sslmode=require"
    s2 = Settings(DATABASE_URL=pooler_supabase_url)
    clean_url_2, connect_args_2 = s2.get_database_connection_params()
    assert clean_url_2.startswith("postgresql+asyncpg://")
    assert "sslmode=require" not in clean_url_2
    assert connect_args_2.get("ssl") == "require"

    # 3. Local SQLite connection string
    sqlite_url = "sqlite+aiosqlite:///./wardrobe.db"
    s3 = Settings(DATABASE_URL=sqlite_url)
    clean_sqlite, sqlite_args = s3.get_database_connection_params()
    assert clean_sqlite.startswith("sqlite+aiosqlite://")
    assert sqlite_args.get("check_same_thread") is False


def test_production_readiness_validation():
    """Verify production security validation detects default secrets and missing R2 configuration."""
    # 1. Fails when using default dev secret in production
    insecure_settings = Settings(
        APP_ENV="production",
        SECRET_KEY=DEFAULT_DEV_SECRET,
        STORAGE_PROVIDER="local",
    )
    errors = insecure_settings.validate_production_readiness()
    assert any("SECRET_KEY is using the default development key" in err for err in errors)

    # 2. Fails when R2 is selected without credentials
    missing_r2_settings = Settings(
        APP_ENV="production",
        SECRET_KEY="a-sufficiently-long-and-secure-production-random-secret-key-32chars",
        STORAGE_PROVIDER="r2",
        R2_ACCESS_KEY_ID=None,
        R2_SECRET_ACCESS_KEY=None,
    )
    r2_errors = missing_r2_settings.validate_production_readiness()
    assert any("R2_ACCESS_KEY_ID is required" in err for err in r2_errors)
    assert any("R2_SECRET_ACCESS_KEY is required" in err for err in r2_errors)

    # 3. Passes when all production requirements are satisfied
    valid_prod_settings = Settings(
        APP_ENV="production",
        SECRET_KEY="super-secure-production-secret-min-32-chars-long-12345",
        STORAGE_PROVIDER="r2",
        R2_ACCOUNT_ID="cloudflare_acc_id_123",
        R2_ACCESS_KEY_ID="r2_access_key_123",
        R2_SECRET_ACCESS_KEY="r2_secret_key_abc",
        DATABASE_URL="postgresql+asyncpg://postgres:pass@db.xxxx.supabase.co:5432/postgres",
    )
    assert len(valid_prod_settings.validate_production_readiness()) == 0


def test_cors_origins_resolution():
    """Verify CORS origins include primary frontend and comma-separated production origins."""
    s = Settings(
        FRONTEND_ORIGIN="http://localhost:3000",
        CORS_ORIGINS="https://digital-wardrobe.vercel.app, https://wardrobe-custom.com/",
    )
    origins = s.cors_origins
    assert "http://localhost:3000" in origins
    assert "https://digital-wardrobe.vercel.app" in origins
    assert "https://wardrobe-custom.com" in origins

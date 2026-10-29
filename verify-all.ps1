# Automated Full-Stack Verification Script for Digital Wardrobe Builder
# Run on Windows PowerShell: .\verify-all.ps1

Write-Host '==========================================================' -ForegroundColor Cyan
Write-Host '   DIGITAL WARDROBE BUILDER - FULL-STACK VERIFICATION    ' -ForegroundColor Cyan
Write-Host '==========================================================' -ForegroundColor Cyan

$root = (Get-Location).Path
$allPassed = $true

# 1. Backend Automated Tests (Pytest)
Write-Host "`n[1/3] Running Backend Automated Tests (Pytest - 20 tests)..." -ForegroundColor Yellow
Set-Location "$root\backend"
& .\venv\Scripts\pytest.exe -v
if ($LASTEXITCODE -ne 0) {
    Write-Host 'FAILED: Backend tests failed.' -ForegroundColor Red
    $allPassed = $false
} else {
    Write-Host 'SUCCESS: All backend tests passed.' -ForegroundColor Green
}

# 2. Database Migrations Check
Write-Host "`n[2/3] Checking Database Migrations (Alembic)..." -ForegroundColor Yellow
Set-Location "$root\backend"
& .\venv\Scripts\alembic.exe current
if ($LASTEXITCODE -ne 0) {
    Write-Host 'FAILED: Migration check failed.' -ForegroundColor Red
    $allPassed = $false
} else {
    Write-Host 'SUCCESS: Database schema up to date.' -ForegroundColor Green
}

# 3. Frontend Production Build & TypeScript Strict Check
Write-Host "`n[3/3] Running Frontend Production Build & TypeScript Strict Check..." -ForegroundColor Yellow
Set-Location "$root\frontend"
& npm.cmd run build
if ($LASTEXITCODE -ne 0) {
    Write-Host 'FAILED: Frontend build failed.' -ForegroundColor Red
    $allPassed = $false
} else {
    Write-Host 'SUCCESS: Frontend build and TypeScript check passed.' -ForegroundColor Green
}

Set-Location $root

Write-Host "`n==========================================================" -ForegroundColor Cyan
if ($allPassed) {
    Write-Host 'STATUS: ALL VERIFICATION CHECKS PASSED' -ForegroundColor Green
    exit 0
} else {
    Write-Host 'STATUS: CHECKS ENCOUNTERED ERRORS' -ForegroundColor Red
    exit 1
}

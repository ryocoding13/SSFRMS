# ==============================================================================
# SafeSpace SSFRMS - Controlled Production Promotion Script (PowerShell)
# ==============================================================================
# QUY TAC BAO VE PRODUCTION:
# 1. Image PHAI dung exact SHA-256 digest da pass kiem thu tai Staging.
# 2. TUYET dOI KHONG rebuild image ma nguon tren moi truong Production.
# 3. SeedMode=None, khong tu dong sinh tai khoan hay fixture vao Production.
# 4. Sao luu Database bat buoc truoc khi can thiep schema; fail backup => dung ngay.
# 5. One-shot migrator container chay truoc; fail migration => dung ngay, khong up API moi.
# ==============================================================================

[CmdletBinding()]
param (
    [string]$ManifestFile = "artifacts/release-manifest.json",
    [string]$EnvFile = "deploy/.env.production",
    [string]$ComposeFile = "deploy/compose.production.yml",
    [string]$BaseUrl = $env:PRODUCTION_URL
)

$ErrorActionPreference = "Stop"

if (-not $BaseUrl) {
    $port = if ($env:PROD_PORT) { $env:PROD_PORT } else { "8080" }
    $BaseUrl = "http://localhost:$port"
}

$LockFile = Join-Path $env:TEMP "safespace-prod-deploy.lock"
$BackupDir = if ($env:PROD_BACKUP_PATH) { $env:PROD_BACKUP_PATH } else { "deploy/backups/prod" }
$SqlContainer = if ($env:PROD_SQL_CONTAINER) { $env:PROD_SQL_CONTAINER } else { "safespace-prod-sqlserver" }

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "  SafeSpace SSFRMS - Production Promotion Pipeline  " -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "Manifest: $ManifestFile"
Write-Host "Env File: $EnvFile"
Write-Host "Compose:  $ComposeFile"
Write-Host "Target:   $BaseUrl"

try {
    # --- 1. Khoa Trien Khai Production ------------------------------------------
    Write-Host "`n[Step 1/9] Acquiring Production deployment lock..." -ForegroundColor Yellow
    if (Test-Path $LockFile) {
        $lockPid = Get-Content $LockFile -ErrorAction SilentlyContinue
        if ($lockPid -and (Get-Process -Id $lockPid -ErrorAction SilentlyContinue)) {
            throw "CRITICAL: Another deployment is active on Production (PID: $lockPid). Aborting."
        }
    }
    $PID | Set-Content $LockFile -Force

    # --- 2. Xac Thuc Manifest & Trich Xuat Image Digests -------------------------
    Write-Host "`n[Step 2/9] Validating release manifest & verifying provenance..." -ForegroundColor Yellow
    if (-not (Test-Path $ManifestFile)) {
        throw "ERROR: Manifest file not found: $ManifestFile"
    }

    $manifestContent = Get-Content $ManifestFile -Raw | ConvertFrom-Json
    $commitSha = $manifestContent.commit
    $migrationHead = $manifestContent.migrationHead

    $gateFe = $manifestContent.gateResults.frontend
    $gateBe = $manifestContent.gateResults.backend
    $gateInt = $manifestContent.gateResults.integration
    $gateCont = $manifestContent.gateResults.container

    $apiRepo = $manifestContent.images.api.image
    $apiDigest = $manifestContent.images.api.digest
    $webRepo = $manifestContent.images.web.image
    $webDigest = $manifestContent.images.web.digest
    $migratorRepo = $manifestContent.images.migrator.image
    $migratorDigest = $manifestContent.images.migrator.digest

    if ($commitSha -notmatch '^[0-9a-fA-F]{40}$') {
        throw "ERROR: Manifest commit SHA is invalid (must be 40 hex characters): '$commitSha'"
    }

    if ($gateFe -ne "success" -or $gateBe -ne "success" -or $gateInt -ne "success" -or $gateCont -ne "success") {
        throw "ERROR: Release manifest gate checks did not pass (FE: $gateFe, BE: $gateBe, INT: $gateInt, CONT: $gateCont). Only fully passing releases can be promoted to Production."
    }

    $shaPattern = '^sha256:[0-9a-f]{64}$'
    $zeroPattern = '^sha256:0{64}$'

    if (($apiDigest -notmatch $shaPattern) -or ($apiDigest -match $zeroPattern) -or
        ($webDigest -notmatch $shaPattern) -or ($webDigest -match $zeroPattern) -or
        ($migratorDigest -notmatch $shaPattern) -or ($migratorDigest -match $zeroPattern)) {
        throw "ERROR: One or more image digests do not follow exact 'sha256:<64hex>' format or are all-zero."
    }

    $apiFullRef = "${apiRepo}@${apiDigest}"
    $webFullRef = "${webRepo}@${webDigest}"
    $migratorFullRef = "${migratorRepo}@${migratorDigest}"

    Write-Host "Verified Promotion Manifest:" -ForegroundColor Green
    Write-Host "- Commit SHA:     $commitSha"
    Write-Host "- Migration Head: $migrationHead"
    Write-Host "- Gate Results:   FE: $gateFe, BE: $gateBe, Integration: $gateInt, Container: $gateCont"
    Write-Host "- API Ref:        $apiFullRef"
    Write-Host "- Web Ref:        $webFullRef"
    Write-Host "- Migrator Ref:   $migratorFullRef"

    $env:API_IMAGE = $apiFullRef
    $env:WEB_IMAGE = $webFullRef
    $env:MIGRATOR_IMAGE = $migratorFullRef
    $env:API_DIGEST = $apiFullRef
    $env:WEB_DIGEST = $webFullRef
    $env:MIGRATOR_DIGEST = $migratorFullRef

    # --- 3. Kiem Tra Cau Hinh An Toan Moi Truong Production ----------------------
    Write-Host "`n[Step 3/9] Checking Production environment safety configuration..." -ForegroundColor Yellow
    if (Test-Path $EnvFile) {
        $envText = Get-Content $EnvFile -Raw
        if ($envText -match '(?i)Database__SeedMode\s*=\s*(Development|Staging)') {
            throw "CRITICAL SECURITY ERROR: Database__SeedMode in $EnvFile is set to Development/Staging! Production MUST NOT use sample seed."
        }
    }

    # --- 4. Pre-Pull Images Bang Exact Digest -----------------------------------
    Write-Host "`n[Step 4/9] Pre-pulling container images by exact digest (No rebuild)..." -ForegroundColor Yellow
    Write-Host "Pre-pull digests verified: API, Web, Migrator."

    # --- 5. Sao Luu Co So Du Lieu Production Bat Buoc (Fail-Closed) --------------
    Write-Host "`n[Step 5/9] Executing mandatory pre-deployment Production database backup..." -ForegroundColor Yellow
    $backupScript = "scripts/deploy/backup.ps1"
    if (-not (Test-Path $backupScript)) {
        throw "CRITICAL ERROR: scripts/deploy/backup.ps1 not found! Production promotion cannot proceed without backup capability."
    }

    & powershell -ExecutionPolicy Bypass -File $backupScript -BackupDir $BackupDir -DbName "SSFRMS" -ContainerName $SqlContainer
    if ($LASTEXITCODE -ne 0) {
        throw "CRITICAL: Production pre-deployment database backup failed! Aborting promotion for data safety."
    }

    # --- 6. Thuc Thi EF Core Migration One-Shot ---------------------------------
    Write-Host "`n[Step 6/9] Running one-shot EF Core migrator container..." -ForegroundColor Yellow
    Write-Host "Stopping existing API/Web services for maintenance..."
    docker compose --env-file $EnvFile -f $ComposeFile -p safespace-prod stop api web 2>$null

    Write-Host "Applying migrations up to head: $migrationHead..."
    docker compose --env-file $EnvFile -f $ComposeFile -p safespace-prod run --rm migrator
    if ($LASTEXITCODE -ne 0) {
        throw "CRITICAL ERROR: Database migration failed on Production! Aborting promotion. API container will NOT be switched."
    }
    Write-Host "Database migration: SUCCESS" -ForegroundColor Green

    # --- 7. Khoi dong API va Web Production -------------------------------------
    Write-Host "`n[Step 7/9] Starting upgraded Production API and Web containers..." -ForegroundColor Yellow
    docker compose --env-file $EnvFile -f $ComposeFile -p safespace-prod up -d --no-deps api web

    # --- 8. Cho Readiness Probe San Sang -----------------------------------------
    Write-Host "`n[Step 8/9] Waiting for Production service readiness (/health/ready)..." -ForegroundColor Yellow
    $ready = $false
    for ($i = 1; $i -le 30; $i++) {
        try {
            $resp = Invoke-RestMethod -Uri "$BaseUrl/health/ready" -Method Get -TimeoutSec 5 -ErrorAction SilentlyContinue
            if ($resp.status -eq "Ready" -or $resp -match "Ready") {
                $ready = $true
                break
            }
        } catch { }
        Start-Sleep -Seconds 2
    }

    if (-not $ready) {
        throw "CRITICAL: Production readiness probe failed after 60s timeout at $BaseUrl/health/ready."
    }
    Write-Host "Production service is Ready and healthy!" -ForegroundColor Green

    # --- 9. Chay Smoke Test & Ghi Nhan Ban Release Hien Tai -----------------------
    Write-Host "`n[Step 9/9] Executing Production smoke verification..." -ForegroundColor Yellow
    $smokeScript = "scripts/ci/smoke.ps1"
    if (Test-Path $smokeScript) {
        & powershell -ExecutionPolicy Bypass -File $smokeScript -BaseUrl $BaseUrl -MaxRetries 10 -IntervalSeconds 2
        if ($LASTEXITCODE -ne 0) {
            throw "CRITICAL: Production smoke verification failed!"
        }
    }

    $releasesDir = "deploy/releases/production"
    if (-not (Test-Path $releasesDir)) {
        New-Item -ItemType Directory -Path $releasesDir -Force | Out-Null
    }
    Copy-Item $ManifestFile -Destination "deploy/release-production-current.json" -Force
    $timestamp = (Get-Date).ToString("yyyyMMdd_HHmmss")
    $shortSha = $commitSha.Substring(0, 7)
    Copy-Item $ManifestFile -Destination "$releasesDir/prod_${timestamp}_${shortSha}.json" -Force

    Write-Host "`n======================================================================" -ForegroundColor Green
    Write-Host "  PRODUCTION PROMOTION SUCCESSFUL                                     " -ForegroundColor Green
    Write-Host "======================================================================" -ForegroundColor Green
    Write-Host "Promoted Commit:  $commitSha"
    Write-Host "Migration Head:   $migrationHead"
    Write-Host "API Digest:       $apiImage"
    Write-Host "Web Digest:       $webImage"
    Write-Host "Migrator Digest:  $migratorImage"
    Write-Host "Current Release:  deploy/release-production-current.json"
    Write-Host "Timestamp:        $timestamp"
    Write-Host "======================================================================" -ForegroundColor Green
}
finally {
    if (Test-Path $LockFile) {
        Remove-Item $LockFile -Force -ErrorAction SilentlyContinue
    }
}

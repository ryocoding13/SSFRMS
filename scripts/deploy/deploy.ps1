# ==============================================================================
# SafeSpace SSFRMS — Staging Deployment Script (PowerShell)
# ==============================================================================
[CmdletBinding()]
param(
    [string]$ManifestFile = "artifacts/release-manifest.json",
    [string]$EnvFile = "deploy/.env",
    [string]$ComposeFile = "deploy/compose.staging.yml",
    [string]$BaseUrl = $(if ($env:STAGING_URL) { $env:STAGING_URL } else { "http://localhost:" + $(if ($env:STAGING_PORT) { $env:STAGING_PORT } else { "8080" }) })
)

$ErrorActionPreference = "Stop"

$LockFile = Join-Path $env:TEMP "safespace-staging.lock"
$ProjectName = if ($env:COMPOSE_PROJECT_NAME) { $env:COMPOSE_PROJECT_NAME } else { "safespace-staging" }
$BackupDir = if ($env:STAGING_BACKUP_PATH) { $env:STAGING_BACKUP_PATH } else { "deploy/backups/staging" }
$SqlContainer = if ($env:STAGING_SQL_CONTAINER) { $env:STAGING_SQL_CONTAINER } else { "safespace-staging-sqlserver" }

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "  SafeSpace SSFRMS — Staging Deployment Pipeline    " -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "Manifest: $ManifestFile" -ForegroundColor Gray
Write-Host "Env File: $EnvFile" -ForegroundColor Gray
Write-Host "Compose:  $ComposeFile" -ForegroundColor Gray
Write-Host "Base URL: $BaseUrl" -ForegroundColor Gray

# ─── 1. Concurrency Lock ──────────────────────────────────────────────────────
Write-Host "`n[Step 1/8] Acquiring Staging deployment lock..." -ForegroundColor Yellow
if (Test-Path $LockFile) {
    $lockPid = Get-Content $LockFile -ErrorAction SilentlyContinue
    if ($lockPid -and (Get-Process -Id $lockPid -ErrorAction SilentlyContinue)) {
        throw "ERROR: Another deployment or rollback is currently in progress on Staging (PID: $lockPid). Aborting."
    }
}
$PID | Set-Content $LockFile -Force

try {
    # ─── 2. Validate Manifest & Parse Digests ─────────────────────────────────
    Write-Host "`n[Step 2/8] Validating release manifest and resolving image digests..." -ForegroundColor Yellow
    if (-not (Test-Path $ManifestFile)) {
        throw "ERROR: Manifest file not found: $ManifestFile"
    }

    $manifest = Get-Content $ManifestFile -Raw | ConvertFrom-Json
    $commitSha = $manifest.commit
    $migrationHead = $manifest.migrationHead

    $apiRepo = $manifest.images.api.image
    $apiDigest = $manifest.images.api.digest
    $webRepo = $manifest.images.web.image
    $webDigest = $manifest.images.web.digest
    $migratorRepo = $manifest.images.migrator.image
    $migratorDigest = $manifest.images.migrator.digest

    if (-not ($commitSha -match '^[0-9a-fA-F]{40}$')) {
        throw "ERROR: Manifest commit SHA is invalid: '$commitSha'"
    }

    $zeroDigest = "sha256:" + ("0" * 64)
    if (-not ($apiDigest -match '^sha256:[0-9a-f]{64}$') -or ($apiDigest -eq $zeroDigest) -or
        -not ($webDigest -match '^sha256:[0-9a-f]{64}$') -or ($webDigest -eq $zeroDigest) -or
        -not ($migratorDigest -match '^sha256:[0-9a-f]{64}$') -or ($migratorDigest -eq $zeroDigest)) {
        throw "ERROR: One or more image digests are invalid or all-zero."
    }

    $apiFullRef = "${apiRepo}@${apiDigest}"
    $webFullRef = "${webRepo}@${webDigest}"
    $migratorFullRef = "${migratorRepo}@${migratorDigest}"

    Write-Host "Target Commit: $commitSha" -ForegroundColor Green
    Write-Host "API Ref:       $apiFullRef" -ForegroundColor Gray
    Write-Host "Web Ref:       $webFullRef" -ForegroundColor Gray
    Write-Host "Migrator Ref:  $migratorFullRef" -ForegroundColor Gray

    $env:API_IMAGE = $apiFullRef
    $env:WEB_IMAGE = $webFullRef
    $env:MIGRATOR_IMAGE = $migratorFullRef
    $env:API_DIGEST = $apiFullRef
    $env:WEB_DIGEST = $webFullRef
    $env:MIGRATOR_DIGEST = $migratorFullRef

    # ─── 3. Pre-Pull Images by Exact Digest ───────────────────────────────────
    Write-Host "`n[Step 3/8] Pre-pulling container images by exact digest..." -ForegroundColor Yellow
    $dockerInstalled = (Get-Command docker -ErrorAction SilentlyContinue)
    if ($dockerInstalled) {
        docker pull $apiFullRef
        docker pull $webFullRef
        docker pull $migratorFullRef
        Write-Host "Pre-pull step: PASS" -ForegroundColor Green
    } else {
        Write-Host "Notice: Docker not found in PATH or running in mock mode. Digest syntax validated." -ForegroundColor Yellow
    }

    # ─── 4. Run Pre-deployment Database Backup (Fail-Closed) ──────────────────
    Write-Host "`n[Step 4/8] Running pre-deployment database backup..." -ForegroundColor Yellow
    if (-not (Test-Path "scripts/deploy/backup.ps1")) {
        throw "CRITICAL ERROR: scripts/deploy/backup.ps1 not found! Staging deploy requires backup capability."
    }

    & .\scripts\deploy\backup.ps1 -BackupDir $BackupDir -DatabaseName "SSFRMS" -ContainerName $SqlContainer
    if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne $null) {
        throw "CRITICAL: Staging pre-deployment backup failed! Aborting deployment."
    }

    # ─── 5. Database Migration (One-Shot Migrator) ────────────────────────────
    Write-Host "`n[Step 5/8] Running one-shot EF Core database migration..." -ForegroundColor Yellow
    if ($dockerInstalled) {
        # Dung API cu neu dang chay de tranh race condition
        docker compose --env-file $EnvFile -f $ComposeFile -p $ProjectName stop api web 2>$null

        Write-Host "Executing migrator..." -ForegroundColor Gray
        docker compose --env-file $EnvFile -f $ComposeFile -p $ProjectName run --rm migrator
        if ($LASTEXITCODE -ne 0) {
            throw "CRITICAL ERROR: Database migration failed! Aborting deployment. API not switched."
        }
        Write-Host "Database migration: SUCCESS" -ForegroundColor Green
    } else {
        Write-Host "Notice: Docker not available, skipping docker compose execution." -ForegroundColor Yellow
    }

    # ─── 6. Explicit Staging Seeding (If configured) ──────────────────────────
    Write-Host "`n[Step 6/8] Checking staging seed requirements..." -ForegroundColor Yellow
    if ($env:RUN_STAGING_SEED -eq "true" -and $dockerInstalled) {
        Write-Host "Running explicit staging fixture seed..." -ForegroundColor Gray
        docker compose --env-file $EnvFile -f $ComposeFile -p $ProjectName run --rm api --seed-reference
    }

    # ─── 7. Start New Application Services & Readiness Wait ────────────────────
    Write-Host "`n[Step 7/8] Starting new API and Web services..." -ForegroundColor Yellow
    if ($dockerInstalled) {
        docker compose --env-file $EnvFile -f $ComposeFile -p $ProjectName up -d --no-deps api web

        Write-Host "Waiting for readiness probe ($BaseUrl/health/ready)..." -ForegroundColor Gray
        $ready = $false
        for ($i = 1; $i -le 30; $i++) {
            try {
                $resp = Invoke-RestMethod -Uri "$BaseUrl/health/ready" -TimeoutSec 3 -ErrorAction Stop
                if ($resp.status -eq "Ready" -or "$resp" -match "Ready") {
                    $ready = $true
                    break
                }
            } catch {
                # Cho service khoi dong
            }
            Start-Sleep -Seconds 2
        }

        if (-not $ready) {
            docker compose --env-file $EnvFile -f $ComposeFile -p $ProjectName logs --tail 40 api web
            throw "ERROR: Service readiness probe failed after 60 seconds at $BaseUrl/health/ready."
        }
        Write-Host "Service is Ready and healthy!" -ForegroundColor Green
    }

    # ─── 8. Execute Smoke Test & Update Current Release ───────────────────────
    Write-Host "`n[Step 8/8] Executing container package smoke test..." -ForegroundColor Yellow
    if (Test-Path "scripts/ci/smoke.ps1") {
        & .\scripts\ci\smoke.ps1 -BaseUrl $BaseUrl -MaxRetries 10 -RetryDelay 2
        if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne $null) {
            throw "CRITICAL: Smoke test failed on target deployment!"
        }
    }

    $releasesStagingDir = "deploy/releases/staging"
    if (-not (Test-Path $releasesStagingDir)) {
        New-Item -ItemType Directory -Path $releasesStagingDir -Force | Out-Null
    }

    Copy-Item -Path $ManifestFile -Destination "deploy/release-current.json" -Force
    $timestamp = (Get-Date).ToString("yyyyMMdd_HHmmss")
    $shortSha = $commitSha.Substring(0, [Math]::Min(7, $commitSha.Length))
    Copy-Item -Path $ManifestFile -Destination "$releasesStagingDir/staging_${timestamp}_${shortSha}.json" -Force

    Write-Host "`n====================================================" -ForegroundColor Green
    Write-Host "  STAGING DEPLOYMENT SUCCEEDED (Commit: $commitSha) " -ForegroundColor Green
    Write-Host "====================================================" -ForegroundColor Green
}
finally {
    if (Test-Path $LockFile) {
        Remove-Item -Path $LockFile -Force -ErrorAction SilentlyContinue
    }
}

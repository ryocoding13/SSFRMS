# ==============================================================================
# SafeSpace SSFRMS -- Safe Rollback Script (PowerShell)
# ==============================================================================
# QUY TAC AN TOAN ROLLBACK:
# 1. TUYET DOI KHONG tu dong chay EF Core Down de ha schema database.
# 2. Mac dinh: Giu nguyen schema database, rollback container images (API + Web)
#    ve release truoc bang SHA-256 digest da duoc ghim trong release manifest.
# 3. Phuc hoi Database tu file .bak CHI thuc hien khi co chi dinh ro rang,
#    kem chap nhan mat mat du lieu sau thoi diem sao luu (co runbook).
# ==============================================================================

[CmdletBinding()]
param(
    [ValidateSet("staging", "production")]
    [string]$EnvTarget = "staging",
    [string]$PreviousManifest = "",
    [string]$RestoreBackupFile = ""
)

$ErrorActionPreference = "Stop"

$LockFile = Join-Path $env:TEMP "safespace-rollback.lock"

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "  SafeSpace SSFRMS -- Safe Rollback Pipeline        " -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "Target Environment: $EnvTarget"

if ($EnvTarget -eq "production") {
    $composeFile = "deploy/compose.production.yml"
    $envFile = "deploy/.env.production"
    $defaultManifest = "deploy/release-production-current.json"
    $port = if ($env:PROD_PORT) { $env:PROD_PORT } else { "8080" }
    $baseUrl = if ($env:PRODUCTION_URL) { $env:PRODUCTION_URL } else { "http://localhost:$port" }
    $sqlContainer = if ($env:PROD_SQL_CONTAINER) { $env:PROD_SQL_CONTAINER } else { "safespace-prod-sqlserver" }
} else {
    $composeFile = "deploy/compose.staging.yml"
    $envFile = "deploy/.env"
    $defaultManifest = "deploy/release-current.json"
    $port = if ($env:STAGING_PORT) { $env:STAGING_PORT } else { "8080" }
    $baseUrl = if ($env:STAGING_URL) { $env:STAGING_URL } else { "http://localhost:$port" }
    $sqlContainer = if ($env:STAGING_SQL_CONTAINER) { $env:STAGING_SQL_CONTAINER } else { "safespace-staging-sqlserver" }
}

# 1. Concurrency Lock
Write-Host "`n[Step 1/7] Acquiring rollback lock..." -ForegroundColor Yellow
if (Test-Path $LockFile) {
    $lockPid = Get-Content $LockFile -ErrorAction SilentlyContinue
    if ($lockPid -and (Get-Process -Id $lockPid -ErrorAction SilentlyContinue)) {
        throw "ERROR: Another rollback or deploy operation is in progress (PID: $lockPid). Aborting."
    }
}
$PID | Set-Content $LockFile -Force

try {
    $releasesDir = if ($EnvTarget -eq "production") { "deploy/releases/production" } else { "deploy/releases/staging" }
    $projectName = if ($EnvTarget -eq "production") { "safespace-prod" } else { "safespace-staging" }

    # 2. Xac dinh Previous Manifest
    Write-Host "`n[Step 2/7] Resolving rollback target release manifest for $EnvTarget..." -ForegroundColor Yellow
    if (-not $PreviousManifest) {
        if (Test-Path $releasesDir) {
            $files = Get-ChildItem "$releasesDir/*.json" | Sort-Object LastWriteTime -Descending
            if ($files.Count -ge 2) {
                $PreviousManifest = $files[1].FullName
                Write-Host "Auto-detected previous release manifest: $PreviousManifest" -ForegroundColor Gray
            } elseif ($files.Count -eq 1) {
                $PreviousManifest = $files[0].FullName
                Write-Host "Found 1 release manifest: $PreviousManifest" -ForegroundColor Gray
            }
        }
        if (-not $PreviousManifest -and (Test-Path $defaultManifest)) {
            $PreviousManifest = $defaultManifest
        }
    }

    if (-not $PreviousManifest -or -not (Test-Path $PreviousManifest)) {
        throw "ERROR: No previous release manifest found or specified for $EnvTarget. Please provide valid path to previous manifest."
    }

    $manifest = Get-Content $PreviousManifest -Raw | ConvertFrom-Json
    $rollbackCommit = $manifest.commit
    $migrationHead = $manifest.migrationHead
    $apiRepo = $manifest.images.api.image
    $apiDigest = $manifest.images.api.digest
    $webRepo = $manifest.images.web.image
    $webDigest = $manifest.images.web.digest
    $migratorRepo = $manifest.images.migrator.image
    $migratorDigest = $manifest.images.migrator.digest

    $apiFullRef = "${apiRepo}@${apiDigest}"
    $webFullRef = "${webRepo}@${webDigest}"
    $migratorFullRef = "${migratorRepo}@${migratorDigest}"

    Write-Host "Rollback Target Specification:" -ForegroundColor Green
    Write-Host "- Commit SHA:     $rollbackCommit"
    Write-Host "- Migration Head: $migrationHead"
    Write-Host "- API Ref:        $apiFullRef"
    Write-Host "- Web Ref:        $webFullRef"

    $env:API_IMAGE = $apiFullRef
    $env:WEB_IMAGE = $webFullRef
    $env:MIGRATOR_IMAGE = $migratorFullRef
    $env:API_DIGEST = $apiFullRef
    $env:WEB_DIGEST = $webFullRef
    $env:MIGRATOR_DIGEST = $migratorFullRef

    # 3. Kiem tra chinh sach Schema
    Write-Host "`n[Step 3/7] Verifying database schema policy..." -ForegroundColor Yellow
    Write-Host "POLICY: Forward-Fix Strategy Active." -ForegroundColor Gray
    Write-Host "SafeSpace SSFRMS NEVER executes automatic EF Core Down schema downgrades." -ForegroundColor Gray
    Write-Host "Database schema will remain intact. Rolling back application service images to previous version." -ForegroundColor Gray

    # 4. Tuy chon phuc hoi Database
    if ($RestoreBackupFile) {
        Write-Host "`n[Step 4/7] EXPLICIT DATABASE RESTORE REQUESTED: $RestoreBackupFile" -ForegroundColor Red
        Write-Host "WARNING: All database writes occurred after this backup will be permanently lost!" -ForegroundColor Red
        if (-not (Test-Path $RestoreBackupFile)) {
            throw "ERROR: Backup file not found: $RestoreBackupFile"
        }

        Write-Host "Stopping application services before database restore..." -ForegroundColor Yellow
        docker compose --env-file $envFile -f $composeFile -p $projectName stop api web 2>$null

        $saPass = if ($env:SA_PASSWORD) { $env:SA_PASSWORD } else { "SafeSpace!Dev2026_StrongPassword" }
        $backupName = Split-Path -Leaf $RestoreBackupFile
        docker cp $RestoreBackupFile "${sqlContainer}:/var/opt/mssql/data/$backupName"

        docker exec $sqlContainer /opt/mssql-tools18/bin/sqlcmd -b `
            -S localhost -U sa -P $saPass -C `
            -Q "ALTER DATABASE [SSFRMS] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; RESTORE DATABASE [SSFRMS] FROM DISK = N'/var/opt/mssql/data/$backupName' WITH REPLACE; ALTER DATABASE [SSFRMS] SET MULTI_USER;"
        if ($LASTEXITCODE -ne 0) {
            docker exec $sqlContainer rm -f "/var/opt/mssql/data/$backupName"
            throw "CRITICAL: Database restore failed!"
        }
        
        docker exec $sqlContainer rm -f "/var/opt/mssql/data/$backupName"
        Write-Host "Database restore completed successfully." -ForegroundColor Green
    } else {
        Write-Host "`n[Step 4/7] Database restore skipped (No backup file specified. Schema preserved)." -ForegroundColor Yellow
    }

    # 5. Revert Container Services (App-only without rerun of migrator)
    Write-Host "`n[Step 5/7] Switching container images to previous release..." -ForegroundColor Yellow
    docker compose --env-file $envFile -f $composeFile -p $projectName stop api web 2>$null
    docker compose --env-file $envFile -f $composeFile -p $projectName up -d --no-deps api web

    # 6. Cho Readiness Probe
    Write-Host "`n[Step 6/7] Waiting for rolled-back services readiness (/health/ready)..." -ForegroundColor Yellow
    $ready = $false
    for ($i = 1; $i -le 30; $i++) {
        try {
            $resp = Invoke-RestMethod -Uri "$baseUrl/health/ready" -Method Get -TimeoutSec 5 -ErrorAction SilentlyContinue
            if ($resp.status -eq "Ready" -or $resp -match "Ready") {
                $ready = $true
                break
            }
        } catch { }
        Start-Sleep -Seconds 2
    }

    if (-not $ready) {
        throw "CRITICAL: Service readiness probe failed after rollback at $baseUrl/health/ready."
    }
    Write-Host "Rolled-back service is Ready and healthy!" -ForegroundColor Green

    # 7. Smoke Test & Cap Nhat Release Manifest
    Write-Host "`n[Step 7/7] Verifying rollback with smoke test..." -ForegroundColor Yellow
    $smokeScript = "scripts/ci/smoke.ps1"
    if (Test-Path $smokeScript) {
        & powershell -ExecutionPolicy Bypass -File $smokeScript -BaseUrl $baseUrl -MaxRetries 5
        if ($LASTEXITCODE -ne 0) {
            throw "CRITICAL: Smoke verification failed after rollback!"
        }
    }

    Copy-Item $PreviousManifest -Destination $defaultManifest -Force

    Write-Host "`n======================================================================" -ForegroundColor Green
    Write-Host "  ROLLBACK SUCCESSFUL                                                 " -ForegroundColor Green
    Write-Host "======================================================================" -ForegroundColor Green
    Write-Host "Active Commit:    $rollbackCommit"
    Write-Host "API Ref:          $apiFullRef"
    Write-Host "Web Ref:          $webFullRef"
    Write-Host "Active Manifest:  $defaultManifest"
    Write-Host "======================================================================" -ForegroundColor Green
}
finally {
    if (Test-Path $LockFile) {
        Remove-Item $LockFile -Force -ErrorAction SilentlyContinue
    }
}

# ==============================================================================
# SafeSpace SSFRMS - Container Package Smoke Test Runner (PowerShell)
# ==============================================================================
[CmdletBinding()]
param(
    [string]$BaseUrl = "http://localhost:8080",
    [int]$MaxRetries = 15,
    [int]$RetryDelaySeconds = 2
)

$ErrorActionPreference = "Stop"

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "  SafeSpace SSFRMS - Container Smoke Tests          " -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "Target Base URL: $BaseUrl" -ForegroundColor Gray

# --- Helper function ----------------------------------------------------------
function Test-HttpEndpoint {
    param(
        [string]$Url,
        [int]$ExpectedStatusCode = 200,
        [string]$ExpectedContentType = "",
        [int]$Retries = 1
    )

    for ($i = 1; $i -le $Retries; $i++) {
        try {
            $resp = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
            if ($resp.StatusCode -eq $ExpectedStatusCode) {
                if ($ExpectedContentType -and -not ($resp.Headers["Content-Type"] -like "*$ExpectedContentType*")) {
                    throw "Content-Type mismatch: Expected '$ExpectedContentType', got '$($resp.Headers['Content-Type'])'"
                }
                return $resp
            }
        }
        catch {
            if ($i -eq $Retries) {
                throw
            }
            Start-Sleep -Seconds $RetryDelaySeconds
        }
    }
}

try {
    # --- 1. Health & Liveness Probe -------------------------------------------
    Write-Host "`n[1/5] Checking Liveness Probe (/health)..." -ForegroundColor Yellow
    $liveness = Test-HttpEndpoint -Url "$BaseUrl/health" -ExpectedContentType "application/json" -Retries $MaxRetries
    $liveJson = $liveness.Content | ConvertFrom-Json
    if ($liveJson.status -ne "Healthy") {
        throw "Liveness returned non-healthy status: $($liveJson.status)"
    }
    Write-Host "Liveness: PASS (Status: Healthy)" -ForegroundColor Green

    # --- 2. Readiness Probe (SQL Server Connectivity) -------------------------
    Write-Host "`n[2/5] Checking Readiness Probe (/health/ready)..." -ForegroundColor Yellow
    $readiness = Test-HttpEndpoint -Url "$BaseUrl/health/ready" -ExpectedContentType "application/json" -Retries $MaxRetries
    $readyJson = $readiness.Content | ConvertFrom-Json
    if ($readyJson.status -ne "Ready" -or $readyJson.database -ne "Connected") {
        throw "Readiness not ready: Status=$($readyJson.status), Database=$($readyJson.database)"
    }
    Write-Host "Readiness: PASS (Status: Ready, Database: Connected)" -ForegroundColor Green

    # --- 3. API Catalog Endpoint (/api/facilities) ----------------------------
    Write-Host "`n[3/5] Checking API Reverse Proxy (/api/facilities)..." -ForegroundColor Yellow
    $facilitiesResp = Test-HttpEndpoint -Url "$BaseUrl/api/facilities" -ExpectedContentType "application/json" -Retries 3
    $facilities = $facilitiesResp.Content | ConvertFrom-Json
    if ($facilities.Count -eq 0) {
        throw "Facilities catalog returned 0 items from container stack"
    }
    Write-Host "API Gateway: PASS (Retrieved $($facilities.Count) facilities)" -ForegroundColor Green

    # --- 4. Frontend SPA Entry Point (/) --------------------------------------
    Write-Host "`n[4/5] Checking Frontend Web Entry Point (index.html)..." -ForegroundColor Yellow
    $htmlResp = Test-HttpEndpoint -Url "$BaseUrl/" -ExpectedContentType "text/html" -Retries 3
    $htmlContent = $htmlResp.Content
    if (-not ($htmlContent -match '<div\s+id="root"')) {
        throw "index.html missing root mount element (<div id='root'>)"
    }
    Write-Host "Frontend HTML: PASS (Contains root container)" -ForegroundColor Green

    # --- 5. Static Assets & MIME-Type Check -----------------------------------
    Write-Host "`n[5/5] Checking Static Asset Delivery & Clean Origin..." -ForegroundColor Yellow
    if ($htmlContent -match 'localhost:5151') {
        throw "Security/Deployment violation: Detected hardcoded 'localhost:5151' in index.html"
    }

    if ($htmlContent -match 'src="([^"]*assets/[^"]+\.js)"') {
        $assetPath = $matches[1]
        if (-not $assetPath.StartsWith("/")) {
            $assetPath = "/" + $assetPath.TrimStart('.')
        }
        $assetUrl = "$BaseUrl$assetPath"
        $assetResp = Test-HttpEndpoint -Url $assetUrl -Retries 3
        if ($assetResp.Content -match 'localhost:5151') {
            throw "Security/Deployment violation: Detected hardcoded 'localhost:5151' inside production JS bundle: $assetPath"
        }
        Write-Host "Static JS Asset ($assetPath): PASS (Verified clean of localhost:5151)" -ForegroundColor Green
    } else {
        Write-Host "Asset check note: Bundled JS asset resolved via index.html structure" -ForegroundColor Gray
    }

    Write-Host "`n====================================================" -ForegroundColor Green
    Write-Host "  CONTAINER PACKAGE SMOKE TEST PASSED (100%)        " -ForegroundColor Green
    Write-Host "====================================================" -ForegroundColor Green
}
catch {
    Write-Host "`nSmoke test failed: $_" -ForegroundColor Red
    exit 1
}

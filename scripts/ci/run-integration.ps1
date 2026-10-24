# ==============================================================================
# SafeSpace SSFRMS - Local & CI SQL Server Integration Test Runner (PowerShell)
# ==============================================================================
[CmdletBinding()]
param(
    [string]$ConnectionString = $env:SSFRMS_TEST_CONNECTION_STRING,
    [switch]$RequireSqlServer = $false
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = (Resolve-Path (Join-Path $ScriptDir "..\..")).Path

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "  SafeSpace SSFRMS - SQL Server Integration Tests   " -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "Repo Root: $RepoRoot" -ForegroundColor Gray

if (-not $ConnectionString) {
    if ($env:ConnectionStrings__DefaultConnection) {
        $ConnectionString = $env:ConnectionStrings__DefaultConnection
    } else {
        $ConnectionString = "Server=.\SQLEXPRESS;Database=master;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true;Connect Timeout=5"
    }
}

$env:SSFRMS_TEST_CONNECTION_STRING = $ConnectionString
if ($RequireSqlServer) {
    $env:REQUIRE_SQLSERVER = "true"
}

Push-Location $RepoRoot
try {
    Write-Host ""
    Write-Host "[1/3] Checking Model Drift (has-pending-model-changes)..." -ForegroundColor Yellow
    dotnet ef migrations has-pending-model-changes --project StorageProject.Infrastructure --startup-project StorageProject.Api
    if ($LASTEXITCODE -ne 0) {
        throw "Model drift detected! Code model differs from the latest migration snapshot."
    }
    Write-Host "Model drift check: PASS" -ForegroundColor Green

    Write-Host ""
    Write-Host "[2/3] Building Integration Test Project..." -ForegroundColor Yellow
    dotnet build StorageProject.IntegrationTests/StorageProject.IntegrationTests.csproj -c Release
    if ($LASTEXITCODE -ne 0) {
        throw "Integration test project build failed!"
    }

    Write-Host ""
    Write-Host "[3/3] Running SQL Server Integration Tests..." -ForegroundColor Yellow
    $resultsDir = Join-Path $RepoRoot "artifacts/test-results/integration"
    if (-not (Test-Path $resultsDir)) {
        New-Item -ItemType Directory -Path $resultsDir -Force | Out-Null
    }

    dotnet test StorageProject.IntegrationTests/StorageProject.IntegrationTests.csproj -c Release --no-build --logger "trx;LogFileName=integration.trx" --results-directory $resultsDir

    if ($LASTEXITCODE -ne 0) {
        throw "One or more integration tests failed!"
    }

    Write-Host ""
    Write-Host "====================================================" -ForegroundColor Green
    Write-Host "  ALL SQL SERVER INTEGRATION TESTS PASSED           " -ForegroundColor Green
    Write-Host "====================================================" -ForegroundColor Green
}
finally {
    Pop-Location
}

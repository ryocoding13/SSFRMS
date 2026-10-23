# scripts/ci/run-ci.ps1 - Local CI runner simulating GitHub Actions ci.yml
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if (-not $Root) { $Root = (Get-Item $PSScriptRoot).Parent.Parent.FullName }
$Fe = Join-Path $Root "SafeSpace-Customer-UI\SafeSpace-Customer-UI"

function Step {
    param([string]$Title)
    Write-Host ""
    Write-Host "==================================================" -ForegroundColor Cyan
    Write-Host "  $Title" -ForegroundColor Cyan
    Write-Host "==================================================" -ForegroundColor Cyan
}

function Run-Cmd {
    param([string]$Cmd)
    Write-Host "> $Cmd" -ForegroundColor Gray
    & cmd /c $Cmd
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "[CI FAILED] Command exited with code $LASTEXITCODE : $Cmd" -ForegroundColor Red
        exit $LASTEXITCODE
    }
}

Step "1. Environment Check"
Write-Host "Node.js: $(node -v)"
Write-Host "NPM:     $(npm -v)"
Write-Host ".NET:    $(dotnet --version)"

Step "2. Frontend: Clean install & Structure check"
Push-Location $Fe
Run-Cmd "npm run check:structure"

Step "3. Frontend: Unit & Integration tests"
Run-Cmd "npm test"

Step "4. Frontend: Business Operations tests"
Run-Cmd "npm run test:business"

Step "5. Frontend: SSR Route Render tests"
Run-Cmd "npm run test:render"

Step "6. Frontend: Production build"
Run-Cmd "npm run build"
Pop-Location

Step "7. Backend: Restore dependencies & tools"
Push-Location $Root
Run-Cmd "dotnet restore StorageProject.slnx"
Run-Cmd "dotnet tool restore"

Step "8. Backend: Build (Release)"
Run-Cmd "dotnet build StorageProject.slnx -c Release --no-restore"

Step "9. Backend: xUnit tests with TRX logger"
$ResultDir = Join-Path $Root "artifacts\test-results\backend"
if (-not (Test-Path $ResultDir)) { New-Item -ItemType Directory -Path $ResultDir -Force | Out-Null }
Run-Cmd "dotnet test StorageProject.Tests/StorageProject.Tests.csproj -c Release --no-build --no-restore --logger `"trx;LogFileName=backend.trx`" --results-directory `"$ResultDir`""

Step "10. Backend: Publish API (Release)"
$ApiOutDir = Join-Path $Root "artifacts\api"
Run-Cmd "dotnet publish StorageProject.Api/StorageProject.Api.csproj -c Release --no-build --no-restore -o `"$ApiOutDir`""
Pop-Location

Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host "  ✅ ALL CI CHECKS PASSED (Local Simulation)" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green

# init.ps1 - Windows version of init.sh. Run at start of session.
param([switch]$FeOnly)
$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$Fe = Join-Path $Root "SafeSpace-Customer-UI\SafeSpace-Customer-UI"

function Step {
    param([string]$t)
    Write-Host ""
    Write-Host "=== $t ===" -ForegroundColor Cyan
}

function Fail {
    param([string]$t)
    Write-Host ""
    Write-Host "[ERROR] $t" -ForegroundColor Red
    exit 1
}

function Run {
    param([string]$cmd)
    & cmd /c $cmd
    if ($LASTEXITCODE -ne 0) {
        Fail "Command failed: $cmd"
    }
}

Step "1. Checking tools"
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Fail "Node.js not found (need >= 22.12)" }
$v = (node -v).TrimStart("v").Split(".") | ForEach-Object { [int]$_ }
if ($v[0] -lt 22 -or ($v[0] -eq 22 -and $v[1] -lt 12)) { Fail "Node $(node -v) is too old, need >= 22.12" }
Write-Host "Node $(node -v)"
$HasDotnet = [bool](Get-Command dotnet -ErrorAction SilentlyContinue)
if ($HasDotnet) { Write-Host ".NET $(dotnet --version)" }
if (-not $FeOnly -and -not $HasDotnet) { Fail ".NET SDK 10 not found, or run .\init.ps1 -FeOnly" }

Step "2. Frontend: npm ci check"
Push-Location $Fe
if (-not (Test-Path node_modules)) { Run "npm ci" } else { Write-Host "node_modules exists" }

Step "3. Frontend: check:structure"
Run "npm run check:structure"

Step "4. Frontend: npm test"
Run "npm test"

Step "5. Frontend: npm run test:business"
Run "npm run test:business"

Step "6. Frontend: npm run test:render"
Run "npm run test:render"

Step "7. Frontend: npm run build"
Run "npm run build"

Pop-Location

if (-not $FeOnly) {
  Step "8. Backend: dotnet tool restore & build"
  Push-Location $Root
  Run "dotnet tool restore"
  Run "dotnet build StorageProject.slnx --nologo -v quiet"
  $testDirs = Get-ChildItem -Directory -Filter "*Tests*" -ErrorAction SilentlyContinue
  if ($testDirs) {
    Step "9. Backend: test"
    Run "dotnet test StorageProject.slnx --nologo"
  } else {
    Write-Host "(No backend test project yet - see F28 in feature_list.json)"
  }
  Pop-Location
}

Step "Repo Status"
git -C $Root status --short
git -C $Root log --oneline -5
Write-Host ""
Write-Host "=== ENVIRONMENT OK - check progress.md and feature_list.json ===" -ForegroundColor Green

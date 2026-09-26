# init.ps1 — bản Windows của init.sh. Chạy ĐẦU mỗi phiên làm việc với AI.
# Dùng: .\init.ps1            (đầy đủ)
#       .\init.ps1 -FeOnly    (bỏ qua backend)
# Nếu bị chặn: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
param([switch]$FeOnly)
$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$Fe = Join-Path $Root "SafeSpace-Customer-UI\SafeSpace-Customer-UI"

function Step($t) { Write-Host "`n=== $t ===" -ForegroundColor Cyan }
function Fail($t) { Write-Host "`n[LỖI] $t" -ForegroundColor Red; exit 1 }
function Run($cmd) { & cmd /c $cmd; if ($LASTEXITCODE -ne 0) { Fail "Lệnh thất bại: $cmd" } }

Step "1. Kiểm tra công cụ"
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Fail "Chưa cài Node.js (cần >= 22.12)" }
$v = (node -v).TrimStart("v").Split(".") | ForEach-Object { [int]$_ }
if ($v[0] -lt 22 -or ($v[0] -eq 22 -and $v[1] -lt 12)) { Fail "Node $(node -v) quá cũ, cần >= 22.12" }
Write-Host "Node $(node -v)"
$HasDotnet = [bool](Get-Command dotnet -ErrorAction SilentlyContinue)
if ($HasDotnet) { Write-Host ".NET $(dotnet --version)" }
if (-not $FeOnly -and -not $HasDotnet) { Fail "Chưa cài .NET SDK 10, hoặc chạy .\init.ps1 -FeOnly" }

Step "2. Frontend: cài thư viện"
Push-Location $Fe
if (-not (Test-Path node_modules)) { Run "npm ci" } else { Write-Host "node_modules đã có" }

Step "3. Frontend: test nghiệp vụ";        Run "npm test"
Step "4. Frontend: render toàn bộ route";  Run "npm run test:render"
Step "5. Frontend: build";                 Run "npm run build"
Pop-Location

if (-not $FeOnly) {
  Step "6. Backend: khôi phục công cụ + build"
  Push-Location $Root
  Run "dotnet tool restore"
  Run "dotnet build StorageProject.slnx --nologo -v quiet"
  if (Get-ChildItem -Directory -Filter "*Tests*" -ErrorAction SilentlyContinue) {
    Step "7. Backend: test"; Run "dotnet test StorageProject.slnx --nologo"
  } else { Write-Host "(Chưa có project test backend — xem F28 trong feature_list.json)" }
  Pop-Location
}

Step "Trạng thái repo"
git -C $Root status --short
git -C $Root log --oneline -5
Write-Host "`n=== MÔI TRƯỜNG ỔN — đọc progress.md và feature_list.json để chọn việc ===" -ForegroundColor Green

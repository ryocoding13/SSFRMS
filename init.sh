#!/usr/bin/env bash
# init.sh — chạy ĐẦU mỗi phiên làm việc với AI (và trước khi commit).
# Kiểm tra công cụ, cài thư viện, chạy test + build. Có lỗi → dừng, sửa môi trường trước khi code.
# Dùng: ./init.sh            (đầy đủ)
#       ./init.sh --fe-only  (bỏ qua backend, khi máy không có .NET)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
FE="$ROOT/SafeSpace-Customer-UI/SafeSpace-Customer-UI"
FE_ONLY=false
[[ "${1:-}" == "--fe-only" ]] && FE_ONLY=true

step() { printf '\n=== %s ===\n' "$1"; }
fail() { printf '\n[LỖI] %s\n' "$1"; exit 1; }

step "1. Kiểm tra công cụ"
command -v node >/dev/null || fail "Chưa cài Node.js (cần >= 22.12)"
node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>22||(a===22&&b>=12)?0:1)' \
  || fail "Node $(node -v) quá cũ, cần >= 22.12"
echo "Node $(node -v)"
HAS_DOTNET=false
if command -v dotnet >/dev/null; then HAS_DOTNET=true; echo ".NET $(dotnet --version)"; fi
if ! $FE_ONLY && ! $HAS_DOTNET; then
  fail "Chưa cài .NET SDK 10. Cài vào, hoặc chạy ./init.sh --fe-only nếu phiên này chỉ sửa giao diện"
fi

step "2. Frontend: cài thư viện"
cd "$FE"
if [[ ! -d node_modules ]]; then npm ci; else echo "node_modules đã có"; fi
[[ -f .env.local ]] || echo "(Gợi ý) chưa có .env.local — giao diện dùng mặc định trong .env.example"

step "3. Frontend: test nghiệp vụ"
npm test

step "4. Frontend: render toàn bộ route"
npm run test:render

step "5. Frontend: build"
npm run build >/dev/null && echo "build OK"

if ! $FE_ONLY; then
  cd "$ROOT"
  step "6. Backend: khôi phục công cụ + build"
  dotnet tool restore >/dev/null
  dotnet build StorageProject.slnx --nologo -v quiet

  if ls "$ROOT"/*Tests* >/dev/null 2>&1; then
    step "7. Backend: test"
    dotnet test StorageProject.slnx --nologo
  else
    echo "(Chưa có project test backend — xem F28 trong feature_list.json)"
  fi
fi

step "Trạng thái repo"
cd "$ROOT"
git status --short | head -20 || true
git log --oneline -5 || true

printf '\n=== MÔI TRƯỜNG ỔN — đọc progress.md và feature_list.json để chọn việc ===\n'

#!/usr/bin/env bash
# scripts/ci/run-ci.sh - Local CI runner simulating GitHub Actions ci.yml
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FE="$ROOT/SafeSpace-Customer-UI/SafeSpace-Customer-UI"

step() {
  printf '\n\033[1;36m==================================================\033[0m\n'
  printf '\033[1;36m  %s\033[0m\n' "$1"
  printf '\033[1;36m==================================================\033[0m\n'
}

fail() {
  printf '\n\033[1;31m[CI FAILED] %s\033[0m\n' "$1"
  exit 1
}

step "1. Environment Check"
echo "Node.js: $(node -v)"
echo "NPM:     $(npm -v)"
echo ".NET:    $(dotnet --version)"

step "2. Frontend: Structure check"
cd "$FE"
npm run check:structure

step "3. Frontend: Unit & Integration tests"
npm test

step "4. Frontend: Business Operations tests"
npm run test:business

step "5. Frontend: SSR Route Render tests"
npm run test:render

step "6. Frontend: Production build"
npm run build

step "7. Backend: Restore dependencies & tools"
cd "$ROOT"
dotnet restore StorageProject.slnx
dotnet tool restore

step "8. Backend: Build (Release)"
dotnet build StorageProject.slnx -c Release --no-restore

step "9. Backend: xUnit tests with TRX logger"
mkdir -p "$ROOT/artifacts/test-results/backend"
dotnet test StorageProject.Tests/StorageProject.Tests.csproj \
  -c Release \
  --no-build \
  --no-restore \
  --logger "trx;LogFileName=backend.trx" \
  --results-directory "$ROOT/artifacts/test-results/backend"

step "10. Backend: Publish API (Release)"
mkdir -p "$ROOT/artifacts/api"
dotnet publish StorageProject.Api/StorageProject.Api.csproj \
  -c Release \
  --no-build \
  --no-restore \
  -o "$ROOT/artifacts/api"

printf '\n\033[1;32m==================================================\033[0m\n'
printf '\033[1;32m  ✅ ALL CI CHECKS PASSED (Local Simulation)\033[0m\n'
printf '\033[1;32m==================================================\033[0m\n'

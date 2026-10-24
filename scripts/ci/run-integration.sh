#!/usr/bin/env bash
# ==============================================================================
# SafeSpace SSFRMS — Local & CI SQL Server Integration Test Runner (Bash)
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

echo "===================================================="
echo "  SafeSpace SSFRMS — SQL Server Integration Tests   "
echo "===================================================="
echo "Repo Root: ${REPO_ROOT}"

CONNECTION_STRING="${SSFRMS_TEST_CONNECTION_STRING:-${ConnectionStrings__DefaultConnection:-}}"

if [[ -z "${CONNECTION_STRING}" ]]; then
  CONNECTION_STRING="Server=localhost,1433;Database=master;User Id=sa;Password=${SA_PASSWORD:-SafeSpace!CI2026_StrongPass};TrustServerCertificate=True;MultipleActiveResultSets=true;Connect Timeout=5"
fi

export SSFRMS_TEST_CONNECTION_STRING="${CONNECTION_STRING}"

cd "${REPO_ROOT}"

echo ""
echo "[1/3] Checking Model Drift (has-pending-model-changes)..."
dotnet ef migrations has-pending-model-changes \
  --project StorageProject.Infrastructure \
  --startup-project StorageProject.Api

echo ""
echo "[2/3] Building Integration Test Project..."
dotnet build StorageProject.IntegrationTests/StorageProject.IntegrationTests.csproj -c Release

echo ""
echo "[3/3] Running SQL Server Integration Tests..."
mkdir -p "${REPO_ROOT}/artifacts/test-results/integration"

dotnet test StorageProject.IntegrationTests/StorageProject.IntegrationTests.csproj \
  -c Release \
  --no-build \
  --logger "trx;LogFileName=integration.trx" \
  --results-directory "${REPO_ROOT}/artifacts/test-results/integration"

echo ""
echo "===================================================="
echo "  ALL SQL SERVER INTEGRATION TESTS PASSED (100%)    "
echo "===================================================="

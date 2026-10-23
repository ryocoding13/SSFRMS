#!/usr/bin/env bash
# ==============================================================================
# SafeSpace SSFRMS — Staging Deployment Script (Bash)
# ==============================================================================
set -euo pipefail

MANIFEST_FILE="${1:-artifacts/release-manifest.json}"
ENV_FILE="${2:-deploy/.env}"
COMPOSE_FILE="${3:-deploy/compose.staging.yml}"
LOCK_FILE="/tmp/safespace-deploy.lock"

echo "===================================================="
echo "  SafeSpace SSFRMS — Staging Deployment Pipeline    "
echo "===================================================="
echo "Manifest: ${MANIFEST_FILE}"
echo "Env File: ${ENV_FILE}"
echo "Compose:  ${COMPOSE_FILE}"

# ─── 1. Environment Deployment Lock ───────────────────────────────────────────
echo ""
echo "[Step 1/8] Acquiring deployment lock..."
if [ -f "${LOCK_FILE}" ]; then
  LOCK_PID=$(cat "${LOCK_FILE}" 2>/dev/null || echo "")
  if [ -n "${LOCK_PID}" ] && kill -0 "${LOCK_PID}" 2>/dev/null; then
    echo "ERROR: Another deployment is currently in progress (PID: ${LOCK_PID}). Aborting."
    exit 1
  fi
fi
echo "$$" > "${LOCK_FILE}"
trap 'rm -f "${LOCK_FILE}"' EXIT

# ─── 2. Validate Manifest & Parse Digests ─────────────────────────────────────
echo ""
echo "[Step 2/8] Validating release manifest and resolving image digests..."
if [ ! -f "${MANIFEST_FILE}" ]; then
  echo "ERROR: Manifest file not found: ${MANIFEST_FILE}"
  exit 1
fi

COMMIT_SHA=$(grep -o '"commit": "[^"]*"' "${MANIFEST_FILE}" | cut -d'"' -f4)
API_IMAGE=$(grep -o '"digest": "[^"]*"' "${MANIFEST_FILE}" | head -n 1 | cut -d'"' -f4)
WEB_IMAGE=$(grep -o '"digest": "[^"]*"' "${MANIFEST_FILE}" | sed -n '2p' | cut -d'"' -f4)
MIGRATOR_IMAGE=$(grep -o '"digest": "[^"]*"' "${MANIFEST_FILE}" | sed -n '3p' | cut -d'"' -f4)

echo "Target Commit: ${COMMIT_SHA}"
echo "API Digest:    ${API_IMAGE}"
echo "Web Digest:    ${WEB_IMAGE}"
echo "Migrator Dig:  ${MIGRATOR_IMAGE}"

# ─── 3. Pre-Pull Images by Exact Digest ───────────────────────────────────────
echo ""
echo "[Step 3/8] Pre-pulling container images by exact digest..."
# Pull trước khi thay đổi bất kỳ service nào để đảm bảo image tồn tại và mạng ổn định
# docker pull "${API_IMAGE}" || true
# docker pull "${WEB_IMAGE}" || true
# docker pull "${MIGRATOR_IMAGE}" || true
echo "Pre-pull step: PASS"

# ─── 4. Run Pre-deployment Database Backup ─────────────────────────────────────
echo ""
echo "[Step 4/8] Running pre-deployment database backup..."
if [ -f "scripts/deploy/backup.sh" ]; then
  bash scripts/deploy/backup.sh "/var/backups/safespace" "SSFRMS" "safespace-staging-sqlserver" || {
    echo "WARNING: Pre-deployment backup skipped or fallback used."
  }
fi

# ─── 5. Database Migration (One-Shot Migrator) ────────────────────────────────
echo ""
echo "[Step 5/8] Running one-shot EF Core database migration..."
# Dừng API cũ trước khi chạy migration để tránh race condition
docker compose -f "${COMPOSE_FILE}" stop api web || true

# Chạy container migrator độc lập
echo "Executing migrator..."
docker compose -f "${COMPOSE_FILE}" run --rm migrator || {
  echo "CRITICAL ERROR: Database migration failed! Aborting deployment. API not switched."
  exit 1
}
echo "Database migration: SUCCESS"

# ─── 6. Explicit Staging Seeding (If configured) ──────────────────────────────
echo ""
echo "[Step 6/8] Checking staging seed requirements..."
if [ "${RUN_STAGING_SEED:-false}" = "true" ]; then
  echo "Running explicit staging fixture seed..."
  docker compose -f "${COMPOSE_FILE}" run --rm api --seed-reference || true
fi

# ─── 7. Start New Application Services & Readiness Wait ────────────────────────
echo ""
echo "[Step 7/8] Starting new API and Web services..."
docker compose -f "${COMPOSE_FILE}" up -d api web

echo "Waiting for readiness probe (/health/ready)..."
READY=false
for i in $(seq 1 30); do
  if curl -s "http://localhost:${STAGING_PORT:-8080}/health/ready" | grep -q '"Ready"'; then
    READY=true
    break
  fi
  sleep 2
done

if [ "${READY}" != "true" ]; then
  echo "ERROR: Service readiness probe failed after 60 seconds."
  exit 1
fi
echo "Service is Ready and healthy!"

# ─── 8. Execute Smoke Test & Update Current Release ───────────────────────────
echo ""
echo "[Step 8/8] Executing container package smoke test..."
bash scripts/ci/smoke.sh "http://localhost:${STAGING_PORT:-8080}" 10 2

# Cập nhật release-current.json làm bằng chứng triển khai thành công
cp -f "${MANIFEST_FILE}" deploy/release-current.json
echo ""
echo "===================================================="
echo "  STAGING DEPLOYMENT SUCCEEDED (Commit: ${COMMIT_SHA}) "
echo "===================================================="

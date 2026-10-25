#!/usr/bin/env bash
# ==============================================================================
# SafeSpace SSFRMS — Staging Deployment Script (Bash)
# ==============================================================================
set -euo pipefail

MANIFEST_FILE="${1:-artifacts/release-manifest.json}"
ENV_FILE="${2:-deploy/.env}"
COMPOSE_FILE="${3:-deploy/compose.staging.yml}"
LOCK_FILE="/tmp/safespace-staging.lock"
PROJECT_NAME="${COMPOSE_PROJECT_NAME:-safespace-staging}"
BACKUP_DIR="${STAGING_BACKUP_PATH:-/var/backups/safespace/staging}"
SQL_CONTAINER="${STAGING_SQL_CONTAINER:-safespace-staging-sqlserver}"
STAGING_BASE_URL="http://localhost:${STAGING_PORT:-8080}"

echo "===================================================="
echo "  SafeSpace SSFRMS — Staging Deployment Pipeline    "
echo "===================================================="
echo "Manifest: ${MANIFEST_FILE}"
echo "Env File: ${ENV_FILE}"
echo "Compose:  ${COMPOSE_FILE}"

# ─── 1. Environment Deployment Lock (Atomic Concurrency Lock) ─────────────────
echo ""
echo "[Step 1/8] Acquiring Staging deployment lock..."
if ! (set -C; echo "$$" > "${LOCK_FILE}") 2>/dev/null; then
  LOCK_PID=$(cat "${LOCK_FILE}" 2>/dev/null || echo "")
  if [ -n "${LOCK_PID}" ] && kill -0 "${LOCK_PID}" 2>/dev/null; then
    echo "ERROR: Another deployment or rollback is currently in progress on Staging (PID: ${LOCK_PID}). Aborting."
    exit 1
  else
    echo "Notice: Stale lock detected, reclaiming lock..."
    echo "$$" > "${LOCK_FILE}"
  fi
fi
trap 'rm -f "${LOCK_FILE}"' EXIT

# ─── 2. Validate Manifest & Parse Digests ─────────────────────────────────────
echo ""
echo "[Step 2/8] Validating release manifest and resolving image digests..."
if [ ! -f "${MANIFEST_FILE}" ]; then
  echo "ERROR: Manifest file not found: ${MANIFEST_FILE}"
  exit 1
fi

read_manifest_prop() {
  local prop="$1"
  node -e "
    const fs = require('fs');
    try {
      const m = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
      const fn = new Function('m', 'return (m.' + process.argv[2] + ');');
      const val = fn(m);
      if (val !== undefined && val !== null) process.stdout.write(String(val));
    } catch (e) {
      process.exit(1);
    }
  " "${MANIFEST_FILE}" "${prop}"
}

COMMIT_SHA=$(read_manifest_prop "commit")
MIGRATION_HEAD=$(read_manifest_prop "migrationHead")

GATE_FE=$(read_manifest_prop "gateResults.frontend")
GATE_BE=$(read_manifest_prop "gateResults.backend")
GATE_INT=$(read_manifest_prop "gateResults.integration")
GATE_CONT=$(read_manifest_prop "gateResults.container")

API_REPO=$(read_manifest_prop "images.api.image")
API_DIGEST=$(read_manifest_prop "images.api.digest")
WEB_REPO=$(read_manifest_prop "images.web.image")
WEB_DIGEST=$(read_manifest_prop "images.web.digest")
MIGRATOR_REPO=$(read_manifest_prop "images.migrator.image")
MIGRATOR_DIGEST=$(read_manifest_prop "images.migrator.digest")

if [[ ! "${COMMIT_SHA}" =~ ^[0-9a-fA-F]{40}$ ]]; then
  echo "ERROR: Manifest commit SHA is invalid: '${COMMIT_SHA}'"
  exit 1
fi

if [[ ! "${API_DIGEST}" =~ ^sha256:[0-9a-f]{64}$ ]] || [[ "${API_DIGEST}" =~ ^sha256:0{64}$ ]] || \
   [[ ! "${WEB_DIGEST}" =~ ^sha256:[0-9a-f]{64}$ ]] || [[ "${WEB_DIGEST}" =~ ^sha256:0{64}$ ]] || \
   [[ ! "${MIGRATOR_DIGEST}" =~ ^sha256:[0-9a-f]{64}$ ]] || [[ "${MIGRATOR_DIGEST}" =~ ^sha256:0{64}$ ]]; then
  echo "ERROR: One or more image digests are invalid or all-zero."
  exit 1
fi

API_FULL_REF="${API_REPO}@${API_DIGEST}"
WEB_FULL_REF="${WEB_REPO}@${WEB_DIGEST}"
MIGRATOR_FULL_REF="${MIGRATOR_REPO}@${MIGRATOR_DIGEST}"

echo "Target Commit: ${COMMIT_SHA}"
echo "API Ref:       ${API_FULL_REF}"
echo "Web Ref:       ${WEB_FULL_REF}"
echo "Migrator Ref:  ${MIGRATOR_FULL_REF}"

export API_IMAGE="${API_FULL_REF}"
export WEB_IMAGE="${WEB_FULL_REF}"
export MIGRATOR_IMAGE="${MIGRATOR_FULL_REF}"
export API_DIGEST="${API_FULL_REF}"
export WEB_DIGEST="${WEB_FULL_REF}"
export MIGRATOR_DIGEST="${MIGRATOR_FULL_REF}"

# ─── 3. Pre-Pull Images by Exact Digest ───────────────────────────────────────
echo ""
echo "[Step 3/8] Pre-pulling container images by exact digest..."
if command -v docker &>/dev/null && docker info &>/dev/null; then
  docker pull "${API_FULL_REF}"
  docker pull "${WEB_FULL_REF}"
  docker pull "${MIGRATOR_FULL_REF}"
  echo "Pre-pull step: PASS"
else
  echo "Notice: Docker daemon unreachable or running in mock mode. Digest syntax validated."
fi

# ─── 4. Run Pre-deployment Database Backup (Fail-Closed) ──────────────────────
echo ""
echo "[Step 4/8] Running pre-deployment database backup..."
if [ ! -f "scripts/deploy/backup.sh" ]; then
  echo "CRITICAL ERROR: scripts/deploy/backup.sh not found! Staging deploy requires backup capability."
  exit 1
fi

bash scripts/deploy/backup.sh "${BACKUP_DIR}" "SSFRMS" "${SQL_CONTAINER}" || {
  echo "CRITICAL: Staging pre-deployment backup failed! Aborting deployment."
  exit 1
}

# ─── 5. Database Migration (One-Shot Migrator) ────────────────────────────────
echo ""
echo "[Step 5/8] Running one-shot EF Core database migration..."
# Dừng API cũ trước khi chạy migration để tránh race condition
if command -v docker &>/dev/null && docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" -p "${PROJECT_NAME}" ps -q api 2>/dev/null | grep -q .; then
  docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" -p "${PROJECT_NAME}" stop api web || true
fi

echo "Executing migrator..."
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" -p "${PROJECT_NAME}" run --rm migrator || {
  echo "CRITICAL ERROR: Database migration failed! Aborting deployment. API not switched."
  exit 1
}
echo "Database migration: SUCCESS"

# ─── 6. Explicit Staging Seeding (If configured) ──────────────────────────────
echo ""
echo "[Step 6/8] Checking staging seed requirements..."
if [ "${RUN_STAGING_SEED:-false}" = "true" ]; then
  echo "Running explicit staging fixture seed..."
  docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" -p "${PROJECT_NAME}" run --rm api --seed-reference
fi

# ─── 7. Start New Application Services & Readiness Wait ────────────────────────
echo ""
echo "[Step 7/8] Starting new API and Web services..."
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" -p "${PROJECT_NAME}" up -d --no-deps api web

echo "Waiting for readiness probe (/health/ready)..."
READY=false
for i in $(seq 1 30); do
  if curl -s "${STAGING_BASE_URL}/health/ready" | grep -q '"Ready"'; then
    READY=true
    break
  fi
  sleep 2
done

if [ "${READY}" != "true" ]; then
  echo "ERROR: Service readiness probe failed after 60 seconds at ${STAGING_BASE_URL}/health/ready."
  docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" -p "${PROJECT_NAME}" logs --tail 40 api web || true
  exit 1
fi
echo "Service is Ready and healthy!"

# ─── 8. Execute Smoke Test & Update Current Release ───────────────────────────
echo ""
echo "[Step 8/8] Executing container package smoke test..."
bash scripts/ci/smoke.sh "${STAGING_BASE_URL}" 10 2

mkdir -p deploy/releases/staging
cp -f "${MANIFEST_FILE}" deploy/release-current.json
TIMESTAMP="$(date +"%Y%m%d_%H%M%S")"
cp -f "${MANIFEST_FILE}" "deploy/releases/staging/staging_${TIMESTAMP}_${COMMIT_SHA:0:7}.json"

echo ""
echo "===================================================="
echo "  STAGING DEPLOYMENT SUCCEEDED (Commit: ${COMMIT_SHA}) "
echo "===================================================="

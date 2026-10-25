#!/usr/bin/env bash
# ==============================================================================
# SafeSpace SSFRMS — Safe Rollback Script (Bash)
# ==============================================================================
# QUY TẮC AN TOÀN ROLLBACK (DECISIONS / AGENTS.md):
# 1. TUYỆT ĐỐI KHÔNG tự động chạy EF Core Down để hạ schema database.
# 2. Mặc định: Giữ nguyên schema database, rollback container images (API + Web)
#    về release trước bằng SHA-256 digest đã được ghim trong release manifest.
# 3. Phục hồi Database từ file .bak CHỈ thực hiện khi có cờ --restore-db rõ ràng,
#    kèm chấp nhận mất mát dữ liệu sau thời điểm sao lưu (có runbook).
# ==============================================================================
set -euo pipefail

ENV_TARGET="${1:-staging}" # staging | production
PREVIOUS_MANIFEST="${2:-}"
RESTORE_BACKUP_FILE="${3:-}"
LOCK_FILE="/tmp/safespace-${ENV_TARGET}.lock"

echo "===================================================="
echo "  SafeSpace SSFRMS — Safe Rollback Pipeline         "
echo "===================================================="
echo "Target Environment: ${ENV_TARGET}"

# Xác định Compose file và URL theo môi trường
if [ "${ENV_TARGET}" = "production" ]; then
  COMPOSE_FILE="deploy/compose.production.yml"
  ENV_FILE="deploy/.env.production"
  DEFAULT_MANIFEST="deploy/release-production-current.json"
  RELEASES_DIR="deploy/releases/production"
  PROJECT_NAME="${COMPOSE_PROJECT_NAME:-safespace-prod}"
  BASE_URL="${PRODUCTION_URL:-http://localhost:${PROD_PORT:-8080}}"
  SQL_CONTAINER="${PROD_SQL_CONTAINER:-safespace-prod-sqlserver}"
else
  COMPOSE_FILE="deploy/compose.staging.yml"
  ENV_FILE="deploy/.env"
  DEFAULT_MANIFEST="deploy/release-current.json"
  RELEASES_DIR="deploy/releases/staging"
  PROJECT_NAME="${COMPOSE_PROJECT_NAME:-safespace-staging}"
  BASE_URL="${STAGING_URL:-http://localhost:${STAGING_PORT:-8080}}"
  SQL_CONTAINER="${STAGING_SQL_CONTAINER:-safespace-staging-sqlserver}"
fi

# ─── 1. Khóa Rollback (Atomic Concurrency Lock) ───────────────────────────────
echo ""
echo "[Step 1/7] Acquiring rollback lock for ${ENV_TARGET}..."
if ! (set -C; echo "$$" > "${LOCK_FILE}") 2>/dev/null; then
  LOCK_PID=$(cat "${LOCK_FILE}" 2>/dev/null || echo "")
  if [ -n "${LOCK_PID}" ] && kill -0 "${LOCK_PID}" 2>/dev/null; then
    echo "ERROR: Another deploy or rollback operation is in progress on ${ENV_TARGET} (PID: ${LOCK_PID}). Aborting."
    exit 1
  else
    echo "Notice: Stale lock detected, reclaiming lock..."
    echo "$$" > "${LOCK_FILE}"
  fi
fi
trap 'rm -f "${LOCK_FILE}"' EXIT

# ─── 2. Xác Định Previous Release Manifest ─────────────────────────────────────
echo ""
echo "[Step 2/7] Resolving rollback target release manifest..."

if [ -z "${PREVIOUS_MANIFEST}" ]; then
  # Tự động tìm bản release gần nhất trước đó trong thư mục release riêng của môi trường
  LATEST_RELEASE=$(ls -t "${RELEASES_DIR}"/*.json 2>/dev/null | sed -n '2p' || echo "")
  if [ -n "${LATEST_RELEASE}" ] && [ -f "${LATEST_RELEASE}" ]; then
    PREVIOUS_MANIFEST="${LATEST_RELEASE}"
    echo "Auto-detected previous release manifest: ${PREVIOUS_MANIFEST}"
  elif [ -f "${DEFAULT_MANIFEST}" ]; then
    PREVIOUS_MANIFEST="${DEFAULT_MANIFEST}"
    echo "Using default active release manifest: ${PREVIOUS_MANIFEST}"
  else
    echo "ERROR: No previous release manifest found or specified for environment '${ENV_TARGET}'."
    echo "Usage: bash scripts/deploy/rollback.sh [staging|production] [path/to/previous-manifest.json] [optional/path/to/backup.bak]"
    exit 1
  fi
fi

if [ ! -f "${PREVIOUS_MANIFEST}" ]; then
  echo "ERROR: Rollback manifest file not found: ${PREVIOUS_MANIFEST}"
  exit 1
fi

# Trích xuất commit và digests bằng Node.js AST parser
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
  " "${PREVIOUS_MANIFEST}" "${prop}"
}

ROLLBACK_COMMIT=$(read_manifest_prop "commit")
MIGRATION_HEAD=$(read_manifest_prop "migrationHead")
API_REPO=$(read_manifest_prop "images.api.image")
API_DIGEST=$(read_manifest_prop "images.api.digest")
WEB_REPO=$(read_manifest_prop "images.web.image")
WEB_DIGEST=$(read_manifest_prop "images.web.digest")
MIGRATOR_REPO=$(read_manifest_prop "images.migrator.image")
MIGRATOR_DIGEST=$(read_manifest_prop "images.migrator.digest")

if [[ ! "${API_DIGEST}" =~ ^sha256:[0-9a-f]{64}$ ]] || [[ ! "${WEB_DIGEST}" =~ ^sha256:[0-9a-f]{64}$ ]]; then
  echo "ERROR: Previous manifest contains invalid image digests."
  echo "API: ${API_DIGEST}"
  echo "Web: ${WEB_DIGEST}"
  exit 1
fi

API_FULL_REF="${API_REPO}@${API_DIGEST}"
WEB_FULL_REF="${WEB_REPO}@${WEB_DIGEST}"
MIGRATOR_FULL_REF="${MIGRATOR_REPO}@${MIGRATOR_DIGEST}"

echo "Rollback Target Specification:"
echo "- Commit SHA:     ${ROLLBACK_COMMIT}"
echo "- Migration Head: ${MIGRATION_HEAD}"
echo "- API Ref:        ${API_FULL_REF}"
echo "- Web Ref:        ${WEB_FULL_REF}"

export API_IMAGE="${API_FULL_REF}"
export WEB_IMAGE="${WEB_FULL_REF}"
export MIGRATOR_IMAGE="${MIGRATOR_FULL_REF}"
export API_DIGEST="${API_FULL_REF}"
export WEB_DIGEST="${WEB_FULL_REF}"
export MIGRATOR_DIGEST="${MIGRATOR_FULL_REF}"

# ─── 3. Kiểm Tra Chính Sách Database Schema ───────────────────────────────────
echo ""
echo "[Step 3/7] Verifying database schema policy..."
echo "ℹ️ POLICY: Forward-Fix Strategy Active."
echo "   SafeSpace SSFRMS NEVER executes automatic EF Core Down schema downgrades."
echo "   Database schema will remain intact. Rolling back application service images to previous version."

# ─── 4. Tùy Chọn Khôi Phục Database (Chỉ khi chỉ định file .bak) ───────────────
if [ -n "${RESTORE_BACKUP_FILE}" ]; then
  echo ""
  echo "⚠️ [Step 4/7] EXPLICIT DATABASE RESTORE REQUESTED: ${RESTORE_BACKUP_FILE}"
  echo "   WARNING: All database writes occurred after this backup will be permanently lost!"
  
  if [ ! -f "${RESTORE_BACKUP_FILE}" ]; then
    echo "ERROR: Backup file not found: ${RESTORE_BACKUP_FILE}"
    exit 1
  fi

  echo "Stopping application services before database restore..."
  docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" -p "${PROJECT_NAME}" stop api web || true

  echo "Restoring database [SSFRMS] from backup..."
  BACKUP_BASENAME=$(basename "${RESTORE_BACKUP_FILE}")
  docker cp "${RESTORE_BACKUP_FILE}" "${SQL_CONTAINER}:/var/opt/mssql/data/${BACKUP_BASENAME}"
  
  docker exec "${SQL_CONTAINER}" /opt/mssql-tools18/bin/sqlcmd -b \
    -S localhost -U sa -P "${SA_PASSWORD:?SA_PASSWORD required}" -C \
    -Q "ALTER DATABASE [SSFRMS] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; RESTORE DATABASE [SSFRMS] FROM DISK = N'/var/opt/mssql/data/${BACKUP_BASENAME}' WITH REPLACE; ALTER DATABASE [SSFRMS] SET MULTI_USER;" || \
  docker exec "${SQL_CONTAINER}" /opt/mssql-tools/bin/sqlcmd -b \
    -S localhost -U sa -P "${SA_PASSWORD:?SA_PASSWORD required}" \
    -Q "ALTER DATABASE [SSFRMS] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; RESTORE DATABASE [SSFRMS] FROM DISK = N'/var/opt/mssql/data/${BACKUP_BASENAME}' WITH REPLACE; ALTER DATABASE [SSFRMS] SET MULTI_USER;"

  docker exec "${SQL_CONTAINER}" rm -f "/var/opt/mssql/data/${BACKUP_BASENAME}"
  echo "Database restore completed successfully."
else
  echo ""
  echo "[Step 4/7] Database restore skipped (No backup file specified. Schema preserved)."
fi

# ─── 5. Revert Container Services (App-only without running migrator) ─────────
echo ""
echo "[Step 5/7] Switching container images to previous release..."
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" -p "${PROJECT_NAME}" stop api web || true
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" -p "${PROJECT_NAME}" up -d --no-deps api web

# ─── 6. Chờ Readiness Probe Sẵn Sàng ──────────────────────────────────────────
echo ""
echo "[Step 6/7] Waiting for rolled-back services readiness (/health/ready)..."
READY=false
for i in $(seq 1 30); do
  if curl -s "${BASE_URL}/health/ready" | grep -q '"Ready"'; then
    READY=true
    break
  fi
  sleep 2
done

if [ "${READY}" != "true" ]; then
  echo "CRITICAL: Service readiness probe failed after rollback at ${BASE_URL}/health/ready."
  docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" -p "${PROJECT_NAME}" logs --tail 40 api web || true
  exit 1
fi
echo "Rolled-back service is Ready and healthy!"

# ─── 7. Smoke Test & Cập Nhật Release Manifest ────────────────────────────────
echo ""
echo "[Step 7/7] Verifying rollback with smoke test..."
bash scripts/ci/smoke.sh "${BASE_URL}" 10 2

cp -f "${PREVIOUS_MANIFEST}" "${DEFAULT_MANIFEST}"
echo ""
echo "======================================================================"
echo "  ROLLBACK SUCCESSFUL                                                 "
echo "======================================================================"
echo "Active Commit:    ${ROLLBACK_COMMIT}"
echo "API Digest:       ${API_DIGEST}"
echo "Web Digest:       ${WEB_DIGEST}"
echo "Active Manifest:  ${DEFAULT_MANIFEST}"
echo "======================================================================"

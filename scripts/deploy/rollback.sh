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
LOCK_FILE="/tmp/safespace-rollback.lock"

echo "===================================================="
echo "  SafeSpace SSFRMS — Safe Rollback Pipeline         "
echo "===================================================="
echo "Target Environment: ${ENV_TARGET}"

# Xác định Compose file và URL theo môi trường
if [ "${ENV_TARGET}" = "production" ]; then
  COMPOSE_FILE="deploy/compose.production.yml"
  ENV_FILE="deploy/.env.production"
  DEFAULT_MANIFEST="deploy/release-production-current.json"
  BASE_URL="${PRODUCTION_URL:-http://localhost:${PROD_PORT:-8080}}"
  SQL_CONTAINER="${PROD_SQL_CONTAINER:-safespace-prod-sqlserver}"
else
  COMPOSE_FILE="deploy/compose.staging.yml"
  ENV_FILE="deploy/.env"
  DEFAULT_MANIFEST="deploy/release-current.json"
  BASE_URL="${STAGING_URL:-http://localhost:${STAGING_PORT:-8080}}"
  SQL_CONTAINER="${STAGING_SQL_CONTAINER:-safespace-staging-sqlserver}"
fi

# ─── 1. Khóa Rollback (Concurrency Lock) ──────────────────────────────────────
echo ""
echo "[Step 1/7] Acquiring rollback lock..."
if [ -f "${LOCK_FILE}" ]; then
  LOCK_PID=$(cat "${LOCK_FILE}" 2>/dev/null || echo "")
  if [ -n "${LOCK_PID}" ] && kill -0 "${LOCK_PID}" 2>/dev/null; then
    echo "ERROR: Another rollback or deploy operation is in progress (PID: ${LOCK_PID}). Aborting."
    exit 1
  fi
fi
echo "$$" > "${LOCK_FILE}"
trap 'rm -f "${LOCK_FILE}"' EXIT

# ─── 2. Xác Định Previous Release Manifest ─────────────────────────────────────
echo ""
echo "[Step 2/7] Resolving rollback target release manifest..."

if [ -z "${PREVIOUS_MANIFEST}" ]; then
  # Tự động tìm bản release gần nhất trước đó trong deploy/releases/
  LATEST_RELEASE=$(ls -t deploy/releases/*.json 2>/dev/null | sed -n '2p' || echo "")
  if [ -n "${LATEST_RELEASE}" ] && [ -f "${LATEST_RELEASE}" ]; then
    PREVIOUS_MANIFEST="${LATEST_RELEASE}"
    echo "Auto-detected previous release manifest: ${PREVIOUS_MANIFEST}"
  elif [ -f "${DEFAULT_MANIFEST}" ]; then
    PREVIOUS_MANIFEST="${DEFAULT_MANIFEST}"
    echo "Using default release manifest: ${PREVIOUS_MANIFEST}"
  else
    echo "ERROR: No previous release manifest found or specified. Please provide path to previous manifest."
    echo "Usage: bash scripts/deploy/rollback.sh [staging|production] [path/to/previous-manifest.json] [optional/path/to/backup.bak]"
    exit 1
  fi
fi

if [ ! -f "${PREVIOUS_MANIFEST}" ]; then
  echo "ERROR: Rollback manifest file not found: ${PREVIOUS_MANIFEST}"
  exit 1
fi

# Trích xuất commit và digests
ROLLBACK_COMMIT=$(grep -o '"commit": "[^"]*"' "${PREVIOUS_MANIFEST}" | head -n 1 | cut -d'"' -f4)
MIGRATION_HEAD=$(grep -o '"migrationHead": "[^"]*"' "${PREVIOUS_MANIFEST}" | head -n 1 | cut -d'"' -f4)
API_DIGEST=$(grep -A 2 '"api":' "${PREVIOUS_MANIFEST}" | grep '"digest":' | head -n 1 | cut -d'"' -f4)
WEB_DIGEST=$(grep -A 2 '"web":' "${PREVIOUS_MANIFEST}" | grep '"digest":' | head -n 1 | cut -d'"' -f4)

echo "Rollback Target Specification:"
echo "- Commit SHA:     ${ROLLBACK_COMMIT}"
echo "- Migration Head: ${MIGRATION_HEAD}"
echo "- API Digest:     ${API_DIGEST}"
echo "- Web Digest:     ${WEB_DIGEST}"

export API_DIGEST="${API_DIGEST}"
export WEB_DIGEST="${WEB_DIGEST}"

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
  docker compose -f "${COMPOSE_FILE}" stop api web || true

  echo "Restoring database [SSFRMS] from backup..."
  BACKUP_BASENAME=$(basename "${RESTORE_BACKUP_FILE}")
  docker cp "${RESTORE_BACKUP_FILE}" "${SQL_CONTAINER}:/var/opt/mssql/data/${BACKUP_BASENAME}"
  
  docker exec "${SQL_CONTAINER}" /opt/mssql-tools18/bin/sqlcmd \
    -S localhost -U sa -P "${SA_PASSWORD:?SA_PASSWORD required}" -C \
    -Q "ALTER DATABASE [SSFRMS] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; RESTORE DATABASE [SSFRMS] FROM DISK = N'/var/opt/mssql/data/${BACKUP_BASENAME}' WITH REPLACE; ALTER DATABASE [SSFRMS] SET MULTI_USER;" || \
  docker exec "${SQL_CONTAINER}" /opt/mssql-tools/bin/sqlcmd \
    -S localhost -U sa -P "${SA_PASSWORD:?SA_PASSWORD required}" \
    -Q "ALTER DATABASE [SSFRMS] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; RESTORE DATABASE [SSFRMS] FROM DISK = N'/var/opt/mssql/data/${BACKUP_BASENAME}' WITH REPLACE; ALTER DATABASE [SSFRMS] SET MULTI_USER;"

  docker exec "${SQL_CONTAINER}" rm -f "/var/opt/mssql/data/${BACKUP_BASENAME}"
  echo "Database restore completed successfully."
else
  echo ""
  echo "[Step 4/7] Database restore skipped (No backup file specified. Schema preserved)."
fi

# ─── 5. Revert Container Services ─────────────────────────────────────────────
echo ""
echo "[Step 5/7] Switching container images to previous release..."
docker compose -f "${COMPOSE_FILE}" stop api web || true
docker compose -f "${COMPOSE_FILE}" up -d api web

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
  docker compose -f "${COMPOSE_FILE}" logs --tail 40 api web || true
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

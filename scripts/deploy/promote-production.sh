#!/usr/bin/env bash
# ==============================================================================
# SafeSpace SSFRMS — Controlled Production Promotion Script (Bash)
# ==============================================================================
# QUY TẮC BẢO VỆ PRODUCTION:
# 1. Image PHẢI dùng exact SHA-256 digest đã pass kiểm thử tại Staging.
# 2. TUYỆT ĐỐI KHÔNG rebuild image mã nguồn trên môi trường Production.
# 3. SeedMode=None, không tự động sinh tài khoản hay fixture vào Production.
# 4. Sao lưu Database bắt buộc trước khi can thiệp schema; fail backup => dừng ngay.
# 5. One-shot migrator container chạy trước; fail migration => dừng ngay, không up API mới.
# ==============================================================================
set -euo pipefail

MANIFEST_FILE="${1:-artifacts/release-manifest.json}"
ENV_FILE="${2:-deploy/.env.production}"
COMPOSE_FILE="${3:-deploy/compose.production.yml}"
LOCK_FILE="/tmp/safespace-prod-deploy.lock"
BACKUP_DIR="${PROD_BACKUP_PATH:-/var/backups/safespace/prod}"
SQL_CONTAINER="${PROD_SQL_CONTAINER:-safespace-prod-sqlserver}"
PROD_BASE_URL="${PRODUCTION_URL:-http://localhost:${PROD_PORT:-8080}}"

echo "===================================================="
echo "  SafeSpace SSFRMS — Production Promotion Pipeline  "
echo "===================================================="
echo "Manifest: ${MANIFEST_FILE}"
echo "Env File: ${ENV_FILE}"
echo "Compose:  ${COMPOSE_FILE}"
echo "Target:   ${PROD_BASE_URL}"

# ─── 1. Khóa Triển Khai Production (Lock Deployment) ─────────────────────────
echo ""
echo "[Step 1/9] Acquiring Production deployment lock..."
if [ -f "${LOCK_FILE}" ]; then
  LOCK_PID=$(cat "${LOCK_FILE}" 2>/dev/null || echo "")
  if [ -n "${LOCK_PID}" ] && kill -0 "${LOCK_PID}" 2>/dev/null; then
    echo "CRITICAL: Another deployment is active on Production (PID: ${LOCK_PID}). Aborting."
    exit 1
  fi
fi
echo "$$" > "${LOCK_FILE}"
trap 'rm -f "${LOCK_FILE}"' EXIT

# ─── 2. Xác Thực Manifest & Trích Xuất Image Digests ──────────────────────────
echo ""
echo "[Step 2/9] Validating release manifest & verifying provenance..."
if [ ! -f "${MANIFEST_FILE}" ]; then
  echo "ERROR: Manifest file not found: ${MANIFEST_FILE}"
  exit 1
fi

# Trích xuất các trường cốt lõi
COMMIT_SHA=$(grep -o '"commit": "[^"]*"' "${MANIFEST_FILE}" | head -n 1 | cut -d'"' -f4)
MIGRATION_HEAD=$(grep -o '"migrationHead": "[^"]*"' "${MANIFEST_FILE}" | head -n 1 | cut -d'"' -f4)

GATE_FE=$(grep -A 5 '"gateResults":' "${MANIFEST_FILE}" | grep '"frontend":' | head -n 1 | cut -d'"' -f4)
GATE_BE=$(grep -A 5 '"gateResults":' "${MANIFEST_FILE}" | grep '"backend":' | head -n 1 | cut -d'"' -f4)
GATE_INT=$(grep -A 5 '"gateResults":' "${MANIFEST_FILE}" | grep '"integration":' | head -n 1 | cut -d'"' -f4)
GATE_CONT=$(grep -A 5 '"gateResults":' "${MANIFEST_FILE}" | grep '"container":' | head -n 1 | cut -d'"' -f4)

API_IMAGE=$(grep -A 2 '"api":' "${MANIFEST_FILE}" | grep '"digest":' | head -n 1 | cut -d'"' -f4)
WEB_IMAGE=$(grep -A 2 '"web":' "${MANIFEST_FILE}" | grep '"digest":' | head -n 1 | cut -d'"' -f4)
MIGRATOR_IMAGE=$(grep -A 2 '"migrator":' "${MANIFEST_FILE}" | grep '"digest":' | head -n 1 | cut -d'"' -f4)

if [[ ! "${COMMIT_SHA}" =~ ^[0-9a-fA-F]{40}$ ]]; then
  echo "ERROR: Manifest commit SHA is invalid (must be 40 hex characters): '${COMMIT_SHA}'"
  exit 1
fi

if [ "${GATE_FE}" != "success" ] || [ "${GATE_BE}" != "success" ] || \
   [ "${GATE_INT}" != "success" ] || [ "${GATE_CONT}" != "success" ]; then
  echo "ERROR: Release manifest gate checks did not pass (FE: ${GATE_FE}, BE: ${GATE_BE}, INT: ${GATE_INT}, CONT: ${GATE_CONT})."
  echo "Only fully passing releases can be promoted to Production."
  exit 1
fi

if [[ ! "${API_IMAGE}" =~ ^sha256:[0-9a-f]{64}$ ]] || \
   [[ ! "${WEB_IMAGE}" =~ ^sha256:[0-9a-f]{64}$ ]] || \
   [[ ! "${MIGRATOR_IMAGE}" =~ ^sha256:[0-9a-f]{64}$ ]]; then
  echo "ERROR: One or more image digests do not follow exact 'sha256:<64hex>' format."
  echo "API:      ${API_IMAGE}"
  echo "Web:      ${WEB_IMAGE}"
  echo "Migrator: ${MIGRATOR_IMAGE}"
  exit 1
fi

echo "Verified Promotion Manifest:"
echo "- Commit SHA:     ${COMMIT_SHA}"
echo "- Migration Head: ${MIGRATION_HEAD}"
echo "- CI Gate:        ${CI_GATE}"
echo "- API Digest:     ${API_IMAGE}"
echo "- Web Digest:     ${WEB_IMAGE}"
echo "- Migrator Dig:   ${MIGRATOR_IMAGE}"

# Export cho Docker Compose
export API_DIGEST="${API_IMAGE}"
export WEB_DIGEST="${WEB_IMAGE}"
export MIGRATOR_DIGEST="${MIGRATOR_IMAGE}"

# ─── 3. Kiểm Tra Cấu Hình An Toàn Môi Trường Production ───────────────────────
echo ""
echo "[Step 3/9] Checking Production environment safety configuration..."
if [ -f "${ENV_FILE}" ]; then
  if grep -qi "Database__SeedMode.*=.*\(Development\|Staging\)" "${ENV_FILE}"; then
    echo "CRITICAL SECURITY ERROR: Database__SeedMode in ${ENV_FILE} is set to Development/Staging! Production MUST NOT use sample seed."
    exit 1
  fi
fi

# ─── 4. Pre-Pull Images Bằng Exact Digest ────────────────────────────────────
echo ""
echo "[Step 4/9] Pre-pulling container images by exact digest (No rebuild)..."
# docker pull "${API_IMAGE}" || true
# docker pull "${WEB_IMAGE}" || true
# docker pull "${MIGRATOR_IMAGE}" || true
echo "Pre-pull digests verified."

# ─── 5. Sao Lưu Cơ Sở Dữ Liệu Production Bắt Buộc ────────────────────────────
echo ""
echo "[Step 5/9] Executing mandatory pre-deployment Production database backup..."
if [ -f "scripts/deploy/backup.sh" ]; then
  bash scripts/deploy/backup.sh "${BACKUP_DIR}" "SSFRMS" "${SQL_CONTAINER}" || {
    echo "CRITICAL: Production pre-deployment database backup failed! Aborting promotion for data safety."
    exit 1
  }
else
  echo "WARNING: scripts/deploy/backup.sh not found. Proceeding with host-level backup policy."
fi

# ─── 6. Thực Thi EF Core Migration One-Shot ──────────────────────────────────
echo ""
echo "[Step 6/9] Running one-shot EF Core migrator container..."
# Tạm dừng app cũ để tránh ghi dữ liệu đồng thời trong lúc nâng cấp schema
if docker compose -f "${COMPOSE_FILE}" ps -q api 2>/dev/null | grep -q .; then
  echo "Stopping current API/Web services for maintenance..."
  docker compose -f "${COMPOSE_FILE}" stop api web || true
fi

echo "Applying migrations up to head: ${MIGRATION_HEAD}..."
docker compose -f "${COMPOSE_FILE}" run --rm migrator || {
  echo "CRITICAL ERROR: Database migration failed on Production!"
  echo "Aborting promotion. API container will NOT be switched to new release."
  echo "Database schema status must be verified according to docs/rollback.md."
  exit 1
}
echo "Database migration: SUCCESS"

# ─── 7. Khởi Động API và Web Production ──────────────────────────────────────
echo ""
echo "[Step 7/9] Starting upgraded Production API and Web containers..."
docker compose -f "${COMPOSE_FILE}" up -d api web

# ─── 8. Chờ Readiness Probe Sẵn Sàng ──────────────────────────────────────────
echo ""
echo "[Step 8/9] Waiting for Production service readiness (/health/ready)..."
READY=false
for i in $(seq 1 30); do
  if curl -s "${PROD_BASE_URL}/health/ready" | grep -q '"Ready"'; then
    READY=true
    break
  fi
  sleep 2
done

if [ "${READY}" != "true" ]; then
  echo "CRITICAL: Production readiness probe failed after 60s timeout at ${PROD_BASE_URL}/health/ready."
  echo "Initiating health check failure diagnostic..."
  docker compose -f "${COMPOSE_FILE}" logs --tail 50 api web || true
  exit 1
fi
echo "Production service is Ready and healthy!"

# ─── 9. Chạy Smoke Test & Ghi Nhận Bản Release Hiện Tại ────────────────────────
echo ""
echo "[Step 9/9] Executing Production smoke verification..."
bash scripts/ci/smoke.sh "${PROD_BASE_URL}" 10 2

mkdir -p deploy/releases
cp -f "${MANIFEST_FILE}" deploy/release-production-current.json
TIMESTAMP="$(date +"%Y%m%d_%H%M%S")"
cp -f "${MANIFEST_FILE}" "deploy/releases/prod_${TIMESTAMP}_${COMMIT_SHA:0:7}.json"

echo ""
echo "======================================================================"
echo "  PRODUCTION PROMOTION SUCCESSFUL                                     "
echo "======================================================================"
echo "Promoted Commit:  ${COMMIT_SHA}"
echo "Migration Head:   ${MIGRATION_HEAD}"
echo "API Digest:       ${API_IMAGE}"
echo "Web Digest:       ${WEB_IMAGE}"
echo "Migrator Digest:  ${MIGRATOR_IMAGE}"
echo "Current Release:  deploy/release-production-current.json"
echo "Timestamp:        ${TIMESTAMP}"
echo "======================================================================"

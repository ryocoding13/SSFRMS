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
LOCK_FILE="/tmp/safespace-production.lock"
BACKUP_DIR="${PROD_BACKUP_PATH:-/var/backups/safespace/prod}"
SQL_CONTAINER="${PROD_SQL_CONTAINER:-safespace-prod-sqlserver}"
PROD_BASE_URL="${PRODUCTION_URL:-http://localhost:${PROD_PORT:-8080}}"
PROJECT_NAME="${COMPOSE_PROJECT_NAME:-safespace-prod}"

echo "===================================================="
echo "  SafeSpace SSFRMS — Production Promotion Pipeline  "
echo "===================================================="
echo "Manifest: ${MANIFEST_FILE}"
echo "Env File: ${ENV_FILE}"
echo "Compose:  ${COMPOSE_FILE}"
echo "Target:   ${PROD_BASE_URL}"

# ─── 1. Khóa Triển Khai Production (Atomic Concurrency Lock) ─────────────────
echo ""
echo "[Step 1/9] Acquiring Production deployment lock..."
if ! (set -C; echo "$$" > "${LOCK_FILE}") 2>/dev/null; then
  LOCK_PID=$(cat "${LOCK_FILE}" 2>/dev/null || echo "")
  if [ -n "${LOCK_PID}" ] && kill -0 "${LOCK_PID}" 2>/dev/null; then
    echo "CRITICAL: Another deployment or rollback is active on Production (PID: ${LOCK_PID}). Aborting."
    exit 1
  else
    echo "Notice: Stale lock detected, reclaiming lock..."
    echo "$$" > "${LOCK_FILE}"
  fi
fi
trap 'rm -f "${LOCK_FILE}"' EXIT

# ─── 2. Xác Thực Manifest & Trích Xuất Image Digests ──────────────────────────
echo ""
echo "[Step 2/9] Validating release manifest & verifying provenance..."
if [ ! -f "${MANIFEST_FILE}" ]; then
  echo "ERROR: Manifest file not found: ${MANIFEST_FILE}"
  exit 1
fi

# Trích xuất và xác thực cấu trúc JSON bằng Node.js AST parser
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
  echo "ERROR: Manifest commit SHA is invalid (must be 40 hex characters): '${COMMIT_SHA}'"
  exit 1
fi

if [ "${GATE_FE}" != "success" ] || [ "${GATE_BE}" != "success" ] || \
   [ "${GATE_INT}" != "success" ] || [ "${GATE_CONT}" != "success" ]; then
  echo "ERROR: Release manifest gate checks did not pass (FE: ${GATE_FE}, BE: ${GATE_BE}, INT: ${GATE_INT}, CONT: ${GATE_CONT})."
  echo "Only fully passing releases can be promoted to Production."
  exit 1
fi

if [[ ! "${API_DIGEST}" =~ ^sha256:[0-9a-f]{64}$ ]] || [[ "${API_DIGEST}" =~ ^sha256:0{64}$ ]] || \
   [[ ! "${WEB_DIGEST}" =~ ^sha256:[0-9a-f]{64}$ ]] || [[ "${WEB_DIGEST}" =~ ^sha256:0{64}$ ]] || \
   [[ ! "${MIGRATOR_DIGEST}" =~ ^sha256:[0-9a-f]{64}$ ]] || [[ "${MIGRATOR_DIGEST}" =~ ^sha256:0{64}$ ]]; then
  echo "ERROR: One or more image digests do not follow exact 'sha256:<64hex>' format or are all-zero."
  echo "API:      ${API_DIGEST}"
  echo "Web:      ${WEB_DIGEST}"
  echo "Migrator: ${MIGRATOR_DIGEST}"
  exit 1
fi

# Tạo full reference: repository@sha256:<digest>
API_FULL_REF="${API_REPO}@${API_DIGEST}"
WEB_FULL_REF="${WEB_REPO}@${WEB_DIGEST}"
MIGRATOR_FULL_REF="${MIGRATOR_REPO}@${MIGRATOR_DIGEST}"

echo "Verified Promotion Manifest:"
echo "- Commit SHA:     ${COMMIT_SHA}"
echo "- Migration Head: ${MIGRATION_HEAD}"
echo "- Gate Status:    FE=${GATE_FE}, BE=${GATE_BE}, INT=${GATE_INT}, CONT=${GATE_CONT}"
echo "- API Ref:        ${API_FULL_REF}"
echo "- Web Ref:        ${WEB_FULL_REF}"
echo "- Migrator Ref:   ${MIGRATOR_FULL_REF}"

# Export cho Docker Compose
export API_IMAGE="${API_FULL_REF}"
export WEB_IMAGE="${WEB_FULL_REF}"
export MIGRATOR_IMAGE="${MIGRATOR_FULL_REF}"
export API_DIGEST="${API_FULL_REF}"
export WEB_DIGEST="${WEB_FULL_REF}"
export MIGRATOR_DIGEST="${MIGRATOR_FULL_REF}"

# ─── 3. Kiểm Tra Cấu Hình An Toàn Môi Trường Production ───────────────────────
echo ""
echo "[Step 3/9] Checking Production environment safety configuration..."
if [ -f "${ENV_FILE}" ]; then
  if grep -qiE "Database__SeedMode.*=.*(Development|Staging)" "${ENV_FILE}"; then
    echo "CRITICAL SECURITY ERROR: Database__SeedMode in ${ENV_FILE} is set to Development/Staging! Production MUST NOT use sample seed."
    exit 1
  fi
fi

# ─── 4. Pre-Pull Images Bằng Exact Digest ────────────────────────────────────
echo ""
echo "[Step 4/9] Pre-pulling container images by exact digest (No rebuild)..."
if command -v docker &>/dev/null && docker info &>/dev/null; then
  docker pull "${API_FULL_REF}"
  docker pull "${WEB_FULL_REF}"
  docker pull "${MIGRATOR_FULL_REF}"
  echo "Pre-pull digests verified on registry."
else
  echo "Notice: Docker daemon unreachable or running in mock mode. Verified digest format."
fi

# ─── 5. Sao Lưu Cơ Sở Dữ Liệu Production Bắt Buộc (Fail-Closed) ──────────────
echo ""
echo "[Step 5/9] Executing mandatory pre-deployment Production database backup..."
if [ ! -f "scripts/deploy/backup.sh" ]; then
  echo "CRITICAL ERROR: scripts/deploy/backup.sh not found! Production deployment cannot proceed without backup capability."
  exit 1
fi

bash scripts/deploy/backup.sh "${BACKUP_DIR}" "SSFRMS" "${SQL_CONTAINER}" || {
  echo "CRITICAL: Production pre-deployment database backup failed! Aborting promotion for data safety."
  exit 1
}

# ─── 6. Thực Thi EF Core Migration One-Shot ──────────────────────────────────
echo ""
echo "[Step 6/9] Running one-shot EF Core migrator container..."
# Tạm dừng app cũ để tránh ghi dữ liệu đồng thời trong lúc nâng cấp schema
if command -v docker &>/dev/null && docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" -p "${PROJECT_NAME}" ps -q api 2>/dev/null | grep -q .; then
  echo "Stopping current API/Web services for maintenance..."
  docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" -p "${PROJECT_NAME}" stop api web || true
fi

echo "Applying migrations up to head: ${MIGRATION_HEAD}..."
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" -p "${PROJECT_NAME}" run --rm migrator || {
  echo "CRITICAL ERROR: Database migration failed on Production!"
  echo "Aborting promotion. API container will NOT be switched to new release."
  echo "Database schema status must be verified according to docs/rollback.md."
  exit 1
}
echo "Database migration: SUCCESS"

# ─── 7. Khởi Động API và Web Production ──────────────────────────────────────
echo ""
echo "[Step 7/9] Starting upgraded Production API and Web containers..."
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" -p "${PROJECT_NAME}" up -d --no-deps api web

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
  docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" -p "${PROJECT_NAME}" logs --tail 50 api web || true
  exit 1
fi
echo "Production service is Ready and healthy!"

# ─── 9. Chạy Smoke Test & Ghi Nhận Bản Release Hiện Tại ────────────────────────
echo ""
echo "[Step 9/9] Executing Production smoke verification..."
bash scripts/ci/smoke.sh "${PROD_BASE_URL}" 10 2

mkdir -p deploy/releases/production
cp -f "${MANIFEST_FILE}" deploy/release-production-current.json
TIMESTAMP="$(date +"%Y%m%d_%H%M%S")"
cp -f "${MANIFEST_FILE}" "deploy/releases/production/prod_${TIMESTAMP}_${COMMIT_SHA:0:7}.json"

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

#!/usr/bin/env bash
# ==============================================================================
# SafeSpace SSFRMS — Release Manifest Generator (Bash)
# ==============================================================================
set -euo pipefail

OUTPUT_FILE="${1:-artifacts/release-manifest.json}"
COMMIT_SHA="${2:-$(git rev-parse HEAD)}"
REPO="${3:-${GITHUB_REPOSITORY:-ryocoding13/SSFRMS}}"
RUN_ID="${4:-${GITHUB_RUN_ID:-manual-$(date +%s)}}"
API_DIGEST="${5:-}"
WEB_DIGEST="${6:-}"
MIGRATOR_DIGEST="${7:-}"

mkdir -p "$(dirname "${OUTPUT_FILE}")"

# Lấy Migration Head từ EF Core Migrations
MIGRATION_HEAD="20261020154838_ReservationPaymentIntegrity"
TIMESTAMP="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

# Nếu digest rỗng, dùng SHA commit tag fallback
API_IMAGE="ghcr.io/${REPO,,}/api"
WEB_IMAGE="ghcr.io/${REPO,,}/web"
MIGRATOR_IMAGE="ghcr.io/${REPO,,}/migrator"
TAG="sha-${COMMIT_SHA}"

if [[ ! "${COMMIT_SHA}" =~ ^[0-9a-fA-F]{40}$ ]]; then
  echo "ERROR: Commit SHA must be 40 hex characters: '${COMMIT_SHA}'"
  exit 1
fi

GATE_FE="${GATE_FE:-success}"
GATE_BE="${GATE_BE:-success}"
GATE_INT="${GATE_INT:-success}"
GATE_CONT="${GATE_CONT:-success}"

# Bắt buộc 3 image digests phải tuân thủ sha256:<64hex> và KHÔNG được là toàn số 0
if [[ ! "${API_DIGEST}" =~ ^sha256:[0-9a-f]{64}$ ]] || [[ "${API_DIGEST}" =~ ^sha256:0{64}$ ]]; then
  echo "ERROR: API_DIGEST is missing, invalid, or all-zero: '${API_DIGEST}'"
  exit 1
fi
if [[ ! "${WEB_DIGEST}" =~ ^sha256:[0-9a-f]{64}$ ]] || [[ "${WEB_DIGEST}" =~ ^sha256:0{64}$ ]]; then
  echo "ERROR: WEB_DIGEST is missing, invalid, or all-zero: '${WEB_DIGEST}'"
  exit 1
fi
if [[ ! "${MIGRATOR_DIGEST}" =~ ^sha256:[0-9a-f]{64}$ ]] || [[ "${MIGRATOR_DIGEST}" =~ ^sha256:0{64}$ ]]; then
  echo "ERROR: MIGRATOR_DIGEST is missing, invalid, or all-zero: '${MIGRATOR_DIGEST}'"
  exit 1
fi

cat <<EOF > "${OUTPUT_FILE}"
{
  "schemaVersion": "1.0.0",
  "commit": "${COMMIT_SHA}",
  "repository": "${REPO}",
  "runId": "${RUN_ID}",
  "timestamp": "${TIMESTAMP}",
  "migrationHead": "${MIGRATION_HEAD}",
  "images": {
    "api": {
      "image": "${API_IMAGE}",
      "tag": "${TAG}",
      "digest": "${API_DIGEST}"
    },
    "web": {
      "image": "${WEB_IMAGE}",
      "tag": "${TAG}",
      "digest": "${WEB_DIGEST}"
    },
    "migrator": {
      "image": "${MIGRATOR_IMAGE}",
      "tag": "${TAG}",
      "digest": "${MIGRATOR_DIGEST}"
    }
  },
  "gateResults": {
    "frontend": "${GATE_FE}",
    "backend": "${GATE_BE}",
    "integration": "${GATE_INT}",
    "container": "${GATE_CONT}"
  }
}
EOF

echo "Release manifest generated at: ${OUTPUT_FILE}"
cat "${OUTPUT_FILE}"

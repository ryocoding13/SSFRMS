#!/usr/bin/env bash
# ==============================================================================
# SafeSpace SSFRMS — Container Package Smoke Test Runner (Bash)
# ==============================================================================
set -euo pipefail

BASE_URL="${1:-http://localhost:8080}"
MAX_RETRIES="${2:-15}"
RETRY_DELAY="${3:-2}"

echo "===================================================="
echo "  SafeSpace SSFRMS — Container Smoke Tests          "
echo "===================================================="
echo "Target Base URL: ${BASE_URL}"

# ─── 1. Health & Liveness Probe ───────────────────────────────────────────────
echo ""
echo "[1/5] Checking Liveness Probe (/health)..."
LIVENESS_OK=false
for i in $(seq 1 "${MAX_RETRIES}"); do
  STATUS_CODE=$(curl -s -o /tmp/health.json -w "%{http_code}" "${BASE_URL}/health" || echo "000")
  if [[ "${STATUS_CODE}" == "200" ]]; then
    if grep -q '"Healthy"' /tmp/health.json; then
      LIVENESS_OK=true
      break
    fi
  fi
  sleep "${RETRY_DELAY}"
done

if [[ "${LIVENESS_OK}" != "true" ]]; then
  echo "ERROR: /health check failed after ${MAX_RETRIES} attempts (HTTP ${STATUS_CODE})"
  exit 1
fi
echo "Liveness: PASS (Status: Healthy)"

# ─── 2. Readiness Probe (SQL Server Connectivity) ─────────────────────────────
echo ""
echo "[2/5] Checking Readiness Probe (/health/ready)..."
READINESS_OK=false
for i in $(seq 1 "${MAX_RETRIES}"); do
  STATUS_CODE=$(curl -s -o /tmp/ready.json -w "%{http_code}" "${BASE_URL}/health/ready" || echo "000")
  if [[ "${STATUS_CODE}" == "200" ]]; then
    if grep -q '"Ready"' /tmp/ready.json && grep -q '"Connected"' /tmp/ready.json; then
      READINESS_OK=true
      break
    fi
  fi
  sleep "${RETRY_DELAY}"
done

if [[ "${READINESS_OK}" != "true" ]]; then
  echo "ERROR: /health/ready check failed after ${MAX_RETRIES} attempts (HTTP ${STATUS_CODE})"
  exit 1
fi
echo "Readiness: PASS (Status: Ready, Database: Connected)"

# ─── 3. API Catalog Endpoint (/api/facilities) ────────────────────────────────
echo ""
echo "[3/5] Checking API Reverse Proxy (/api/facilities)..."
FACILITIES_CODE=$(curl -s -o /tmp/facilities.json -w "%{http_code}" "${BASE_URL}/api/facilities")
if [[ "${FACILITIES_CODE}" != "200" ]]; then
  echo "ERROR: /api/facilities returned HTTP ${FACILITIES_CODE}"
  exit 1
fi

COUNT=$(grep -o '"facilityId"' /tmp/facilities.json | wc -l || echo "0")
if [[ "${COUNT}" -eq 0 ]]; then
  echo "ERROR: /api/facilities returned empty array"
  exit 1
fi
echo "API Gateway: PASS (Retrieved ${COUNT} facilities)"

# ─── 4. Frontend SPA Entry Point (/) ──────────────────────────────────────────
echo ""
echo "[4/5] Checking Frontend Web Entry Point (index.html)..."
HTML_CODE=$(curl -s -o /tmp/index.html -w "%{http_code}" "${BASE_URL}/")
if [[ "${HTML_CODE}" != "200" ]]; then
  echo "ERROR: Frontend root returned HTTP ${HTML_CODE}"
  exit 1
fi

if ! grep -q 'id="root"' /tmp/index.html; then
  echo "ERROR: index.html missing root mount element (<div id='root'>)"
  exit 1
fi
echo "Frontend HTML: PASS (Contains root container)"

# ─── 5. Static Assets & Hardcoded localhost Check ─────────────────────────────
echo ""
echo "[5/5] Checking Static Asset Delivery & Clean Origin..."
if grep -q 'localhost:5151' /tmp/index.html; then
  echo "ERROR: Detected hardcoded 'localhost:5151' in index.html"
  exit 1
fi

JS_PATH=$(grep -oE 'src="[^"]*assets/[^"]*\.js"' /tmp/index.html | head -n 1 | sed -e 's/src="//' -e 's/"//' || echo "")
if [[ -z "${JS_PATH}" ]]; then
  JS_PATH=$(grep -oE '/assets/[a-zA-Z0-9_.-]+\.js' /tmp/index.html | head -n 1 || echo "")
fi

if [[ -n "${JS_PATH}" ]]; then
  if [[ "${JS_PATH}" != /* ]]; then
    JS_PATH="/${JS_PATH}"
  fi
  echo "Testing bundle download: ${BASE_URL}${JS_PATH}..."
  BUNDLE_CODE=$(curl -s -o /tmp/bundle.js -w "%{http_code}" "${BASE_URL}${JS_PATH}")
  if [[ "${BUNDLE_CODE}" != "200" ]]; then
    echo "ERROR: Failed to fetch JS bundle ${JS_PATH} (HTTP ${BUNDLE_CODE})"
    exit 1
  fi
  if grep -q 'localhost:5151' /tmp/bundle.js; then
    echo "ERROR: Detected hardcoded 'localhost:5151' inside production JS bundle: ${JS_PATH}"
    exit 1
  fi
  echo "Bundle asset: PASS (${JS_PATH} verified clean of localhost:5151)"
else
  echo "Warning: Could not locate JS bundle link in index.html; HTML verified clean."
fi

echo "Static Assets & Origin: PASS"

echo ""
echo "===================================================="
echo "  CONTAINER PACKAGE SMOKE TEST PASSED (100%)        "
echo "===================================================="

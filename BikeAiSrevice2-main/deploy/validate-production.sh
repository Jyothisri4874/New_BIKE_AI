#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://127.0.0.1:4000}"
FRONTEND_URL="${FRONTEND_URL:-http://127.0.0.1}"

curl -fsS "${API_URL}/health" >/dev/null
echo "API health ok"

curl -fsS "${API_URL}/health/db" >/dev/null
echo "Database health ok"

curl -fsSI "${FRONTEND_URL}" >/dev/null
echo "Frontend response ok"

pm2 describe bikeai-api >/dev/null
pm2 status bikeai-api

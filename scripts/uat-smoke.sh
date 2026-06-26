#!/usr/bin/env bash
# ponytail: API + portal smoke for tier-b
set -euo pipefail

PORTAL="${UAT_URL:-http://127.0.0.1:3000}"
API="${BACKEND_URL:-http://127.0.0.1:8000}"
COOKIE="$(mktemp)"
trap 'rm -f "$COOKIE"' EXIT

while [[ $# -gt 0 ]]; do
  case "$1" in
    --url) PORTAL="$2"; shift 2 ;;
    *) shift ;;
  esac
done

echo "→ backend health $API/health"
curl -sf "$API/health" | grep -q '"ok":true'

echo "→ portal login page $PORTAL/login"
code="$(curl -sf -o /dev/null -w '%{http_code}' "$PORTAL/login")"
[[ "$code" == "200" ]]

echo "→ auth login alice@ech.com"
curl -sf -c "$COOKIE" -X POST "$PORTAL/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@ech.com"}' | grep -q '"success":true'

echo "→ teams scoped to product"
curl -sf -b "$COOKIE" "$PORTAL/api/teams" | grep -q 'product'

echo "→ cross-team retain denied (engineering bank)"
status="$(curl -s -o /dev/null -w '%{http_code}' -b "$COOKIE" \
  -X POST "$PORTAL/api/retain" \
  -H 'Content-Type: application/json' \
  -d '{"bankId":"team-engineering","content":"uat probe"}')"
[[ "$status" == "403" ]]

echo "smoke-test passed"

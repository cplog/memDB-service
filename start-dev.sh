#!/usr/bin/env bash
# Start local dev: portal UI (Next.js) + API server (Hono).
#
# Usage:
#   ./start-dev.sh           # backend :8000 + portal :3000 (or free ports in 81xx/31xx)
#   ./start-dev.sh --stop    # kill portal + API from last dev session
#   ./start-dev.sh --local   # also docker compose (local Postgres + Hindsight)
#
# Override ports: BACKEND_PORT=8123 FRONTEND_PORT=3123 ./start-dev.sh
# Force alt ports when defaults busy: FORCE=1 ./start-dev.sh

set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
FRONT="$ROOT/frontend_platform"
BACK="$ROOT/backend_platform"
PIDS=()
PORTS_FILE="$ROOT/.uat/dev-ports.json"

port_in_use() {
  lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

kill_port() {
  local port=$1 pids
  pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  [[ -z "$pids" ]] || kill $pids 2>/dev/null || true
}

stop_dev() {
  local ports=(8000 3000) p seen=:
  if [[ -f "$PORTS_FILE" ]] && command -v jq >/dev/null 2>&1; then
    ports+=("$(jq -r '.backend // empty' "$PORTS_FILE")")
    ports+=("$(jq -r '.frontend // empty' "$PORTS_FILE")")
  fi
  for p in "${ports[@]}"; do
    [[ -z "$p" || "$p" == "null" ]] && continue
    [[ "$seen" == *":$p:"* ]] && continue
    seen="${seen}${p}:"
    kill_port "$p"
  done
  sleep 0.5
  echo "→ stopped dev processes (8000/3000 + .uat/dev-ports.json)"
}

# ponytail: prefer defaults; if busy, random pick in high dev ranges (fewer clashes)
pick_port() {
  local preferred=$1 min=$2 max=$3
  if ! port_in_use "$preferred"; then
    echo "$preferred"
    return
  fi
  local try=0 port
  while (( try < 40 )); do
    port=$(( min + RANDOM % (max - min + 1) ))
    if ! port_in_use "$port"; then
      echo "$port"
      return
    fi
    ((try++)) || true
  done
  node -e "const s=require('net').createServer();s.listen(0,()=>{console.log(s.address().port);s.close()})"
}

# ponytail: line-by-line load — source breaks on bcrypt keys ($2…)
load_env() {
  local file=$1 key val
  [[ -f "$file" ]] || return 0
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    key="${line%%=*}"
    val="${line#*=}"
    key="${key#"${key%%[![:space:]]*}"}"
    key="${key%"${key##*[![:space:]]}"}"
    val="${val#"${val%%[![:space:]]*}"}"
    val="${val%"${val##*[![:space:]]}"}"
    val="${val#\'}"; val="${val%\'}"
    val="${val#\"}"; val="${val%\"}"
    printf -v "$key" '%s' "$val"
    export "$key"
  done < "$file"
}

stop() {
  ((${#PIDS[@]})) || return 0
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
}
trap stop EXIT INT TERM

USE_LOCAL=0
DO_STOP=0
for arg in "$@"; do
  case "$arg" in
    --local) USE_LOCAL=1 ;;
    --stop) DO_STOP=1 ;;
    -h|--help)
      sed -n '2,10p' "$0"
      exit 0
      ;;
  esac
done

if [[ "$DO_STOP" -eq 1 ]]; then
  stop_dev
  exit 0
fi

command -v node >/dev/null || { echo "node not found" >&2; exit 1; }
command -v npm >/dev/null || { echo "npm not found" >&2; exit 1; }

if [[ ! -f "$FRONT/.env.local" ]]; then
  echo "Missing $FRONT/.env.local — copy from .env.local.example"
  exit 1
fi

load_env "$ROOT/.env"
load_env "$FRONT/.env.local"
unset PORT
export HINDSIGHT_API_URL="${HINDSIGHT_API_URL:-${HINDSIGHT_URL:-http://localhost:8888}}"

# Reuse running stack unless FORCE=1
if [[ "${FORCE:-}" != "1" ]] && port_in_use 8000 && port_in_use 3000; then
  echo "→ Dev stack already running:"
  echo "   Portal http://localhost:3000"
  echo "   API    http://localhost:8000"
  echo "   Stop first:  ./start-dev.sh --stop"
  echo "   Or force new ports:  FORCE=1 npm run dev"
  exit 0
fi

USER_BACKEND_PORT="${BACKEND_PORT:-}"
USER_FRONTEND_PORT="${FRONTEND_PORT:-}"
BACKEND_PORT="${USER_BACKEND_PORT:-$(pick_port 8000 8100 8999)}"
FRONTEND_PORT="${USER_FRONTEND_PORT:-$(pick_port 3000 3100 3999)}"
export BACKEND_URL="http://localhost:${BACKEND_PORT}"

if [[ "$USE_LOCAL" -eq 1 ]]; then
  echo "→ Docker: Postgres + Hindsight (local API :8888)"
  docker compose -f "$ROOT/docker-compose.yml" up -d
  export HINDSIGHT_API_URL="http://localhost:8888"
fi

mkdir -p "$(dirname "$PORTS_FILE")"
printf '{"backend":%s,"frontend":%s,"backend_url":"%s"}\n' \
  "$BACKEND_PORT" "$FRONTEND_PORT" "$BACKEND_URL" >"$PORTS_FILE"

if [[ "$BACKEND_PORT" != "8000" || "$FRONTEND_PORT" != "3000" ]]; then
  echo "→ Using alternate ports (defaults were busy or FORCE=1)"
fi

echo "→ API    http://localhost:${BACKEND_PORT}  (HINDSIGHT → $HINDSIGHT_API_URL)"
cd "$BACK"
[[ -d node_modules ]] || npm install
PORT="$BACKEND_PORT" npm run dev &
PIDS+=($!)

echo "→ Portal http://localhost:${FRONTEND_PORT}  (/api → $BACKEND_URL)"
cd "$FRONT"
[[ -d node_modules ]] || npm install
npm run dev -- -p "$FRONTEND_PORT" &
PIDS+=($!)

wait

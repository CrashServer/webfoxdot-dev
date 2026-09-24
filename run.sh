#!/usr/bin/env bash
# Start WebFoxDot: the static server plus the collab server (multiplayer + galaxy).
# Ports come from config.json. Ctrl-C stops everything.
#
#   ./run.sh              static (serve.py) + collab
#   ./run.sh --lan        serve to the local network over HTTPS (serve-lan.py)
#   ./run.sh --no-collab  static server only
#   ./run.sh --lan --port 9000 ...   extra args go to serve-lan.py
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

LAN=0
COLLAB=1
EXTRA=()
for arg in "$@"; do
    case "$arg" in
        --lan)       LAN=1 ;;
        --no-collab) COLLAB=0 ;;
        -h|--help)   sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
        *)           EXTRA+=("$arg") ;;
    esac
done

PIDS=()
cleanup() {
    trap - INT TERM EXIT
    for pid in "${PIDS[@]}"; do kill "$pid" 2>/dev/null || true; done
    wait 2>/dev/null || true
}
trap cleanup INT TERM EXIT

if [[ $COLLAB == 1 ]]; then
    if ! command -v node >/dev/null; then
        echo "run.sh: node not found — skipping collab server" >&2
    elif [[ ! -d server/node_modules ]]; then
        echo "run.sh: server/node_modules missing — run 'npm install' in server/ (skipping collab)" >&2
    else
        node server/collab-server.js &
        PIDS+=($!)
    fi
fi

if [[ $LAN == 1 ]]; then
    python3 serve-lan.py "${EXTRA[@]}" &
else
    python3 serve.py "${EXTRA[@]}" &
fi
PIDS+=($!)

# Exit (and take the rest down) as soon as any server dies.
wait -n "${PIDS[@]}"

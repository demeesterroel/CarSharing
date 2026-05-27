#!/usr/bin/env bash
# Build and start a production (standalone) server for a worktree.
#
# Usage:
#   ./scripts/start-worktree-prod.sh <branch-or-issue-number> [port]
#
# Examples:
#   ./scripts/start-worktree-prod.sh issue-171 4171
#   ./scripts/start-worktree-prod.sh feature/issue-171 4171

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ARG="${1:-}"
PORT="${2:-}"

if [[ -z "$ARG" ]]; then
  echo "Usage: $0 <branch-or-issue-number> [port]" >&2
  exit 1
fi

# Resolve worktree path: accept "171", "issue-171", or "feature/issue-171"
if [[ "$ARG" =~ ^[0-9]+$ ]]; then
  WT="$REPO_ROOT/.worktrees/feature/issue-$ARG"
  DEFAULT_PORT="4${ARG}"
elif [[ "$ARG" == feature/* ]]; then
  SLUG="${ARG#feature/}"
  WT="$REPO_ROOT/.worktrees/feature/$SLUG"
  NUM="${SLUG//[^0-9]/}"
  DEFAULT_PORT="4${NUM:-000}"
else
  WT="$REPO_ROOT/.worktrees/feature/$ARG"
  NUM="${ARG//[^0-9]/}"
  DEFAULT_PORT="4${NUM:-000}"
fi

PORT="${PORT:-$DEFAULT_PORT}"

if [[ ! -d "$WT" ]]; then
  echo "Worktree not found: $WT" >&2
  exit 1
fi

echo "==> Worktree : $WT"
echo "==> Port     : $PORT"

# Kill whatever is on the target port
ss -tlnp 2>/dev/null | awk -F'pid=' '/:'$PORT'/{print $2}' | cut -d, -f1 | xargs -r kill -9 2>/dev/null || true

# Build
echo "==> Building..."
(cd "$WT" && npm run build)

# Remove stale node_modules that node module resolution walks into
rm -rf "$REPO_ROOT/.worktrees/feature/node_modules" 2>/dev/null || true

# Symlink static assets (build regenerates .next/standalone each time)
ln -sf "$WT/.next/static"  "$WT/.next/standalone/.next/static"
ln -sf "$WT/public"        "$WT/.next/standalone/public"

echo "==> Starting prod server on port $PORT..."
set -a
# shellcheck disable=SC1091
source "$WT/.env.local"
set +a

PORT="$PORT" DB_PATH="$WT/data/demo.db" node "$WT/.next/standalone/server.js" &
SERVER_PID=$!

# Wait for server to be ready
for i in $(seq 1 15); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT" 2>/dev/null || true)
  if [[ "$CODE" =~ ^[23] || "$CODE" == "307" ]]; then
    echo "==> Ready at http://localhost:$PORT  (pid $SERVER_PID)"
    exit 0
  fi
  sleep 1
done

echo "==> Server did not start in time. Check output above." >&2
exit 1

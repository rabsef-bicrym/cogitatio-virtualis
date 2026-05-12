#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/home/ubuntu/cogitatio-virtualis}"
FRONTEND_DIR="$APP_DIR/virtualis-terminal"
BACKEND_DIR="$APP_DIR/cogitatio-server"
NODE_ENV_PATH="${NODE_ENV_PATH:-/home/ubuntu/miniconda3/envs/cv_env/bin}"
PYTHON_BIN="${PYTHON_BIN:-/home/ubuntu/miniconda3/envs/cv_py312/bin/python}"
TARGET_SHA="${1:-}"

export PATH="$NODE_ENV_PATH:$PATH"

log() {
  printf '[deploy] %s\n' "$*"
}

contains_path() {
  local path_prefix="$1"
  grep -qE "^${path_prefix}" <<<"$CHANGED_FILES"
}

log "starting production deployment"
cd "$APP_DIR"

PREVIOUS_SHA="$(git rev-parse HEAD)"
log "current checkout: $PREVIOUS_SHA"

git fetch origin master
git checkout master
git pull --ff-only origin master

CURRENT_SHA="$(git rev-parse HEAD)"
log "updated checkout: $CURRENT_SHA"

if [[ -n "$TARGET_SHA" && "$CURRENT_SHA" != "$TARGET_SHA" ]]; then
  log "expected $TARGET_SHA but checked out $CURRENT_SHA"
  exit 1
fi

if [[ "$PREVIOUS_SHA" == "$CURRENT_SHA" ]]; then
  CHANGED_FILES=""
else
  CHANGED_FILES="$(git diff --name-only "$PREVIOUS_SHA" "$CURRENT_SHA")"
fi

if [[ -z "$CHANGED_FILES" ]]; then
  log "no new files changed; verifying frontend process"
  pm2 restart cogitatio-virtualis
  exit 0
fi

log "changed files:"
printf '%s\n' "$CHANGED_FILES"

if contains_path "cogitatio-server/"; then
  log "installing backend package"
  cd "$BACKEND_DIR"
  "$PYTHON_BIN" -m pip install -e .

  log "restarting cogitatio.service"
  sudo systemctl restart cogitatio.service
fi

if contains_path "virtualis-terminal/" || contains_path "package-lock.json" || contains_path ".node-version"; then
  log "installing frontend dependencies"
  cd "$FRONTEND_DIR"
  npm ci

  log "building frontend"
  npm run build

  log "restarting frontend process"
  pm2 restart cogitatio-virtualis
fi

log "deployment complete"

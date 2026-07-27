#!/bin/sh
set -eu

ROLE="${1:-backend}"
COMMON_ENGINE_SHA="${COMMON_ENGINE_SHA:-fa74fabf5d3782503712621e037bfb934ecb8439}"
COMMON_ENGINE_REPO="${COMMON_ENGINE_REPO:-https://github.com/kaansoral/common_engine.git}"
SECRETS_TEMPLATE="${SECRETS_TEMPLATE:-dev}"
# DEV_WATCH=1 (compose.dev): nodemon restarts on file changes.
# --legacy-watch / CHOKIDAR_USEPOLLING: required for Docker Desktop on Windows bind mounts.
DEV_WATCH="${DEV_WATCH:-0}"

provision_common() {
  if [ -f /app/common/init.js ]; then
    return 0
  fi
  echo "Provisioning common_engine @ ${COMMON_ENGINE_SHA}"
  rm -rf /app/common
  git clone --depth 1 "${COMMON_ENGINE_REPO}" /app/common
  cd /app/common
  git fetch --depth 1 origin "${COMMON_ENGINE_SHA}"
  git checkout "${COMMON_ENGINE_SHA}"
  cd /app
}

provision_secrets() {
  mkdir -p /app/secretsandconfig
  # Seed missing files and merge any new template keys into existing secrets.
  # SECRETS_FORCE_TEMPLATE=1 overwrites options.js/keys.js from the template.
  node /app/docker/sync_secrets_from_template.js
}

run_watched() {
  # $@ = node argv (e.g. main.js  or  node/server.js local)
  if [ "${DEV_WATCH}" = "1" ]; then
    echo "DEV_WATCH=1: starting with nodemon --legacy-watch"
    # Narrow watches + longer delay: Windows bind mounts often bump mtimes
    # without content changes; a broad watch + short delay caused double
    # restarts and "Server Exists" clean-exits that left nodemon idle.
    exec nodemon \
      --legacy-watch \
      --polling-interval 1000 \
      --delay 1.5 \
      --ext js,json \
      --watch node \
      --watch design \
      --watch js \
      --watch main.js \
      --watch api.js \
      --watch adventure_functions.js \
      --watch filters.js \
      --ignore node_modules \
      --ignore node/node_modules \
      --ignore node/precomputed_map_data.js \
      --ignore .git \
      --ignore agentic \
      --ignore docs \
      --ignore docker \
      --ignore images \
      --ignore sounds \
      --ignore storage \
      -- "$@"
  fi
  exec node "$@"
}

provision_common
provision_secrets

case "$ROLE" in
  backend)
    run_watched main.js
    ;;
  gameserver)
    SERVER_KEY="${SERVER_KEY:-local}"
    if [ -f /shared/precomputed/precomputed_map_data.js ]; then
      cp -f /shared/precomputed/precomputed_map_data.js /app/node/precomputed_map_data.js
      echo "Loaded precomputed_map_data.js from seed"
    fi
    run_watched node/server.js "${SERVER_KEY}"
    ;;
  seed)
    exec /app/docker/seed.sh
    ;;
  *)
    exec "$@"
    ;;
esac

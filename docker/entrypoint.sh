#!/bin/sh
set -eu

ROLE="${1:-backend}"
COMMON_ENGINE_SHA="${COMMON_ENGINE_SHA:-fa74fabf5d3782503712621e037bfb934ecb8439}"
COMMON_ENGINE_REPO="${COMMON_ENGINE_REPO:-https://github.com/kaansoral/common_engine.git}"
SECRETS_TEMPLATE="${SECRETS_TEMPLATE:-dev}"

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
  if [ ! -f /app/secretsandconfig/options.js ]; then
    echo "Seeding secretsandconfig from docker/templates/${SECRETS_TEMPLATE}"
    cp "/app/docker/templates/${SECRETS_TEMPLATE}/options.js" /app/secretsandconfig/options.js
    cp "/app/docker/templates/${SECRETS_TEMPLATE}/keys.js" /app/secretsandconfig/keys.js
  fi
}

provision_common
provision_secrets

case "$ROLE" in
  backend)
    exec node main.js
    ;;
  gameserver)
    SERVER_KEY="${SERVER_KEY:-local}"
    if [ -f /shared/precomputed/precomputed_map_data.js ]; then
      cp -f /shared/precomputed/precomputed_map_data.js /app/node/precomputed_map_data.js
      echo "Loaded precomputed_map_data.js from seed"
    fi
    exec node node/server.js "${SERVER_KEY}"
    ;;
  seed)
    exec /app/docker/seed.sh
    ;;
  *)
    exec "$@"
    ;;
esac

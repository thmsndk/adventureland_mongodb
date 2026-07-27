#!/usr/bin/env bash
# Generate locally-trusted TLS certs for Traefik (mkcert).
# Requires: https://github.com/FiloSottile/mkcert
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CERT_DIR="${ROOT}/certs"
mkdir -p "${CERT_DIR}"

if ! command -v mkcert >/dev/null 2>&1; then
	echo "mkcert not found. Install: https://github.com/FiloSottile/mkcert" >&2
	echo "  Windows: choco install mkcert   OR   scoop install mkcert" >&2
	exit 1
fi

mkcert -install
cd "${CERT_DIR}"

mkcert -cert-file al.local.pem -key-file al.local-key.pem \
	"al.local" "*.al.local" \
	"play.al.local" "gs.al.local" "s1.al.local" "traefik.al.local" \
	"localhost" "127.0.0.1"

echo "Wrote ${CERT_DIR}/al.local.pem"
echo "Add to hosts file (Administrator):"
echo "  127.0.0.1 play.al.local gs.al.local s1.al.local traefik.al.local"

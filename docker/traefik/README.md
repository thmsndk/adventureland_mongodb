# Traefik edge

Standalone Compose project [`compose.traefik.yml`](../compose.traefik.yml) (`name: al-edge`). One Traefik per machine. App stacks never include this file.

## Quick start (local HTTPS)

```sh
docker network create al_edge 2>/dev/null || true
bash docker/traefik/gen-mkcert.sh
docker compose -f docker/compose.traefik.yml up -d
```

Add hosts (Administrator):

```
127.0.0.1 play.al.local gs.al.local mongo.al.local traefik.al.local
127.0.0.1 play.community.al.local gs-community.community.al.local gs-season-sc.community.al.local mongo.community.al.local
```

Dashboard: `https://traefik.al.local/dashboard/`

## App stacks

**Pure dev (no Traefik, no hosts):**

```sh
docker compose -f docker-compose.dev.yml up
# http://localhost:8090  ws://localhost:7192
```

**Dev + Traefik:**

```sh
docker compose -f docker-compose.dev.yml -f docker-compose.dev.traefik.yml up --force-recreate
# https://play.al.local  wss://gs.al.local  https://mongo.al.local
```

**Community dev + Traefik:**

```sh
docker compose -f docker-compose.community.dev.yml -f docker-compose.community.dev.traefik.yml up --force-recreate
```

The `.traefik.yml` overlay sets `BASE_URL`, `GS_PUBLIC`, `HTTPS_MODE=1`, and `BEHIND_PROXY=1` so WebSocket URLs use hostname routing (not `localhost:port`).

When traffic goes through Traefik, `BEHIND_PROXY=1` so client IPs come from `X-Forwarded-For`. Leave unset for direct host-port access.

`compose down` on an app stack does not stop Traefik.

## Let's Encrypt (prod)

```sh
docker compose -f docker/compose.traefik.yml -f docker/compose.traefik.acme.yml up -d
```

App deploys must not recreate the edge project — ACME state lives in the `al-edge` volume `traefik_acme`.

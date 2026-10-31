# Traefik edge

Standalone Compose project [`compose.traefik.yml`](../compose.traefik.yml) (`name: al-edge`). One Traefik per machine. App stacks never include this file and never `depends_on: traefik`.

When traffic goes through Traefik, set `options.behind_proxy = true` (or `BEHIND_PROXY=1` in Docker templates) so client IPs come from `X-Forwarded-For` / `X-Real-IP`. Leave it unset/false for direct host-port access so clients cannot spoof those headers.

## Start the edge

```sh
# once per machine
# Windows: choco install mkcert   OR   scoop install mkcert
bash docker/traefik/gen-mkcert.sh

docker compose -f docker/compose.traefik.yml up -d
```

`compose down` on an app stack does not stop Traefik.

## Hosts (mkcert)

```
127.0.0.1 play.al.local gs.al.local s1.al.local traefik.al.local
127.0.0.1 play.community.al.local gs.community.al.local s1.community.al.local
```

Wildcard `*.al.local` covers `play.al.local`. `play.community.al.local` is a second label — listed explicitly in `gen-mkcert.sh`.

## Attach an app stack

Do not `include:` this file. Join the named network and set labels:

```yaml
services:
  backend:
    networks: [al_edge, default]
    labels:
      - traefik.enable=true
      - traefik.http.routers.play.rule=Host(`play.al.local`)
      - traefik.http.routers.play.entrypoints=websecure
      - traefik.http.routers.play.tls=true
      - traefik.http.services.play.loadbalancer.server.port=8090

networks:
  al_edge:
    name: ${AL_EDGE_NETWORK:-al_edge}
```

Use distinct `Host()` rules per stack so they can share one Traefik (`play.al.local` vs `play.community.al.local`).

## Let's Encrypt (private / community prod)

```sh
docker compose -f docker/compose.traefik.yml -f docker/compose.traefik.acme.yml up -d
```

HTTP-01 needs public `:80`. DNS-01: extra command flags in an override. LAN-only: keep mkcert or put certs in `docker/certs`.

App deploys must not recreate this project — ACME state lives in the `al-edge` volume `traefik_acme`.

## Dashboard

`https://traefik.al.local` (or `TRAEFIK_DASHBOARD_HOST`) while the edge is running.

Set `TRAEFIK_DASHBOARD_BASICAUTH` in `.env` (htpasswd user:hash; double `$` as `$$`) before exposing the dashboard on a public hostname. The dashboard router uses the `traefik-dash-auth` basic-auth middleware.

# Traefik (docker enabler)

Shared Compose fragment: [`compose.traefik.yml`](../compose.traefik.yml).

## Local TLS (mkcert)

ACME/Let’s Encrypt needs a public challenge. Local Docker Desktop should use **mkcert**:

```sh
# once per machine
# Windows: choco install mkcert   OR   scoop install mkcert
bash docker/traefik/gen-mkcert.sh
```

Add to your hosts file:

```
127.0.0.1 play.al.local gs.al.local s1.al.local traefik.al.local
```

## Include in a stack

```yaml
include:
  - path: ./docker/compose.traefik.yml

services:
  backend:
    networks: [al_edge, default]
    labels:
      - traefik.enable=true
      - traefik.http.routers.play.rule=Host(`play.al.local`)
      - traefik.http.routers.play.entrypoints=websecure
      - traefik.http.routers.play.tls=true
      - traefik.http.services.play.loadbalancer.server.port=8090
```

Attach gameservers similarly (`gs.al.local` / `s1.al.local`) with Socket.IO ports and sticky sessions if you scale later (single replica is fine).

## Optional ACME (private / prod)

- **HTTP-01:** public `:80` to Traefik; set `TRAEFIK_ACME=1` and email in the consuming compose.
- **DNS-01:** no public game port required — only DNS API (e.g. Hetzner). Configure via compose override command flags; see historical Coolify notes for Hetzner DNS tokens.
- **LAN-only private:** keep mkcert or upload static certs into `docker/certs`.

## Dashboard

`https://traefik.al.local` (or `TRAEFIK_DASHBOARD_HOST`) when the fragment is running.

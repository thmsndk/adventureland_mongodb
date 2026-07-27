# Adventure Land - The Code MMORPG (MongoDB Edition)

https://adventure.land

A full Node.js + MongoDB port of [Adventure Land](https://github.com/kaansoral/adventureland), originally built on Python 2 / Google App Engine / Datastore. This version replaces all of that with Express, Socket.IO, and MongoDB.

**Please consider supporting Adventure Land on Patreon: https://www.patreon.com/AdventureLand**

## Repositories

This project is split across three repositories:

| Repository | Description |
|---|---|
| [adventureland_mongodb](https://github.com/kaansoral/adventureland_mongodb) | Main game — Express backend, game server, client assets |
| [common_engine](https://github.com/kaansoral/common_engine) | Shared engine — Express init, MongoDB transactions, request handling, admin tools |
| [adventureland_secretsandconfig](https://github.com/kaansoral/adventureland_secretsandconfig) | Config template — keys, options, server definitions (all values randomized/empty) |

## Quick Start

### 1. Clone all three repositories

```sh
# Main game
git clone https://github.com/kaansoral/adventureland_mongodb.git adventureland

# Shared engine (symlinked as adventureland/common)
git clone https://github.com/kaansoral/common_engine.git common

# Config template (symlinked as adventureland/secretsandconfig)
git clone https://github.com/kaansoral/adventureland_secretsandconfig.git secretsandconfig
```

### 2. Create symlinks

```sh
cd adventureland
ln -s ../common common
ln -s ../secretsandconfig secretsandconfig
```

### 3. Install dependencies

```sh
# Main backend
npm install

# Game server
cd node
npm install
cd ..
```

### 4. Set up MongoDB

Install MongoDB locally or use a hosted instance. The default config in `secretsandconfig/keys.js` points to `127.0.0.1:27017` with no auth — this works out of the box with a default local MongoDB install.

If your MongoDB requires authentication or TLS, edit `secretsandconfig/keys.js`:

```js
mongodb_ip: "your-server-ip",
mongodb_port: "27017",
mongodb_user: "your-user",
mongodb_password: "your-password",
mongodb_name: "adventureland",
mongodb_tls: true,                                          // set to true if using TLS
mongodb_ca_file: path.resolve(__dirname, "your-ca.crt"),    // place your CA cert in secretsandconfig/
```

### 5. Configure keys

Open `secretsandconfig/keys.js`. The keys auto-generate random values on each startup, which is fine for local development. For production, set fixed values:

- **`ACCESS_MASTER`** — Admin access key (used for server eval/render, admin tools)
- **`SERVER_MASTER`** — Server-to-server authentication
- **`BOT_MASTER`** — Bot authentication key
- **Stripe keys** — Only needed if you want payments
- **Steam/Discord/Apple keys** — Only needed for those platform integrations
- **Amazon SES** — Only needed for sending emails (verification, password reset)

### 6. Add a hosts entry (optional)

```sh
# Add to /etc/hosts (or C:\Windows\System32\drivers\etc\hosts on Windows)
127.0.0.1       adventure.test
```

Then update `secretsandconfig/options.js`:
```js
base_url: "http://adventure.test",
```

Or just use `http://localhost` — the default config works without any hosts entry.

### 7. Start the backend

```sh
node main.js
```

The backend starts on port **8090** (configurable in `secretsandconfig/options.js`). Visit http://localhost:8090

### 8. Start the game server

```sh
cd node
node server.js local
```

The argument is a key from `servers` in `secretsandconfig/options.js`. The default `local` server runs on port **7192**.

## Docker

Two Compose files ship with this repo. Neither requires host symlinks to `common` or `secretsandconfig` — the image provisions `common_engine` (pinned SHA) and copies config from `docker/templates/` on first boot.

### Dev (laptop, live code mount)

```sh
docker compose -f docker-compose.dev.yml up --build
```

- Backend: http://localhost:8090 — gameserver: `localhost:7192`
- **Mongo UI (Mongonaut):** http://127.0.0.1:8081 — browse/edit `adventureland` DB (passwordless on localhost; see `docker/.env.example`)
- `Dev`/`Local: true`, `unsecure_admin: true` (everyone is admin from localhost — do not expose)
- Dev nodemon/Docker restarts auto-unlock characters on this server (and reclaim the `SR_*` lock); `/rearm` remains a Dev-only nuke-all fallback if anything is still stuck
- Source is bind-mounted; `node_modules` use named volumes (Windows-friendly)
- `DEV_WATCH=1` runs backend/gameserver under nodemon with `--legacy-watch` (needed on Windows Docker Desktop so host edits restart Node; server `require`/`eval` load once at process start)

### Private (non-dev server for others)

```sh
docker compose up --build
```

- Same ports by default; templates use `Dev`/`Local: false`, `machine: "docker"`, `unsecure_admin: false`
- Stuck servers recover via `check_servers` cron (~2 min) — not `/rearm`
- Promote the first admin after signup:

```sh
docker compose exec backend node scripts/make_admin.js you@example.com
```

Replace the fixed masters in the shared secrets volume before any public deploy.

### Community (isolated from dev — `feature/community-leagues`)

Separate project name, ports, and volumes so it does not touch `docker-compose.dev.yml` on `8090`/`7192`/`27017`.

```sh
# optional: cp docker/.env.community.example .env
docker compose -f docker-compose.community.yml up --build
docker compose -f docker-compose.community.yml down      # stop this stack only
docker compose -f docker-compose.community.yml down -v   # wipe community data
```

- Backend: http://localhost:18090 — gameserver: `localhost:17192`
- Mongo UI (Mongonaut): http://127.0.0.1:18081 (ACCOUNT auth; set `MONGO_UI_AUTH_MODE` in `.env`)
- Compose project: `al-community-leagues` (fixed in file)
- Optional PTR GS: `docker compose -f docker-compose.community.yml --profile ptr up --build` → `localhost:17193`
- After editing `docker/templates/community/options.js`, copy into the running secrets volume (templates only seed when missing):  
  `docker cp docker/templates/community/options.js al-community-leagues-backend-1:/app/secretsandconfig/options.js` then restart backend/GS
- **Design tree:** `./design` is bind-mounted read-only into backend/GS. Override with `DESIGN_PATH=/app/design-community` and mount a fork (e.g. bee dungeon) when ready. Reload GS after design edits (`reload_server` or restart).

### Community production (`*.adventureland.community`)

VPS-oriented compose with `design-community`, env-driven URLs, and `restart: unless-stopped`:

```sh
cp docker/.env.community.prod.example .env   # edit URLs + replace secrets
docker compose -f docker-compose.community.prod.yml up -d --build
docker compose -f docker-compose.community.prod.yml --profile ptr up -d --build   # optional PTR GS
node scripts/smoke_community_prod.js http://localhost:8090
```

- Template: `docker/templates/community-prod/` (`SECRETS_TEMPLATE=community-prod`)
- Level ladder: `/ladder/community` (top 50 by level, then XP)
- Terminate TLS on `play.*` / `gs.*` in your reverse proxy; set `COMMUNITY_GS_PUBLIC` to what browsers reach

### Networking (`address` vs `internal_address`)

Each entry in `options.servers` has two hostnames:

| Field | Who uses it | Compose default |
| --- | --- | --- |
| `address` | Browsers (Socket.IO) | `localhost:7192` |
| `internal_address` | Backend HTTP RPC (`server_eval`) | `gameserver:7192` |

All-in-one compose uses those defaults. Hybrid/multi-region setups can run extra gameservers on other machines: set each key’s `address` to what players reach and `internal_address` to a host the **backend** can reach (LAN IP, VPN, or public IP). Remote gameservers need `base_url` pointing at an API host **they** can reach.

### What seed does

On first boot the `seed` service waits for the Mongo replica set, downloads `db.rdbms`, runs `agentic/_migrate_rdbms.py`, clears `server.online`, runs `node/precompute_bfs.js`, and publishes `precomputed_map_data.js` on a shared volume for the gameserver.

## Seeding Game Data

The database needs map data and game entities to function. You have two options:

### Option A: Import from the RDBMS dump (recommended)

The original AppEngine development database is available at:
https://github.com/kaansoral/adventureland-appserver/blob/main/storage/db.rdbms

This SQLite file contains users, characters, maps, and all game data from the development server.

Use the migration scripts in `agentic/` to import this data into MongoDB:

```sh
# Set up Python environment
cd agentic
python3 -m venv .venv
source .venv/bin/activate
pip install pymongo

# Run the RDBMS migration (reads db.rdbms, writes to MongoDB)
python _migrate_rdbms.py
```

See `agentic/` for additional fix scripts that handle ID prefixing, repeated fields, and other migration edge cases. The scripts are documented in `CLAUDE.md`.

### Option B: Start fresh

The game will create entities as needed. You can sign up for a new account through the web UI. You'll need to populate map data for the game server to function — the BFS precomputation (`node/precompute_bfs.js`) depends on map geometry being in the database.

## Project Structure

```
adventureland/
  main.js                  # Express backend (port 8090)
  api.js                   # API endpoints (REF pattern)
  adventure_functions.js   # Game functions (auth, characters, servers, etc.)
  models.js                # MongoDB model definitions
  crons.js                 # Scheduled tasks
  filters.js               # Nunjucks template filters
  node/
    server.js              # Game server (Socket.IO)
    server_functions.js    # Game logic
    precompute_bfs.js      # BFS pathfinding precomputation
    precomputed_map_data.js # Generated BFS data
  design/                  # Game data (items, monsters, maps, skills, etc.)
  htmls/                   # Nunjucks templates
  js/                      # Client-side JavaScript
  css/                     # Stylesheets
  images/                  # Game art and tilesets
  sounds/                  # Sound effects and music
  agentic/                 # Migration and data fix scripts
  common -> ../common      # Symlink to common_engine
  secretsandconfig -> ...  # Symlink to your config
```

## Making Yourself Admin

**Local / Docker dev** (`Local: true` and `unsecure_admin: true`): `is_admin()` is true for everyone from localhost, so ACCESS/V and admin tools work without a DB `admin` flag.

**Private / production** (`unsecure_admin: false`): set `user.admin` after signup:

```sh
# Preferred for Compose: set ADMIN_EMAIL on the backend service, then restart after signup
# Or promote manually:
node scripts/make_admin.js you@example.com
# or inside Compose:
docker compose exec backend node scripts/make_admin.js you@example.com
```

The HTTP route `/admin/make/user/admin` is disabled.

## Contributing

PRs are welcome! Please keep them **small and focused** — one fix or one feature per PR. Large PRs that touch many unrelated things are hard to review and likely to be rejected. If you're planning something big, open an issue or discuss it on Discord first.

## Discussion

Use the **#development** channel on Discord for questions and collaboration: https://discord.gg/hz25Kz9FsH

## Code Formatting

This project uses [Prettier](https://prettier.io/) for the game server (`node/` folder). If you use VSCode, install the recommended extensions — formatting happens automatically on save.

## License

[AdventureLandOnlyUse](LICENSE) — free for commercial use with attribution. See the license file for full terms.

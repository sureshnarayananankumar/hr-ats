# HR-ATS — Docker Guide

Everything runs in Docker Compose. This document covers the services,
how they are isolated, and the operations you will actually perform.

---

## 1. Services

| Service | Image | Host port | Purpose |
|---|---|---|---|
| `kong` | `kong:3.9` | `127.0.0.1:8000` | API gateway — the **only** way into the API |
| `frontend` | built locally | `127.0.0.1:5173` | React SPA |
| `backend` | built locally | **none** | NestJS API, internal network only |
| `mysql` | `mysql:8.4` | `127.0.0.1:3307` | Database (Workbench connects here) |
| `redis` | `redis:7.4-alpine` | **none** | Queues and caching, internal only |
| `mailhog` | `mailhog/mailhog:v1.0.1` | `127.0.0.1:8025` | Development SMTP sink |
| `migrate` | built locally | — | One-shot Prisma migration runner (profile) |

### Why some services have no host port

The backend, Redis and the Kong Admin API are deliberately unpublished.
An attacker on your machine or LAN cannot reach them, and there is no
way to bypass the gateway's rate limiting and header stripping by
hitting the API directly.

The `127.0.0.1:` prefix on the published ports is itself a security
control: it binds to loopback, so the ports are **not** exposed to your
local network.

Verified by `scripts/kong-test.sh`:

```
PASS  backend is NOT reachable directly on :3000
PASS  Kong Admin API is NOT exposed on :8001
PASS  Redis is NOT exposed on :6379
PASS  MySQL is bound to loopback only (127.0.0.1:3307)
```

---

## 2. Networks

```
hr-ats-edge      kong, frontend          reachable from the host
hr-ats-internal  kong, backend, mysql,   service-to-service only
                 redis, mailhog
```

Kong is the only service on both networks — that is what makes it the
single ingress point.

Containers address each other by **service name**, never `localhost`.
Inside Docker the backend connects to `mysql:3306`, not `localhost:3306`.

---

## 3. Volumes

| Volume | Holds |
|---|---|
| `hr_ats_mysql_data` | The entire database |
| `hr_ats_redis_data` | Redis AOF persistence |
| `hr_ats_backend_storage` | Uploaded candidate documents |

### Data safety

```powershell
docker compose down        # stops and removes containers — DATA KEPT
docker compose down -v     # ALSO DELETES VOLUMES — DATA DESTROYED
```

`down -v` is never part of a normal stop, restart or upgrade. Use
`scripts/docker-reset.ps1 -IncludeData`, which takes a backup and
requires you to type `DELETE ALL DATA` before it will proceed.

### Verified: data survives restarts

```
BEFORE restart  users|jobs|applications|audit = 9|3|3|73
AFTER  restart  users|jobs|applications|audit = 9|3|3|73
*** DATA PERSISTED ACROSS RESTART ***
```

Initialisation scripts in `/docker-entrypoint-initdb.d` run **only** when
the data volume is empty, so a restart can never re-run them or wipe
data.

---

## 4. Required commands

All run from `D:\HR-ATS`.

### Start

```powershell
docker compose up -d --build
```

### Status

```powershell
docker compose ps
```

Expected:

```
NAME              STATUS                    PORTS
hr-ats-backend    Up (healthy)              3000/tcp
hr-ats-frontend   Up (healthy)              127.0.0.1:5173->5173/tcp
hr-ats-kong       Up (healthy)              127.0.0.1:8000->8000/tcp
hr-ats-mailhog    Up                        127.0.0.1:1025->1025/tcp, 127.0.0.1:8025->8025/tcp
hr-ats-mysql      Up (healthy)              127.0.0.1:3307->3306/tcp
hr-ats-redis      Up (healthy)              6379/tcp
```

Note `hr-ats-backend` shows `3000/tcp` with **no host mapping** — that
is correct.

### Logs

```powershell
docker compose logs -f backend frontend
docker compose logs -f mysql
docker compose logs -f kong
```

Or: `powershell -File scripts\docker-logs.ps1 -Errors`

### Stop (preserving data)

```powershell
docker compose down
```

### Restart

```powershell
docker compose up -d
```

---

## 5. Prisma migrations

Migrations run as a **separate, one-shot step**, never automatically on
application start. That prevents multiple API replicas racing to migrate
the same database.

```powershell
docker compose --profile migrate run --rm migrate
```

The `migrate` service uses `MIGRATE_DATABASE_URL`, which points at the
`hr_ats_migrate` account. The API itself uses `hr_ats_app`, which has
**no DDL rights** — a compromised API cannot alter the schema.

Check status:

```powershell
docker compose exec backend npx prisma migrate status
```

Seed reference data:

```powershell
docker compose exec backend npx ts-node prisma/seed.ts
```

---

## 6. MySQL Workbench

Port **3307** is used so a native MySQL Server on the default 3306 never
collides with the container.

| Field | Value |
|---|---|
| Hostname | `127.0.0.1` |
| Port | `3307` |
| Username | `hr_ats_app` |
| Default schema | `hr_ats_db` |

Full walkthrough, including reverse-engineering the EER diagram, is in
`database/README.md`.

---

## 7. Build targets

Both application images are multi-stage.

### Backend (`backend/Dockerfile`)

| Target | Used for |
|---|---|
| `development` | Default. Full toolchain, hot reload, Prisma CLI available |
| `production` | Compiled `dist/`, pruned dependencies, **runs as non-root `node`** |

### Frontend (`frontend/Dockerfile`)

| Target | Used for |
|---|---|
| `development` | Vite dev server with hot reload |
| `production` | Static build served by nginx as the non-root `nginx` user on :8080 |

Switch targets with `BACKEND_BUILD_TARGET` / `FRONTEND_BUILD_TARGET`
in `.env`.

> Vite inlines `VITE_*` values **at build time**, so `VITE_API_BASE_URL`
> is a build argument for the production image, not a runtime variable.

### A note on `npm ci --ignore-scripts=false`

npm 11 blocks lifecycle scripts by default. Prisma's engine download and
argon2's native binding both need theirs, so the Dockerfiles opt in
explicitly. Without it the image builds but fails at runtime.

---

## 8. Health checks

| Service | Check |
|---|---|
| mysql | `mysqladmin ping` |
| redis | `redis-cli ping` (authenticated) |
| backend | `GET /api/health` |
| kong | `kong health` |
| frontend | HTTP probe on the dev/preview port |

`depends_on: condition: service_healthy` means the backend waits for a
genuinely ready database rather than merely a started container.

---

## 9. Test override

`docker-compose.test.yml` raises the auth rate limits so the smoke suite
is not throttled by its own logins. It is **never applied by default**:

```powershell
docker compose -f docker-compose.yml -f docker-compose.test.yml up -d
bash scripts/smoke-test.sh http://localhost:8000/api
docker compose up -d        # restore the secure configuration
```

`kong/kong.test.yml` is generated from `kong/kong.yml` by
`scripts/gen-kong-test-config.js`, so the test gateway can never drift
from the real security policy — only the counters differ.

---

## 10. Production differences

This compose file targets local development. For production:

1. Set `NODE_ENV=production`, `COOKIE_SECURE=true`, and real
   `CORS_ORIGINS`. The API refuses to boot otherwise.
2. Build with the `production` targets (non-root, minimal images).
3. Terminate TLS in front of Kong and serve the SPA over HTTPS.
4. Replace MailHog with a real SMTP provider.
5. Move secrets from `.env` to Docker secrets or a secret manager.
6. Run migrations as a deliberate deployment step, before rolling out
   new application containers.
7. Switch Kong rate limiting from `policy: local` to the Redis policy if
   you run more than one gateway instance.
8. Schedule backups, and **test a restore**.

---

## 11. Troubleshooting

**MySQL crash-loops on first start.**
`--default-authentication-plugin` was removed in MySQL 8.4 and causes an
immediate abort. Use `--authentication-policy`. If the first boot
already failed, the volume holds a half-initialised data directory —
remove it *only* after confirming it holds no real data:

```powershell
docker volume inspect hr_ats_mysql_data
docker run --rm -v hr_ats_mysql_data:/v alpine ls /v   # look for hr_ats_db
```

**`CHANGE_ME` errors at startup.**
Startup validation refuses placeholder secrets. Fill in `.env`.

**Port already allocated.**
Change `MYSQL_HOST_PORT`, `KONG_PROXY_PORT` or `FRONTEND_PORT` in `.env`.

**Backend cannot reach MySQL.**
Inside Docker the host is `mysql`, not `localhost`. Check `DATABASE_URL`.

**Kong returns 502.**
The backend is not healthy yet. `docker compose logs backend`.

**Changes are not picked up.**
The development targets mount nothing by default — rebuild:
`docker compose up -d --build backend`.

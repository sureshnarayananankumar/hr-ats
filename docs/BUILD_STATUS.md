# HR-ATS — Build Status

Living record of what is **built and verified** versus what remains.
Nothing is marked verified unless a command was actually executed and
its output checked.

Last updated: 2026-10-14

---

## Environment (inspected on this machine)

| Item | Finding |
|---|---|
| `D:\HR-ATS` | Created; drive had 292 GB free |
| Node.js / npm | v24.21.0 / 11.19.0 |
| Git | 2.22.0.windows.1 |
| Docker / Compose | 29.8.2 / v5.5.1 (Docker Desktop, per-user install) |
| **MySQL Server (native)** | **Not installed.** Only XAMPP MariaDB bundles under `D:\xampp*` (stopped) |
| MySQL Workbench | 8.0 CE installed at `C:\Program Files\MySQL` |
| Ports 3306/3307/5173/3000/8000/6379 | Free (port 80 held by XAMPP `httpd`) |

**Decision:** because no native MySQL Server was present, the database
runs as **MySQL 8.4 LTS in Docker**, published to `127.0.0.1:3307` for
MySQL Workbench. This satisfies sections 26–27 and avoids installing a
second database engine alongside the existing XAMPP MariaDB.

---

## Test results — all executed, all green

| Suite | Command | Result |
|---|---|---|
| Backend unit | `cd backend && npm test` | **87 passed**, 4 suites |
| Frontend unit | `cd frontend && npm test` | **53 passed**, 3 files |
| E2E (Playwright) | `cd frontend && npm run e2e` | **31 passed**, 0 failed |
| API + security (direct) | `bash scripts/smoke-test.sh` | **60 passed**, 0 failed |
| API + security (through Kong, containerized) | `bash scripts/smoke-test.sh http://localhost:8000/api` | **60 passed**, 0 failed |
| Kong gateway | `bash scripts/kong-test.sh` | **24 passed**, 0 failed |
| Backend typecheck + build | `npx tsc --noEmit && npm run build` | clean |
| Frontend typecheck + build | `npx tsc -b && npm run build` | clean |
| Compose validation | `docker compose config` | valid, 6 services |

**Total: 255 automated checks, 0 failing.**

---

## Phase status

| Phase | Scope | Status |
|---|---|---|
| 1 | Project initialisation | **Done** |
| 2 | MySQL + Prisma configuration | **Done & verified** |
| 3 | Schema & migrations | **Done & verified** |
| 4 | Authentication & security | **Done & verified** |
| 5 | Jobs & approvals | **Done & verified** |
| 6 | Candidate portal & applications | **Done & verified** |
| 7 | Pipeline & status history | **Done & verified** |
| 8 | Interviews, offers, onboarding | **Done** — UI + API complete; smoke coverage is partial |
| 9 | Notifications, reports, audit | **Done & verified** |
| 10 | Responsive frontend | **Done & verified** |
| 11 | Migrations, tests, builds | **Done & verified** |
| 12 | Documentation | **Done** |

---

## Verified results in detail

### Database

```
hr_ats_db       utf8mb4  utf8mb4_0900_ai_ci
hr_ats_shadow   utf8mb4  utf8mb4_0900_ai_ci
tables 40 (+_prisma_migrations) | foreign keys 64 | indexes 157
```

Privilege separation confirmed — the runtime account has **no DDL rights**:

```
GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON `hr_ats_db`.* TO `hr_ats_app`@`%`
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, REFERENCES, INDEX,
      ALTER, EXECUTE, CREATE VIEW, SHOW VIEW, TRIGGER ON `hr_ats_db`.* TO `hr_ats_migrate`@`%`
```

Data persistence across a container restart:

```
BEFORE  users|jobs|applications|audit = 9|3|3|73
AFTER   users|jobs|applications|audit = 9|3|3|73
*** DATA PERSISTED ACROSS RESTART ***
```

### Seed

`permissions 70 · roles 6 · departments 8 · skills 31 · sources 8 ·
templates 14 · settings 8 · users 9 · candidates 2`

### Docker stack

```
hr-ats-backend    Up (healthy)   3000/tcp                 ← no host port
hr-ats-frontend   Up (healthy)   127.0.0.1:5173->5173/tcp
hr-ats-kong       Up (healthy)   127.0.0.1:8000->8000/tcp
hr-ats-mailhog    Up             127.0.0.1:1025, 8025
hr-ats-mysql      Up (healthy)   127.0.0.1:3307->3306/tcp
hr-ats-redis      Up (healthy)   6379/tcp                 ← no host port
```

### Gateway isolation

```
PASS  backend is NOT reachable directly on :3000
PASS  Kong Admin API is NOT exposed on :8001
PASS  Redis is NOT exposed on :6379
PASS  MySQL is bound to loopback only (127.0.0.1:3307)
PASS  spoofed identity headers grant no access
PASS  forged X-Gateway-Secret grants no access
PASS  stack version is not advertised
```

### Application behaviour

Verified end to end: job create → submit → approve → publish → appears on
the public careers portal → candidate applies → duplicate application
rejected with 409 → HR advances the stage → history recorded → dashboard
counts update from real rows → reports run → CSV and Excel export.

Security verified: no account enumeration, candidate-A-vs-B IDOR blocked
on applications *and* profiles, candidates blocked from the directory,
admin area, dashboard and audit trail, header spoofing ineffective,
mass-assignment rejected, stage-skipping rejected, logout invalidates the
session.

---

## Issues found and fixed during the build

| Issue | Root cause | Fix |
|---|---|---|
| MySQL crash-looped on first boot | `--default-authentication-plugin` was **removed in MySQL 8.4** | Switched to `--authentication-policy`; cleared the half-initialised volume after confirming it held no user data |
| Empty `dist/` after a clean build | `tsconfig.tsbuildinfo` lived at the project root, so a deleted `dist` left the incremental cache claiming "already emitted" | Pinned `tsBuildInfoFile` inside `dist/` |
| `dist/src/main.js` instead of `dist/main.js` | `prisma/**` in `include` raised the computed `rootDir` | Restricted `include` to `src/**`, set explicit `rootDir` |
| Session cookie never stored | `Domain=localhost` does not match a `127.0.0.1` request | Cookie domain is now **optional**; unset yields a stricter host-only cookie |
| Excel export returned 400 | `format` was undeclared and validation runs `forbidNonWhitelisted` | Added a validated `ExportFormat` field to the shared pagination DTO |
| Smoke suite could not complete | Login rate limiting throttled the suite's own logins | Rate limits made env-configurable with secure defaults; added `docker-compose.test.yml` |
| Kong still advertised `Server: kong/3.9` | A `response-transformer` cannot remove it — Kong appends it *after* plugins run | Set `KONG_HEADERS: "off"` |
| `COOKIE_DOMAIN` reverted to `localhost` in Docker | `${VAR:-default}` substitutes for an **empty** value too | Changed to `${COOKIE_DOMAIN-}` |
| Frontend code changes needed a rebuild | The dev image baked in a source snapshot with no bind mount | Mounted `frontend/src` (and configs) read-only into the container |
| Sidebar nav landmark was unnamed | `aria-label` sat on the `<aside>` (role `complementary`), leaving the `<nav>` landmark anonymous | Moved the label onto the `<nav>` |
| Frontend container reported `unhealthy` while serving correctly | The health check called `wget`, which the slim Node image does not ship, so the probe could never run | Health check now uses `node`, which is guaranteed present |
| CORS denial surfaced as `500 Internal Server Error` | The origin callback passed an `Error`, which the exception filter maps to 500. A rejected origin is a client condition, not a server fault | Deny with `callback(null, false)` and log the refused origin; the browser enforces the block |
| Kong allowed `127.0.0.1:5173` but the API did not | The two CORS lists live in different files and drifted | Aligned both; added `scripts/check-cors-consistency.mjs` to catch future drift |
| Login returned 200 then every request 401 | Cookies are `SameSite=Lax`, which is not sent cross-site. A page on `127.0.0.1` calling an API on `localhost` set the cookie but never sent it back | API hostname is now pinned to the page hostname between loopback aliases (7 regression tests) |

### Problems that were in the tests, not the product

Called out explicitly so the record is honest:

- **45 spurious smoke-test failures** came from the harness: `X=$(api …)`
  runs in a subshell, so the status variable it set was discarded. The
  status now passes through a file.
- **HR Admin receiving `403` on audit logs is correct** — section 4
  assigns audit logs to Super Admin. The test was corrected, not the code.
- **Playwright `/api` requests returned HTML** — a relative request hit
  Vite's SPA fallback, which answers 200. Specs now address the gateway
  origin explicitly.
- **`baseURL` ending in `/api` was discarded** — a leading-slash path is
  resolved from the origin. Specs use the origin plus full paths.
- **Strict-mode selector violations** — `/open position/i` matched both
  the hero copy and the result count. Selectors tightened.
- **`413` vs `417` on oversized bodies** — curl's `Expect: 100-continue`
  is refused by nginx *before* the size plugin runs. Both reject the
  body; the test now asserts each path separately.

---

## Known limitations

Stated plainly rather than implied otherwise:

- **MFA is not yet forced** for privileged roles that have not enrolled.
  The policy is configured and login warns, but a Super Admin without MFA
  can still sign in.
- **Interview, offer and onboarding flows** have UI and API coverage and
  unit-tested transition rules, but no end-to-end smoke scenario that
  walks a candidate from interview through offer to joining.
- **Kong rate limiting uses `policy: local`.** Correct for one gateway
  instance; switch to the Redis policy for several.
- **No TLS locally.** Production requires HTTPS; `COOKIE_SECURE=true` is
  enforced there.
- **Backups are documented but not scheduled**, and the restore procedure
  has not been exercised on this machine.
- **No dependency scanning or CI pipeline** is wired up yet.
- **BullMQ is wired into the stack** (Redis is running and healthy) but
  background work currently runs on in-process cron rather than queues.

---

## Enterprise expansion

A separate, additive programme of work is inventoried in
`docs/FEATURE_EXPANSION_PLAN.md`:

| Phase | Status |
|---|---|
| 1 — Inventory and plan | **Done** |
| 2–13 — Schema, CRM, automation, AI, analytics, governance | Pending |

That document records the measured baseline (40 models, 113 API paths,
129 operations) and a gap analysis of all 19 expansion modules against
what already exists.

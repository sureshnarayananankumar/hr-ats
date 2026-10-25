# Kong Gateway — Security Configuration

Kong runs in **DB-less declarative mode** (`kong/kong.yml`), pinned to
`kong:3.9`. Everything used here is **Kong OSS** — no Enterprise plugin
is required.

---

## 1. The central principle

> **Kong is a gateway, not an authorisation system.**

Kong enforces traffic-level controls: rate limits, body size, CORS,
header hygiene and correlation IDs. It does **not** decide who may read
a candidate record.

Every route Kong forwards is independently authenticated and authorised
inside NestJS. If Kong were removed entirely, no one would gain access
to anything — they would only lose the edge protections.

This matters because a common failure mode is treating the gateway as
the security boundary and leaving the upstream open. Here the upstream
is not open: it is on a private network, it validates its own sessions,
and in production it rejects any request that did not come through Kong.

---

## 2. Architecture

```
Browser ──► Kong :8000 ──► backend:3000 ──► mysql:3306
            (published)    (internal)       (internal, 3307 → Workbench)
```

| Component | Host exposure |
|---|---|
| Kong proxy | `127.0.0.1:8000` |
| Kong Admin API | **none** — bound to `127.0.0.1:8001` *inside* the container |
| Backend | **none** |
| Redis | **none** |
| MySQL | `127.0.0.1:3307` (Workbench only) |

### The Admin API

`KONG_ADMIN_LISTEN: "127.0.0.1:8001"` binds the Admin API to the
container's own loopback. No port is published, so it is unreachable
from the host or the network.

To administer Kong, exec into the container:

```powershell
docker compose exec kong curl -s http://127.0.0.1:8001/status
```

In DB-less mode the Admin API is read-only for configuration anyway —
the declarative file is the source of truth.

`KONG_ADMIN_GUI_LISTEN: "off"` disables Kong Manager entirely.

---

## 3. Route policy

Routes are ordered from most specific to least, so the tight limits win.

| Route | Paths | Rate limit | Body limit |
|---|---|---|---|
| `auth-login` | `/api/auth/login`, `/api/auth/mfa/verify` | **5/min**, 50/hr | 1 MB |
| `auth-register-reset` | register, forgot/reset password, verify email | **3/min**, 20/hr | 1 MB |
| `auth-session` | remaining `/api/auth` | 60/min | — |
| `documents` | `/api/documents` | 30/min, 300/hr | **12 MB** |
| `admin-api` | `/api/admin` | 60/min | 2 MB |
| `public-careers` | `/api/public` (GET only) | 120/min, 2000/hr | — |
| `health` | `/api/health` | none | — |
| `api-general` | everything else under `/api` | 300/min, 5000/hr | 2 MB |

Rationale for the outliers:

- **Login is the brute-force surface**, so it gets the tightest limit.
  The application enforces its own limit and account lockout on top.
- **Registration and password reset send email to a third party**, so
  they are limited harder than login to prevent using the system as a
  spam relay.
- **Documents** is the only route allowed a large body (12 MB at the
  gateway, 10 MB enforced in the application). NestJS independently
  validates MIME type, magic bytes, extension and size — Kong's limit
  only stops an oversized body from reaching the app at all.
- **Health** is unlimited because Docker and Kong poll it constantly.

### Verified

```
PASS  login rate limit returns 429
PASS  oversized body rejected by the size plugin (413)
PASS  oversized body also refused with Expect: 100-continue (417)
PASS  normal-sized body passes the size limit (reaches auth)
PASS  rate-limit headers are returned
```

> On `413` vs `417`: when curl sends `Expect: 100-continue` for a large
> body, nginx refuses at the expect stage with **417** before the plugin
> runs. Both reject the body; `413` is the plugin's own response.

---

## 4. Identity-header stripping — the important one

A client must **never** be able to assert who it is by sending a header.

The `request-transformer` plugin blanks every inbound identity header:

```yaml
remove:
  headers:
    - X-User-Id
    - X-User-Email
    - X-Role
    - X-Roles
    - X-Permissions
    - X-Candidate-Id
    - X-Gateway-Secret     # clients cannot forge the gateway's own proof
    - X-Forwarded-For      # prevents IP spoofing
    - X-Real-IP
```

and injects the gateway's shared secret:

```yaml
add:
  headers:
    - "X-Gateway-Secret:${{ env \"KONG_GATEWAY_SHARED_SECRET\" }}"
```

Two layers of defence here:

1. **The backend never reads identity headers at all.** `JwtAuthGuard`
   derives identity solely from a token the server signed. Even if a
   header slipped through, it would be ignored.
2. **Kong strips them anyway**, so they cannot reach the application or
   pollute logs.

`X-Gateway-Secret` is stripped *then* added, so a client cannot forge
it — whatever they send is discarded before Kong's own value is applied.

In production, `GatewayGuard` rejects any request lacking the correct
secret, which closes the "bypass the gateway by hitting the container
directly" hole.

### Verified

```
PASS  spoofed identity headers grant no access     (X-Role: SUPER_ADMIN → 401)
PASS  forged X-Gateway-Secret grants no access
```

---

## 5. CORS

```yaml
origins:
  - http://localhost:5173
  - http://localhost:8080
  - http://127.0.0.1:5173
credentials: true
```

Origins are listed explicitly. **A wildcard is incompatible with
credentialed requests** and would expose every authenticated endpoint to
any website on the internet.

Kong and NestJS enforce the same list; keep `kong/kong.yml` and
`CORS_ORIGINS` in step. The backend additionally refuses to boot in
production if `CORS_ORIGINS` contains `*`.

### Verified

```
PASS  configured origin is allowed by CORS
PASS  unknown origin is rejected by CORS       (https://evil.example.com)
PASS  no wildcard origin with credentials
```

---

## 6. Correlation IDs

`correlation-id` generates `X-Request-Id` per request and forwards it
upstream, where `RequestIdMiddleware` adopts it — after sanitising it
against `^[A-Za-z0-9._-]{1,64}$`, because the value ends up in log lines
and a response header and would otherwise permit log forging and header
injection.

The id is stored on `audit_logs.requestId`, so one request can be traced
from gateway log → application log → audit record.

---

## 7. Logging

`file-log` writes to stdout: request id, route, status and latency.

It deliberately does **not** log request or response bodies. Doing so
would put passwords, session tokens, resume contents and salary figures
into a plaintext log file.

```powershell
docker compose logs -f kong
```

In production, ship these to a log sink with retention and access
controls — they contain IP addresses and URLs, which are personal data.

---

## 8. Response headers

Set by the `response-transformer` plugin:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`

And `KONG_HEADERS: "off"` suppresses the `Server` and `Via` version
headers Kong would otherwise advertise.

> A `response-transformer` cannot remove `Server` — Kong appends it
> *after* plugins run. `KONG_HEADERS=off` is the supported way, and this
> was confirmed by test.

Content Security Policy and HSTS are set by the application and nginx,
which know their own content.

### Verified

```
PASS  X-Content-Type-Options: nosniff is set
PASS  X-Frame-Options: DENY is set
PASS  Referrer-Policy is set
PASS  X-Request-Id is generated for correlation
PASS  stack version is not advertised
```

---

## 9. IP restriction — deliberately not enabled

The `ip-restriction` plugin is available in OSS and could lock
`/api/admin` to an office range. It is **not enabled by default**, on
purpose:

Inside Docker, the client IP Kong sees is the bridge gateway, not the
real user. A naive allow-list would either lock out every legitimate
user or allow everyone, depending on which address you listed.

To enable it correctly in production:

1. Terminate TLS and forward the real client IP in front of Kong.
2. Set `KONG_TRUSTED_IPS` to **your proxy's address only** — not
   `0.0.0.0/0`, which would let any client spoof `X-Forwarded-For`.
3. Then add the plugin to the `admin-api` route.

IP restriction must never be the only control. It is a useful extra
layer, not authentication.

---

## 10. TLS

Local development runs over plain HTTP, which is acceptable because
nothing leaves the loopback interface.

**Production requires HTTPS.** Without it, session cookies travel in
clear text and `COOKIE_SECURE=true` (which the backend enforces in
production) would prevent them being set at all.

Options:

- Terminate TLS at Kong with certificates mounted into the container.
- Or terminate at a load balancer in front of Kong and forward over the
  private network.

Either way, set `TRUST_PROXY_HOPS` to the real number of hops so client
IPs stay accurate for rate limiting and audit logging.

---

## 11. Features requiring Kong Enterprise

Documented so nothing here is mistaken for something it is not:

| Feature | Edition | Alternative used here |
|---|---|---|
| OpenID Connect plugin | Enterprise | Application-level auth in NestJS |
| mTLS authentication | Enterprise | Not required for this deployment |
| Kong Manager (admin GUI) | Enterprise (full) | Declarative config file |
| Dynamic Vault secrets | Enterprise | `env` vault + Docker secrets |
| GraphQL rate limiting | Enterprise | Not applicable (REST API) |
| Advanced request validation | Enterprise | NestJS DTOs with `class-validator` |
| RBAC on the Admin API | Enterprise | Admin API is not exposed at all |

Everything this project actually relies on — `rate-limiting`, `cors`,
`request-size-limiting`, `request-transformer`, `response-transformer`,
`correlation-id`, `file-log`, `ip-restriction` — is OSS.

---

## 12. Verifying the gateway

```powershell
cd D:\HR-ATS
docker compose up -d
bash scripts/kong-test.sh
```

Covers routing, network isolation, authorization behind the gateway,
header spoofing, security headers, CORS (allowed and rejected origins),
request-size limiting and rate limiting.

**Last run: 24 passed, 0 failed.**

---

## 13. Known limitations

- **`policy: local` rate limiting.** Counters are per Kong instance.
  With one gateway this is correct; across several, switch to the Redis
  policy so limits are shared. Redis is already in the stack.
- **No upstream active health checks.** Kong relies on Docker's health
  check and `depends_on`. Active probes would add faster failover for a
  multi-replica backend.
- **No TLS in the local configuration**, as described above.
- **`KONG_TRUSTED_IPS` is `0.0.0.0/0`** so that the Docker bridge hop is
  trusted in development. In production this must be narrowed to the
  real proxy address, otherwise `X-Real-IP` becomes client-controlled.

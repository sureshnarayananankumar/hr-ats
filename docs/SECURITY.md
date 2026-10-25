# HR-ATS Security Guide

What is implemented, where it lives, and how to verify it.

Claims in this document marked **verified** were confirmed by running
`scripts/smoke-test.sh` against the live API (60/60 checks passed on
2026-10-14). Anything not verified is labelled as such.

---

## 1. Threat model

An ATS holds concentrated personal data: identities, resumes, salary
expectations, interview assessments and offer terms. The controls below
are organised around what actually goes wrong in these systems.

| Threat | Primary control |
|---|---|
| Candidate reads another candidate's record (IDOR) | Object-level checks at the query layer, scoped by the verified token |
| Credential stuffing / brute force | Argon2id, per-route rate limits at Kong **and** the app, account lockout |
| Session theft via XSS | HTTP-only cookies — no token is readable by JavaScript |
| CSRF on cookie-authenticated routes | Double-submit cookie + `X-CSRF-Token` header |
| Privilege escalation via request body | `whitelist` + `forbidNonWhitelisted` strip unknown fields |
| Privilege escalation via headers | Kong strips identity headers; the app never reads them |
| Malicious file upload | Magic-byte validation, extension blocklist, server-generated names |
| Path traversal to arbitrary files | Resolved paths are proved to sit inside the storage root |
| SQL injection | Prisma parameterised queries; no string-concatenated SQL |
| Spreadsheet formula injection | `=`, `+`, `-`, `@` prefixed cells are neutralised on export |
| Secrets in logs | Recursive redaction before any audit row is written |
| Gateway bypass | Shared-secret header required in production |

---

## 2. Authentication

### Password storage — Argon2id

`backend/src/common/utils/crypto.util.ts`

```ts
type: argon2.argon2id,
memoryCost: 19456,  // 19 MiB
timeCost: 2,
parallelism: 1,
```

These follow OWASP's password-storage guidance. Argon2id is chosen over
bcrypt for its memory-hardness, which raises the cost of GPU cracking.

`verifyPassword` returns `false` rather than throwing on a malformed
stored hash, so a corrupted row can never become an authentication
bypass.

### Account enumeration

Registration, login and password reset all return **identical responses**
whether or not the account exists:

- Login: the same `401 Invalid email or password` for a bad password and
  an unknown address, and the unknown path still performs a hash to
  equalise timing.
- Registration with an existing address returns the normal "check your
  email" response, and a *"someone tried to register"* notice is emailed
  to the real owner instead.
- Password reset always returns "if an account exists…".

**Verified:** `unknown account returns the same 401 (no enumeration)`.

### Brute-force protection

Two independent layers:

1. **Kong** — 5 login attempts per IP per minute (`kong/kong.yml`).
2. **Application** — `@Throttle(LOGIN_THROTTLE)`, plus account lockout
   after `MAX_FAILED_LOGINS` (default 5) for `LOCKOUT_MINUTES`
   (default 15).

Every attempt, successful or not, is written to `login_attempts`.
No password is ever stored there.

> Rate limits are environment-configurable (`backend/src/common/auth/throttle.config.ts`)
> with the secure values as defaults. `scripts/dev-api.ps1 -TestMode`
> raises them so a full test run is not throttled by its own logins —
> that flag is for local testing only.

### Multi-factor authentication

TOTP via `otplib`, with ten single-use recovery codes stored as SHA-256
hashes. Codes are shown exactly once at enrolment.

Login with MFA issues a **half-authenticated token** (`mfa: false`) that
only `/auth/mfa/verify` accepts — `JwtAuthGuard` rejects it everywhere
else unless the route is explicitly `@MfaExempt()`.

Roles requiring MFA are configurable via `MFA_REQUIRED_ROLES`
(default: `SUPER_ADMIN`, `HR_ADMIN`).

---

## 3. Sessions

### Cookies

| Cookie | Contents | Flags |
|---|---|---|
| `hr_ats_access` | Signed JWT | `HttpOnly`, `SameSite=Lax`, `Secure` in prod, `Path=/` |
| `hr_ats_refresh` | Opaque random token | `HttpOnly`, `SameSite=Lax`, `Secure` in prod, `Path=/api/auth` |
| `hr_ats_csrf` | CSRF token | Readable by JS **by design** (double-submit) |

No token is in `localStorage`, so an XSS flaw cannot read a session.

The refresh cookie is scoped to `/api/auth`, so it is not transmitted on
ordinary API calls — it is only sent where it is actually needed.

**Cookie domain is unset by default**, producing a host-only cookie.
That is stricter than naming a domain, which would also send the cookie
to sibling subdomains. Set `COOKIE_DOMAIN` only if the SPA and API are
deliberately on different subdomains.

### Refresh-token rotation and reuse detection

Refresh tokens are stored **only as SHA-256 digests** (`refresh_sessions.tokenHash`),
so a database leak yields nothing usable.

Each refresh rotates the token and revokes the old row. Presenting an
already-rotated token means it leaked, so the **entire session family is
revoked** and a `TOKEN_REUSE_DETECTED` audit record is written at
`CRITICAL` severity.

Sessions are revoked on: logout, logout-all, password change, password
reset, role change, and account suspension/deactivation.

**Verified:** `session is unusable after logout`.

---

## 4. Authorization

### Permission-based, enforced server-side

70 permission keys across 6 roles (`backend/src/common/auth/permissions.ts`).
Guards check for a **permission**, not a role, so bundles can be
re-assigned without touching controllers.

Guard order is deliberate:

```
GatewayGuard → ThrottlerGuard → JwtAuthGuard → PermissionsGuard
```

Every route is authenticated unless explicitly marked `@Public()` —
the failure mode is "locked", not "open".

### The frontend is not a security boundary

The sidebar hides items the user lacks permission for, and `RequirePermission`
hides routes. **Both are usability features.** Every endpoint behind
them re-checks the same permission, so bypassing the UI achieves
nothing.

**Verified:** a candidate calling `/admin/users`, `/candidates` or
`/dashboard/summary` directly receives `403`.

### Object-level access (IDOR)

Permissions alone are insufficient: a candidate holds
`application.read.own`, which must not become "read any application".

Two complementary techniques:

1. **Query-level scoping.** `ApplicationsService.scopedWhere()` pins
   `where.candidateId = user.candidateId` for candidates, so a widened
   result set is impossible regardless of the id supplied.
2. **Record-level assertion.** `assertCanView()` compares ownership
   against the verified token on single-record reads, and writes an
   `UNAUTHORIZED_ACCESS` audit row before throwing.

**Verified:**
- `candidate B cannot read candidate A's application` → 403
- `candidate B cannot read candidate A's profile` → 403
- `candidate cannot move their own application to HIRED` → 403

### Header spoofing

The backend derives identity **only** from a token it signed. Headers
such as `X-User-Id` or `X-Role` are never read. Kong additionally strips
them inbound (`request-transformer` plugin).

**Verified:** a request carrying `X-Role: SUPER_ADMIN` on a candidate
session still receives `403`.

### Field-level restrictions

Some fields are hidden even from users who may read the record:

- Candidates never see `screeningRemarks`, `rejectionReason`, internal
  application notes, recruiter notes, interview panels or feedback.
- Offer compensation is gated behind `offer.read.any`.
- A candidate cannot see an offer in `DRAFT`/`PENDING_APPROVAL`/`APPROVED`
  — it returns `404`, not `403`, so the existence of an unsent offer is
  not disclosed.
- `AdminService.listUsers` uses an explicit `select` so `passwordHash`,
  `mfaSecret` and recovery codes cannot leak.
- Secret system settings are returned masked as `********`.

**Verified:** `password hash is never returned`.

---

## 5. Input validation

Global `ValidationPipe`:

```ts
whitelist: true,              // strip undeclared properties
forbidNonWhitelisted: true,   // reject requests that contain them
transform: true,
```

This is the primary **mass-assignment** defence. `UpdateJobDto` has no
`status` or `vacanciesFilled` field, so those can only change through
the dedicated workflow endpoints.

**Verified:** posting `{"status":"PUBLISHED","vacanciesFilled":99}` to
`/jobs` returns `400`.

All ids are validated with `ParseUUIDPipe`; `sortBy` is checked against
a per-endpoint allow-list (`safeSort`) so it can never probe arbitrary
columns.

**Verified:** a malformed UUID returns `400`.

---

## 6. File upload and document security

`backend/src/modules/documents/documents.service.ts`

Five layers, in order:

1. **Size** — rejected above `MAX_UPLOAD_BYTES` (10 MB default), with a
   hard cap at the Multer and Kong layers too.
2. **Declared MIME** must be on the allow-list (PDF, DOC, DOCX).
3. **Extension blocklist** — 30+ executable/script extensions, including
   `.svg`, `.html` and `.js`, which are XSS vectors rather than malware.
4. **Magic bytes must match the declared type.** A renamed `.exe` fails
   here even if its extension and MIME header look innocent.
5. **Server-generated storage key** — `{candidateId}/{uuid}.{ext}`.
   The client filename is metadata only and never touches a path.

Files are held in memory until every check passes, so a rejected upload
never lands on disk.

### Path traversal

```ts
const resolved = path.resolve(root, storageKey);
if (resolved !== root && !resolved.startsWith(root + path.sep)) {
  throw new ForbiddenException('Invalid document reference');
}
```

The resolved path is **proved** to sit inside the storage root. Any `..`
or absolute-path trickery is caught before the filesystem is touched.

### Access control

There is **no public URL for any candidate document.** Every read goes
through `GET /api/documents/:id/download`, which:

- verifies ownership or `document.read.any`;
- writes a `document_access_logs` row and an audit entry;
- sends `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff`
  so a crafted file cannot render inline as stored XSS;
- sets `Cache-Control: private, no-store`.

Denied attempts are recorded as `DOCUMENT_ACCESS_DENIED` at `WARN`.

Storage lives on a dedicated Docker volume at `/app/storage`, outside
any web root.

---

## 7. CSRF

Double-submit cookie. The attack being prevented: a third-party site
causes the browser to issue a state-changing request, and the browser
attaches our session cookie automatically.

The defence is that the attacker **cannot read** our CSRF cookie
(same-origin policy), so they cannot echo its value in the required
header. Comparison is constant-time (`safeCompare`).

Scope is deliberately narrow:
- Safe methods (GET/HEAD/OPTIONS) are exempt.
- **Bearer-token callers are exempt** — a bearer token is not sent
  automatically by the browser, so it is not subject to CSRF.
- Session-establishing routes are exempt, since no token exists yet.

---

## 8. Transport and headers

`helmet` sets CSP, `X-Content-Type-Options`, `X-Frame-Options: DENY`,
`Referrer-Policy`, and HSTS (production only, 1 year + preload).
`X-Powered-By` is removed — advertising the stack is free
reconnaissance.

### CORS

Explicit origin allow-list. A wildcard is incompatible with credentialed
requests and would expose every authenticated endpoint to any website.
`validateEnv` **refuses to boot** in production if `CORS_ORIGINS`
contains `*` or is empty.

Kong enforces the same list at the edge; keep the two in step.

### Trust proxy

```ts
app.set('trust proxy', TRUST_PROXY_HOPS); // default 1 (Kong)
```

Setting this to `true` would let any client spoof their IP with an
`X-Forwarded-For` header, poisoning rate limiting, lockouts and the
audit trail. Pinning the hop count means only the real gateway hop is
believed. Kong additionally strips inbound `X-Forwarded-For`.

---

## 9. Audit logging

`audit_logs` is append-only and readable only with `audit.read`
(Super Admin). **HR Admin deliberately does not hold it** — section 4 of
the specification assigns audit logs to Super Admin.

**Verified:** HR Admin receives `403`; Super Admin receives `200` and
56 entries were present after a test run.

### Redaction

`AuditService.redact()` walks metadata recursively and replaces anything
matching a credential-like key (`password`, `token`, `secret`,
`mfaSecret`, `recoveryCodes`, `cookie`, `authorization`, `ssn`, …) with
`[REDACTED]`, then truncates long strings.

Deliberate omissions: offer salary is **not** written to audit metadata,
and the temporary password on user creation is never recorded.

Audit writes never break the business operation they record — failures
are logged and swallowed.

### Correlation

Kong generates `X-Request-Id`; `RequestIdMiddleware` adopts it (after
sanitising it, since it reaches log lines and a response header) and
stores it on audit rows. One request can be traced from gateway log to
application log to audit entry.

---

## 10. Export safety

Both CSV and Excel exports neutralise **formula injection**: a cell
beginning with `=`, `+`, `-`, `@`, tab or CR is prefixed with a single
quote. Without this, a candidate could put `=HYPERLINK(...)` in a name
field and attack whoever opens the export.

Quotes are doubled, values with delimiters are quoted, and a UTF-8 BOM
is emitted so Excel on Windows reads the encoding correctly.
`Content-Disposition` filenames are sanitised to prevent header
injection.

Exports require their own permissions (`job.export`, `candidate.export`,
`application.export`, `report.export`).

---

## 11. Error handling

`AllExceptionsFilter` returns one consistent shape and is the last line
of defence against leaking internals. Stack traces, SQL fragments and
Prisma internals never reach the client; 5xx errors return a generic
message plus a correlation id.

Prisma error codes are mapped deliberately — `P2002` on `activeJobKey`
becomes a readable *"You already have an active application for this
job"* (409) rather than exposing the index name.

---

## 12. Secrets

- Every secret is read from the environment. None is hard-coded.
- `validateEnv` refuses to boot on a missing secret, one under the
  minimum length, one still containing `CHANGE_ME`, or if the access and
  refresh secrets are identical.
- In production it additionally requires `COOKIE_SECURE=true` and a
  non-wildcard `CORS_ORIGINS`.
- `.env` is git-ignored; `.env.example` contains only placeholders.
- **No production administrator is created anywhere.** Sample accounts
  require `SEED_SAMPLE_USERS=true`, are blocked when `NODE_ENV=production`,
  and take their password from `SEED_DEFAULT_PASSWORD`.

---

## 13. Privacy

- Explicit consent is required at candidate registration and recorded
  with a timestamp.
- Candidates can request data deletion; the request is **flagged for HR
  review, not executed immediately**, because active applications and
  retention obligations may apply.
- Retention period is configurable (`privacy.candidate_retention_months`).
- Internal notes, screening remarks and interview feedback are never
  exposed on candidate-facing endpoints.
- Document access is logged per read.

> This project does not claim regulatory compliance. Retention periods
> and lawful bases require review against your own jurisdiction and
> policies.

---

## 14. Verifying the controls

```powershell
cd D:\HR-ATS
powershell -File scripts\dev-api.ps1 -TestMode
bash scripts/smoke-test.sh
```

The suite covers authentication, enumeration resistance, IDOR across two
candidates, header spoofing, stage-transition enforcement, the duplicate
guard, mass-assignment rejection, export permissions, audit access and
session invalidation.

Last run: **60 passed, 0 failed.**

---

## 15. Known limitations

Stated plainly rather than implied otherwise:

- **MFA is not yet forced** for privileged roles that have not enrolled.
  The policy is configured and the login path warns, but a Super Admin
  without MFA can still sign in. Enforcement is pending.
- **Kong rate limiting uses `policy: local`.** With one Kong instance
  this is correct; across multiple instances, switch to the Redis policy
  so counters are shared.
- **TLS is not configured for local development.** Production requires
  HTTPS termination; `COOKIE_SECURE=true` is enforced there.
- **No automated dependency scanning** is wired into CI yet.
- **Backups are documented but not scheduled**, and the restore
  procedure has not been exercised on this machine.

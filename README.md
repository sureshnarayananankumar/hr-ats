# HR ATS — Job Requirement Board & Applicant Tracking System

A production-oriented recruitment platform: job requisitions with
approval workflow, a public careers portal, candidate management,
a 12-stage applicant pipeline, interviews with structured scorecards,
offers, onboarding, reporting and audit logging.

React + TypeScript · NestJS · Prisma · **MySQL 8.4** · Redis · Kong Gateway · Docker

Think of it as a company's own **Naukri-style hiring portal**: HR raises a
vacancy, managers approve it, it goes live on the careers site, candidates
apply, recruiters screen and shortlist, interviews are scheduled and scored,
an offer is approved and sent, and the accepted candidate is onboarded.

---

## End-to-end hiring flow

```
 Job requisition ─► Approval ─► Published on careers portal ─► Candidate applies
   (HR / Recruiter)   (1..n approvers)    (public, SEO slug)        (self-service portal)
                                                                        │
 Onboarding ◄─ Offer accepted ◄─ Offer sent ◄─ Offer approved ◄─ Selected ◄─ Interviews ◄─ Shortlisted ◄─ Screening
 (checklist)    (by candidate)                  (1..n approvers)              (scorecards)
```

---

## Features

### 1. Job requisitions & approval workflow
- Create, edit and **duplicate** job requirements: title, department, location,
  employment type (full-time, part-time, contract, temporary, internship,
  freelance), work mode (onsite / remote / hybrid), priority, openings,
  experience and salary range, required skills with proficiency level, and
  application deadline.
- Lifecycle: **Draft → Pending Approval → Approved → Published**, plus
  On Hold, Closed and Cancelled.
- **Multi-approver sign-off** — submit a requisition to one or more approvers
  in sequence; each approves or rejects with comments (*Job Approvals* page).
- Assign a recruiter to each vacancy; full change history per requisition.
- Daily reminders to approvers sitting on a request for more than 2 days, and
  automatic closing of the application window once the deadline passes.

### 2. Public careers portal (job board)
- `/careers` lists all published jobs with search and filters by department
  and location; each job has its own shareable URL (`/careers/:slug`).
- Candidates **register, verify their e-mail and apply** in a couple of clicks.

### 3. Candidate self-service portal
- `/portal` — candidates manage their **profile, skills and résumé/documents**
  and **track the status of every application** they have made.
- Candidates can view and **accept or decline offers** online, withdraw an
  application, and request deletion of their data.

### 4. Candidate database (talent pool)
- Searchable candidate list with detail page, **tags**, private **notes** and a
  full **activity timeline**.
- **Duplicate detection** by normalised e-mail / phone number.
- Secure document storage: résumé, cover letter, certificates, ID, education
  and experience proofs. Uploads are size-limited, MIME allow-listed and
  **checked by magic bytes** (a renamed `.exe` is rejected), hashed with
  SHA-256, and every download is written to an access log.
- CSV export with protection against spreadsheet formula injection.

### 5. Applications & 12-stage pipeline (screening → shortlisting)
- **Kanban pipeline board** per job with drag-and-drop between stages.
- Stages: Applied → Resume Screening → HR Screening → **Shortlisted** →
  Assessment → Technical Interview → HR Interview → Final Interview →
  Selected → Offer Released → Offer Accepted → Hired
  (outcomes: Rejected, Withdrawn, Offer Declined, On Hold).
- **Bulk stage moves** for many applications at once, screening result (pass / fail / hold),
  rejection reasons, recruiter assignment, follow-up dates and notes.
- Every move is validated on the server and recorded in an immutable
  history (who, when, why, time spent in the previous stage).

### 6. Interviews & scorecards
- Schedule phone, video, onsite, panel, assessment, technical or HR rounds with
  a **panel of interviewers**; reschedule, cancel, mark complete or no-show.
- Calendar view and a **"my pending feedback"** list for interviewers.
- **Structured scorecard**: criteria scored 1–5, overall rating and a
  recommendation (Strong Hire / Hire / Hold / No Hire).
- Automatic reminder to interviewers the day before.

### 7. Offers
- Create offers with salary and joining details; **offer approval workflow**
  with one or more approvers before release.
- Status: Draft → Pending Approval → Approved → **Sent** → Accepted / Declined,
  plus Expired (auto-expired hourly after the deadline) and Withdrawn.
- Salary is deliberately kept out of audit metadata.
- Sending an offer never marks someone as hired — the candidate must accept.

### 8. Onboarding
- An onboarding record is created when an offer is accepted
  (Offer Accepted → Pre-boarding → Joined / Did Not Join).
- One click generates a **default checklist** — signed offer letter, ID and
  education verification, experience letters, background verification,
  employee & payroll setup, laptop provisioning, e-mail / system accounts,
  manager & buddy assignment, day-one orientation — grouped by
  Documentation, HR, IT and Training, each with owner, due date and status.
- Add custom tasks; owners see their work under **My Tasks**.

### 9. Dashboard & reports
- Dashboard: KPIs, applications by month, candidates by stage, vacancies by
  department, source performance, recruiter performance, time-to-hire,
  vacancy fulfilment, recent activity and **pending actions**.
- 12+ reports, each exportable to CSV: job requirements, open vacancies,
  applications by job, candidate pipeline, recruiter performance, source
  performance, interview outcomes, offer outcomes, offer acceptance,
  rejection reasons, time-to-hire, vacancy fulfilment, onboarding completion.

### 10. Notifications
- In-app notification centre with unread count, plus e-mail
  (dev inbox via MailHog).
- Editable **notification templates** and an e-mail delivery log.

### 11. Administration & security
- User management, role assignment, activate / suspend users; departments,
  recruitment sources and system settings.
- **6 roles, 70 permission keys**, enforced server-side on every endpoint.
- Secure auth: e-mail verification, password reset, **TOTP two-factor (MFA)**,
  HTTP-only cookie sessions with refresh tokens, "log out of all devices",
  active-session list, CSRF protection, login rate limiting, Argon2 password
  hashing.
- **Audit log** of every important action and a security summary page.
- Kong API gateway in front of the API; backend, Redis and the Kong admin API
  are never exposed to the host.

### Scheduled jobs (built in)

| Schedule | Job |
|---|---|
| Hourly | Expire offers past their deadline |
| Daily 01:00 | Close applications on jobs past their deadline |
| Daily 03:00 | Prune expired login sessions |
| Daily 07:00 | Remind interviewers of tomorrow's interviews |
| Daily 08:00 | Follow-up reminders to recruiters |
| Daily 09:00 | Remind approvers about pending job approvals |

### Main screens

| Area | Pages |
|---|---|
| Public | Careers list, job detail & apply, register, login, verify e-mail, forgot / reset password |
| Candidate portal | My applications, my profile |
| Recruitment | Dashboard, jobs, new / edit job, job approvals, published jobs, candidates, applications, pipeline board, interviews, offers, onboarding, reports, notifications |
| Admin | Users, settings, audit logs, account |

---

## Two backend implementations

| Folder | Stack | Status |
|---|---|---|
| `backend/` | **NestJS + Prisma** (TypeScript) | Primary API — all modules above, used by Docker Compose |
| `backend-java/` | **Spring Boot 3.3 + Java 21** | Port of the same API on the same MySQL schema: auth, jobs, candidates, applications, interviews, documents and the public careers API |

---

## Quick start

```powershell
cd D:\HR-ATS
Copy-Item .env.example .env
# Replace every CHANGE_ME value in .env before continuing.

docker compose config
docker compose up -d --build
docker compose ps
```

Then apply the database schema and seed reference data:

```powershell
docker compose --profile migrate run --rm migrate
docker compose exec backend npx ts-node prisma/seed.ts
```

Optionally load a realistic demo dataset (58 jobs, 242 candidates,
536 applications, interviews, offers and onboarding):

```powershell
docker compose exec backend npx ts-node prisma/seed-demo.ts
```

Or do all of it with one script:

```powershell
powershell -File scripts\docker-start.ps1 -Build -Migrate -Seed
```

| What | Where |
|---|---|
| Application | http://localhost:5173 |
| Careers portal | http://localhost:5173/careers |
| API (through Kong) | http://localhost:8000/api |
| API health | http://localhost:8000/api/health |
| Swagger (dev only) | http://localhost:8000/api/docs |
| MailHog inbox | http://localhost:8025 |
| MySQL Workbench | `127.0.0.1:3307` |

**Stop the stack without losing data:**

```powershell
docker compose down
```

> `docker compose down -v` deletes the named volumes and every database
> record with them. It is never part of a normal stop, restart or
> upgrade.

---

## Generating secrets

`.env.example` ships with `CHANGE_ME` placeholders, and the API
**refuses to boot** if any remain. Generate real values with:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

You need distinct values for `SESSION_SECRET`, `JWT_ACCESS_SECRET`,
`JWT_REFRESH_SECRET`, `CSRF_SECRET`, `GATEWAY_SHARED_SECRET`, the three
MySQL passwords and `REDIS_PASSWORD`. The access and refresh secrets
must differ — startup validation rejects them if they match.

---

## Development accounts

Sample accounts are created **only** when `SEED_SAMPLE_USERS=true` and
`NODE_ENV` is not `production`. Their password is whatever you set as
`SEED_DEFAULT_PASSWORD` in `.env`.

| Email | Role |
|---|---|
| `superadmin@hr-ats.local` | Super Admin |
| `hr.admin@hr-ats.local` | HR Admin |
| `recruiter@hr-ats.local` | Recruiter |
| `manager@hr-ats.local` | Hiring Manager |
| `interviewer@hr-ats.local` | Interviewer |
| `candidate1@example.com` | Candidate |

**These are for local development only.** No production administrator is
created anywhere in this project, and no password is hard-coded.

---

## Architecture

```
Browser ──► Kong Gateway ──► NestJS API ──► MySQL 8.4
            (:8000)          (internal)     (:3307 → Workbench)
                                 │
                                 ├──► Redis    (queues, internal)
                                 └──► MailHog  (dev SMTP)
```

The backend, Redis and the Kong Admin API are **not published to the
host**. Kong is the only way into the API — verified by
`scripts/kong-test.sh`.

### Layout

```
D:\HR-ATS
├── backend/          NestJS API
│   ├── prisma/       schema.prisma, migrations, seed.ts
│   └── src/
│       ├── common/   config, guards, filters, middleware, utils
│       └── modules/  auth, jobs, candidates, documents, applications,
│                     interviews, offers, onboarding, dashboard,
│                     reports, notifications, admin, public, health
├── frontend/         React + Vite SPA
│   └── src/
│       ├── components/  ui primitives, layout
│       ├── lib/         api client, auth context, types, utils
│       └── pages/       feature pages + careers + candidate portal
├── database/         schema.sql, seed.sql, README.md
├── docker/mysql/     first-boot initialisation
├── kong/             declarative gateway config
├── docs/             API, SECURITY, DOCKER, KONG_SECURITY, …
└── scripts/          PowerShell operations + test suites
```

---

## Roles and permissions

Six roles over **70 permission keys**. Authorization is
permission-based and enforced **server-side on every endpoint**.

| Role | Can |
|---|---|
| Super Admin | Everything, including users, permissions, settings and audit logs |
| HR Admin | Requisitions, approvals, publishing, candidates, interviews, offers, onboarding, reports |
| Recruiter | Assigned vacancies and applications, interviews, notes, pipeline |
| Hiring Manager | Assigned candidates, interview feedback, decisions |
| Interviewer | Assigned interviews and their own feedback |
| Candidate | Only their own profile, applications, documents and offers |

The frontend hides menu items the user lacks permission for. **That is a
usability feature, not a security control** — every endpoint behind it
re-checks the permission independently.

---

## Recruitment pipeline

Twelve stages: Applied → Resume Screening → HR Screening → Shortlisted →
Assessment → Technical Interview → HR Interview → Final Interview →
Selected → Offer Released → Offer Accepted → Hired.

Plus the outcomes Rejected, Withdrawn and Offer Declined.

Transitions are validated **on the server**: stages advance in order (or
skip forward) and may only be stepped back by one. Two rules are
deliberate:

- `HIRED` is reachable only from `OFFER_ACCEPTED`.
- **Sending an offer never marks a candidate as hired.** That requires
  the candidate to accept, and onboarding to be completed.

Every transition writes an immutable history row: previous stage and
status, new stage and status, acting user, timestamp, optional reason,
and the seconds spent in the previous stage.

---

## Common commands

### Docker

```powershell
docker compose up -d --build          # start / rebuild
docker compose ps                     # status
docker compose logs -f backend frontend
docker compose logs -f mysql
docker compose down                   # stop, KEEPING data
docker compose up -d                  # restart
```

### Migrations

```powershell
# Controlled, one-shot deployment step (elevated DDL account)
docker compose --profile migrate run --rm migrate

# Status without changing anything
docker compose exec backend npx prisma migrate status

# Local development (creates a new migration)
cd backend; npm run prisma:migrate
```

### Running without Docker

MySQL, Redis and MailHog still run in containers; the app runs on Windows:

```powershell
docker compose up -d mysql redis mailhog
powershell -File scripts\dev-api.ps1       # backend on :3000
cd frontend; npm run dev                   # SPA on :5173
```

---

## Testing

```powershell
# End-to-end API + security suite (needs a running API)
bash scripts/smoke-test.sh                       # against the app directly
bash scripts/smoke-test.sh http://localhost:8000/api   # through Kong

# Gateway, isolation, CORS, rate limiting, header spoofing
bash scripts/kong-test.sh

# Backend unit tests
cd backend; npm test

# Frontend unit tests
cd frontend; npm test

# Browser end-to-end
cd frontend; npm run e2e
```

The smoke suite deliberately trips the login rate limiter when run in
full, because it signs in as several users and submits bad passwords. To
run it end-to-end against containers, use the documented test override:

```powershell
docker compose -f docker-compose.yml -f docker-compose.test.yml up -d
bash scripts/smoke-test.sh http://localhost:8000/api
docker compose up -d        # restore the secure configuration
```

### Verified results

| Suite | Result |
|---|---|
| `scripts/smoke-test.sh` (direct) | **60 passed, 0 failed** |
| `scripts/smoke-test.sh` (through Kong, containerized) | **60 passed, 0 failed** |
| `scripts/kong-test.sh` | **24 passed, 0 failed** |
| Backend `tsc` + `nest build` | clean |
| Frontend `tsc -b` + `vite build` | clean |

See `docs/BUILD_STATUS.md` for what is verified versus still outstanding.

---

## MySQL Workbench

1. New connection → Host `127.0.0.1`, Port `3307`
2. Username `hr_ats_app` (or `hr_ats_migrate` for schema work)
3. Password from `.env`
4. Default schema `hr_ats_db`

The application account has **no DDL rights by design** — see
`database/README.md`.

---

## Documentation

| Document | Covers |
|---|---|
| `docs/API.md` | REST endpoints, conventions, error shape |
| `docs/SECURITY.md` | Threat model, every control, how to verify it |
| `docs/DOCKER.md` | Compose services, volumes, operations |
| `docs/KONG_SECURITY.md` | Gateway policy, plugins, what needs Enterprise |
| `docs/DEMO_DATA.md` | The demo dataset: what it contains, how to regenerate or remove it |
| `docs/BUILD_STATUS.md` | Verified vs outstanding, issues found and fixed |
| `docs/FEATURE_EXPANSION_PLAN.md` | Enterprise expansion inventory and phases |
| `database/README.md` | Schema, accounts, Workbench, backup/restore |

---

## Troubleshooting

**MySQL restarts in a loop.** Check `docker compose logs mysql`. Note
that `--default-authentication-plugin` was **removed in MySQL 8.4** and
makes the server abort; use `--authentication-policy`.

**Port already in use.** Change `MYSQL_HOST_PORT`, `KONG_PROXY_PORT` or
`FRONTEND_PORT` in `.env`.

**API will not start.** It fails fast on configuration problems and
prints exactly which value is wrong — usually a missing secret, one
under the minimum length, or a leftover `CHANGE_ME`.

**429 Too Many Requests while testing.** That is the rate limiter doing
its job. Wait a minute, or use the test override above.

**Cookies are not being stored.** Use `localhost` consistently. Cookies
are host-only by default, so a session set on `localhost` is not sent to
`127.0.0.1`.

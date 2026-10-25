# HR-ATS Plus — Feature Expansion Plan

Phase 1 deliverable of the enterprise expansion: an honest inventory of
what **already exists and is verified**, what the expansion adds, and the
order of work.

This is an **additive** plan. The existing project at `D:\HR-ATS` is not
recreated, the `hr_ats_db` database is not reset, and no existing table
is dropped.

Last updated: 2026-10-14

---

## 1. Baseline inventory (measured, not assumed)

Taken from the running system on 2026-10-14.

| Dimension | Count | How measured |
|---|---|---|
| Prisma models | 40 | `grep -c '^model ' schema.prisma` |
| Prisma enums | 20 | `grep -c '^enum ' schema.prisma` |
| MySQL tables | 40 (+ `_prisma_migrations`) | `information_schema.TABLES` |
| Foreign keys | 64 | `information_schema.REFERENTIAL_CONSTRAINTS` |
| Indexes | 157 | `information_schema.STATISTICS` |
| REST paths | 113 | live `/api/docs-json` |
| REST operations | 129 | live `/api/docs-json` |
| Controllers | 14 | file count |
| Services | 15 | file count |
| Permission keys | 70 | seeded `permissions` table |
| Roles | 6 | seeded `roles` table |
| Notification templates | 14 | seeded |
| E2E smoke checks | 60 passed / 0 failed | `scripts/smoke-test.sh` |

### Existing backend modules

`auth` · `admin` (users/roles/departments/sources/settings/audit) ·
`jobs` (+approvals) · `candidates` · `documents` · `applications`
(+pipeline/history/notes) · `interviews` (+feedback) · `offers` ·
`onboarding` · `notifications` · `dashboard` · `reports` · `public`
(careers portal) · `health` · `tasks` (cron)

### Existing cross-cutting infrastructure

- Argon2id hashing, JWT in HTTP-only cookies, refresh rotation with
  reuse detection, TOTP MFA + recovery codes
- Global guards: `GatewayGuard` → `ThrottlerGuard` → `JwtAuthGuard` →
  `PermissionsGuard`
- `AllExceptionsFilter` (uniform errors, no internal leakage)
- `CsrfMiddleware` (double-submit), `RequestIdMiddleware` (Kong
  correlation)
- `AuditService` with recursive secret redaction
- Private document storage with magic-byte validation and path-traversal
  guards
- CSV/Excel export with **formula-injection escaping already implemented**
- Configurable rate limits (`throttle.config.ts`)

### What is NOT yet built (base project)

- Frontend application: only `lib/` and `styles/` exist; **no components,
  pages or routes yet**
- Backend unit tests / API integration tests (Jest configured, no specs)
- Playwright E2E
- Kong declarative config
- Frontend + backend Dockerfiles
- `docs/API.md`, `SECURITY.md`, `DOCKER.md`, `KONG_SECURITY.md`

---

## 2. Gap analysis — expansion modules vs. baseline

Legend: **✅ exists** · **🟡 partial, needs extension** · **🔴 new build**

### Module A — Advanced requisition management
| Feature | State | Notes |
|---|---|---|
| Core requisition CRUD + status machine | ✅ | 7 statuses, server-enforced transitions |
| Approval chain | 🟡 | Multi-approver exists; **configurable rules by dept/level/budget are new** |
| Version history | ✅ | `job_requirement_history`, field-level |
| Cloning | ✅ | `/jobs/:id/duplicate` |
| Templates, cost centre, budget, headcount | 🔴 | New models |
| Multiple locations / managers / recruiters | 🔴 | Currently single-valued |
| Internal-only / campus / confidential flags | 🔴 | New fields |
| Screening questions | 🔴 | New models |

### Module B — Candidate CRM
| Feature | State |
|---|---|
| 360 profile, skills, documents, applications | ✅ |
| Tags, recruiter notes, activity log | ✅ |
| Duplicate detection (advisory) | ✅ |
| Talent pools, saved searches, communities | 🔴 |
| Employment/education as structured rows | 🟡 (JSON today) |
| Communication history | 🔴 |

### Module C — Automation
| Feature | State |
|---|---|
| Cron reminders (follow-up, interview, approval) | ✅ `tasks.service.ts` |
| Configurable workflow engine (triggers/actions) | 🔴 |
| SLA config + business calendars + escalation | 🟡 (fixed per-stage SLA today) |
| Task management | 🟡 (onboarding tasks only) |

### Module D — Application tracking
| Feature | State |
|---|---|
| 12-stage pipeline, history, bulk transitions | ✅ |
| Duplicate-application guard | ✅ unique index |
| Withdrawal / rejection reasons | ✅ |
| **Configurable** pipelines per dept/job family | 🔴 |

### Module E — AI assistance
All 🔴 — must be **provider-abstracted, disabled by default**, results
labelled as suggestions, with a non-AI fallback.

### Module F — Interview intelligence
| Feature | State |
|---|---|
| Scheduling, conflicts, panels, feedback, calendar | ✅ |
| Feedback privacy enforcement | ✅ |
| Panel/round templates, availability, locking | 🔴 |

### Module G — Offers
| Feature | State |
|---|---|
| Full lifecycle + approvals + history | ✅ |
| "Sent ≠ hired" rule | ✅ enforced |
| Templates, negotiation history, doc versioning | 🔴 |
| Pre-employment checks | 🔴 |

### Module H — Onboarding
| Feature | State |
|---|---|
| Records, default checklist, Joined/Did-Not-Join | ✅ |
| Configurable templates by dept/designation | 🔴 |
| New-hire portal | 🔴 |

### Modules I–S
Referrals 🔴 · Campaigns 🔴 · Career-site enhancements 🟡 ·
Communication centre 🟡 (templates + logs exist) · Report builder 🔴 ·
Scheduled reports 🔴 · Org master data 🟡 (departments only) ·
Webhooks 🔴 · Retention engine 🟡 (consent + deletion request exist) ·
Diagnostics page 🔴 · Accessibility 🟡 (tokens + focus styles done)

---

## 3. Guard-rails adopted for this expansion

These are explicit commitments, carried into every phase:

1. **No destructive migrations.** Additive columns/tables only; new
   columns are nullable or defaulted so existing rows stay valid.
2. **No arbitrary code/SQL from configuration.** The workflow engine
   executes a fixed, allow-listed set of action types; the report
   builder composes Prisma queries from an allow-list, never raw SQL.
3. **AI is optional and advisory.** Disabled until a provider is
   configured; scores are explainable, never auto-reject, and resume
   text is treated as untrusted input that cannot issue instructions.
4. **No protected characteristics in matching.** Scoring inputs are
   restricted to job-related criteria.
5. **Webhooks cannot reach internal networks.** Destination IPs are
   resolved and checked against private/loopback/link-local ranges
   before every request, including after redirects.
6. **Exports stay permission-checked and escaped.** Formula-injection
   escaping already exists and is reused for every new export.
7. **Retention never deletes silently.** Preview + approval required;
   legal-hold blocks deletion.
8. **Audit records are append-only** and readable only with `audit.read`
   (Super Admin).

---

## 4. Phase order and status

| Phase | Scope | Status |
|---|---|---|
| 1 | Inventory + plan (this document) | **Done** |
| 2 | Expansion schema + security foundation | Pending |
| 3 | Candidate CRM, talent pools, advanced search | Pending |
| 4 | Requisition management + configurable approvals | Pending |
| 5 | Configurable pipelines + workflow automation | Pending |
| 6 | Interview templates, scorecards, availability | Pending |
| 7 | Offer templates + pre-employment + onboarding templates | Pending |
| 8 | Referrals, campaigns, communication centre | Pending |
| 9 | Analytics, report builder, scheduled reports | Pending |
| 10 | Optional AI module (provider abstraction) | Pending |
| 11 | Privacy, retention, integrations, org admin | Pending |
| 12 | Kong hardening, performance, reliability, a11y | Pending |
| 13 | Regression tests, Docker validation, docs, acceptance | Pending |

**Prerequisite before Phase 2:** finish the base frontend (phase 10 of
the original build). The expansion's UI work extends that application,
so it has to exist first.

---

## 5. Honest statement of scope

This expansion is substantially larger than the original build — on the
order of 20+ new models and 100+ new endpoints across 19 modules. It
will be delivered in the numbered phases above, each one a working,
tested increment with this document updated to match.

Nothing is reported as complete here unless a command was run and its
output checked. Items still pending are listed as pending.

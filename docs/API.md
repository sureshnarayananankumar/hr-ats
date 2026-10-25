# HR-ATS — REST API Reference

Base URL (through Kong): `http://localhost:8000/api`

The endpoint tables below are **generated from the running API's OpenAPI
document** (`node scripts/gen-api-docs.js`), so they cannot drift from
the real routes. The interactive explorer is at `/api/docs` in
development.

---

## Conventions

### Authentication

Session credentials are **HTTP-only cookies** set by the server. No
token is readable by JavaScript, so an XSS flaw cannot steal a session.

| Cookie | Purpose |
|---|---|
| `hr_ats_access` | Short-lived access token (15 min default) |
| `hr_ats_refresh` | Rotating refresh token, scoped to `/api/auth` |
| `hr_ats_csrf` | CSRF token — readable by JS by design |

A `Bearer` token is also accepted for non-browser clients.

### CSRF

Cookie-authenticated **state-changing** requests must send the CSRF
token in an `X-CSRF-Token` header:

```http
GET /api/auth/csrf          → sets the hr_ats_csrf cookie
POST /api/jobs
X-CSRF-Token: <cookie value>
```

Bearer-token clients are exempt: a bearer token is not sent
automatically by the browser, so it is not subject to CSRF.

### Pagination

List endpoints accept `page`, `pageSize` (max 100), `search`,
`sortBy` and `sortDir`, and return:

```json
{
  "data": [ ... ],
  "meta": {
    "page": 1, "pageSize": 20, "totalItems": 137,
    "totalPages": 7, "hasNextPage": true, "hasPreviousPage": false
  }
}
```

`sortBy` is validated against a per-endpoint allow-list, so it can
never be used to probe arbitrary columns.

### Filtering

Array filters accept comma-separated values:

```
GET /api/applications?stage=APPLIED,SHORTLISTED&status=ACTIVE
```

### Errors

Every error uses one shape:

```json
{
  "statusCode": 403,
  "error": "Forbidden",
  "message": "Missing permission: job.approve",
  "requestId": "fde83c7b-a74c-4ec8-a583-3d39ed6b8de3",
  "timestamp": "2026-10-14T13:45:12.004Z",
  "path": "/api/jobs/abc/approval"
}
```

`message` is an array when validation fails. `requestId` correlates
with the gateway log and the audit trail. Stack traces and database
internals are never returned.

| Status | Meaning |
|---|---|
| `400` | Validation failed, or an invalid state transition |
| `401` | Not authenticated, or the session expired |
| `403` | Authenticated but lacking permission, or not your record |
| `404` | Not found — also used to avoid disclosing existence |
| `409` | Conflict, e.g. a duplicate active application |
| `413` | Request body too large |
| `429` | Rate limit exceeded |

### Exports

Export endpoints accept `?format=csv` or `?format=xlsx`. Cells
beginning with `=`, `+`, `-` or `@` are escaped to prevent
spreadsheet formula injection. Each export requires its own permission.

---

## Authorization model

70 permission keys across 6 roles, enforced **server-side on every
endpoint**. The frontend hides what you cannot use; the API independently
rejects it.

Key patterns:

- `*.read.any` — across all records (HR, recruiters)
- `*.read.own` — only your own records (candidates)
- `*.read.assigned` — records you are attached to (recruiter, hiring manager)

Object-level checks apply on top of permissions: holding
`application.read.own` does not let a candidate read another
candidate's application, because the query is pinned to their own
candidate id.

---

## Rate limits

Enforced at Kong **and** in the application.

| Endpoint group | Limit |
|---|---|
| `/api/auth/login`, `/api/auth/mfa/verify` | 5/min per IP |
| register, forgot/reset password | 3/min per IP |
| `/api/documents` | 30/min per IP |
| `/api/public/*` | 120/min per IP |
| everything else | 300/min per IP |

Exceeding a limit returns `429` with a `Retry-After` header.

---

## Recruitment stage transitions

`PATCH /api/applications/:id/transition` validates every move:

- Stages advance in order, or skip forward (Assessment is often skipped).
- A stage may be stepped back by **one** position, to correct mistakes.
- `HIRED` is reachable **only** from `OFFER_ACCEPTED`.
- `OFFER_ACCEPTED` is driven by the candidate's response on the offer,
  not by a manual move.

Invalid moves return `400` with an explanation. Every accepted move
writes an immutable history row.

---

## Endpoints

> 129 operations across 14 tags. Generated 2026-10-14.

### Administration

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/admin/audit-logs` | Search the audit trail |
| `GET` | `/api/admin/departments` | List departments |
| `POST` | `/api/admin/departments` | Create a department |
| `PATCH` | `/api/admin/departments/{id}` | Update a department |
| `GET` | `/api/admin/permissions` | The full permission catalogue |
| `GET` | `/api/admin/roles` | Roles with their permission bundles |
| `GET` | `/api/admin/security-summary` | Security event counts for the last N days |
| `GET` | `/api/admin/settings` | System settings (secret values are masked) |
| `PATCH` | `/api/admin/settings/{key}` | Update a system setting |
| `GET` | `/api/admin/sources` | List recruitment sources |
| `POST` | `/api/admin/sources` | Create a recruitment source |
| `GET` | `/api/admin/users` | List users |
| `POST` | `/api/admin/users` | Create a staff user account |
| `PATCH` | `/api/admin/users/{id}/roles` | Replace a user roles (revokes their sessions) |
| `PATCH` | `/api/admin/users/{id}/status` | Activate, suspend or deactivate a user |
| `GET` | `/api/admin/users/assignable` | Active users for assignment dropdowns |

### Applications

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/applications` | Apply for a published job |
| `GET` | `/api/applications` | List applications visible to you |
| `GET` | `/api/applications/{id}` | Get one application |
| `PATCH` | `/api/applications/{id}/assign` | Assign a recruiter to an application |
| `GET` | `/api/applications/{id}/history` | Full stage and status change history |
| `GET` | `/api/applications/{id}/notes` | Notes on an application (internal notes hidden from candidates) |
| `POST` | `/api/applications/{id}/notes` | Add a note to an application |
| `PATCH` | `/api/applications/{id}/transition` | Move an application to another stage or status |
| `PATCH` | `/api/applications/{id}/withdraw` | Withdraw your own application |
| `POST` | `/api/applications/bulk/transition` | Transition many applications; returns a per-id result |
| `GET` | `/api/applications/export` | Export applications as CSV or Excel |
| `GET` | `/api/applications/pipeline/{jobId}` | Kanban pipeline for one job requirement |

### Authentication

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/change-password` | Change your own password |
| `GET` | `/api/auth/csrf` | Issue a CSRF token for the double-submit cookie pattern |
| `POST` | `/api/auth/forgot-password` | Request a password-reset email |
| `POST` | `/api/auth/login` | Sign in with email and password |
| `POST` | `/api/auth/logout` | Revoke the current session and clear cookies |
| `POST` | `/api/auth/logout-all` | Revoke every session for the current user |
| `GET` | `/api/auth/me` | Current user profile, roles and permissions |
| `POST` | `/api/auth/mfa/confirm` | Confirm MFA enrolment; returns one-time recovery codes |
| `POST` | `/api/auth/mfa/setup` | Begin MFA enrolment; returns a TOTP secret and otpauth URI |
| `POST` | `/api/auth/mfa/verify` | Complete the MFA challenge and receive a full session |
| `POST` | `/api/auth/refresh` | Rotate the refresh token and issue a new access token |
| `POST` | `/api/auth/register` | Register a candidate account (public careers portal) |
| `POST` | `/api/auth/reset-password` | Set a new password using an emailed reset token |
| `GET` | `/api/auth/sessions` | List the current user active sessions |
| `POST` | `/api/auth/verify-email` | Confirm an email address using the emailed token |

### Candidates

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/candidates` | Search the candidate directory |
| `GET` | `/api/candidates/{id}` | Get a candidate profile (own, or with candidate.read.any) |
| `PATCH` | `/api/candidates/{id}` | Update a candidate profile |
| `GET` | `/api/candidates/{id}/activity` | Candidate activity history |
| `GET` | `/api/candidates/{id}/duplicates` | Possible duplicate profiles (advisory only) |
| `GET` | `/api/candidates/{id}/notes` | Internal recruiter notes (never visible to the candidate) |
| `POST` | `/api/candidates/{id}/notes` | Add an internal note |
| `POST` | `/api/candidates/{id}/tags` | Tag a candidate |
| `DELETE` | `/api/candidates/{id}/tags/{tagId}` | Remove a tag from a candidate |
| `GET` | `/api/candidates/export` | Export candidates as CSV or Excel |
| `GET` | `/api/candidates/me` | Your own candidate profile |
| `PATCH` | `/api/candidates/me` | Update your own candidate profile |
| `POST` | `/api/candidates/me/request-deletion` | Request deletion of your personal data |
| `GET` | `/api/candidates/tags` | All candidate tags |

### Dashboard

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/dashboard/applications-by-month` | Applications and hires per month |
| `GET` | `/api/dashboard/candidates-by-stage` | Active candidates per recruitment stage |
| `GET` | `/api/dashboard/pending-actions` | Items awaiting your action |
| `GET` | `/api/dashboard/recent-activity` | Recent activity feed |
| `GET` | `/api/dashboard/recruiter-performance` | Per-recruiter workload and hire rate |
| `GET` | `/api/dashboard/source-performance` | Applications and hires per recruitment source |
| `GET` | `/api/dashboard/summary` | Headline counters (all live database counts) |
| `GET` | `/api/dashboard/time-metrics` | Time-to-hire and time-to-fill, with stated definitions |
| `GET` | `/api/dashboard/vacancies-by-department` | Open vacancies grouped by department |
| `GET` | `/api/dashboard/vacancy-fulfilment` | Fulfilment rate per job requirement |

### Documents

| Method | Path | Description |
|---|---|---|
| `DELETE` | `/api/documents/{id}` | Delete a document you own |
| `GET` | `/api/documents/{id}/access-log` | Who has accessed this document |
| `GET` | `/api/documents/{id}/download` | Download a document |
| `GET` | `/api/documents/candidate/{candidateId}` | List a candidate documents (own, or with document.read.any) |
| `POST` | `/api/documents/upload` | Upload a document for your own candidate profile |

### Health

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Liveness probe |
| `GET` | `/api/health/ready` | Readiness probe (verifies the database round-trips) |

### Interviews

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/interviews` | List interviews visible to you |
| `POST` | `/api/interviews` | Schedule an interview (returns any panel conflicts) |
| `GET` | `/api/interviews/{id}` | Get one interview |
| `PATCH` | `/api/interviews/{id}/cancel` | Cancel an interview |
| `PATCH` | `/api/interviews/{id}/complete` | Mark an interview as completed |
| `GET` | `/api/interviews/{id}/feedback` | Interview feedback |
| `POST` | `/api/interviews/{id}/feedback` | Submit or update your interview feedback |
| `PATCH` | `/api/interviews/{id}/reschedule` | Reschedule an interview |
| `GET` | `/api/interviews/calendar` | Calendar events for a date range |
| `GET` | `/api/interviews/my-pending-feedback` | Your completed interviews still awaiting feedback |

### Job Requirements

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/jobs` | List job requirements (scoped to what you may see) |
| `POST` | `/api/jobs` | Create a job requirement (saved as DRAFT) |
| `GET` | `/api/jobs/{id}` | Get one job requirement |
| `PATCH` | `/api/jobs/{id}` | Update a job requirement |
| `POST` | `/api/jobs/{id}/approval` | Approve or reject a job requirement |
| `POST` | `/api/jobs/{id}/duplicate` | Duplicate a requirement as a new draft |
| `GET` | `/api/jobs/{id}/history` | Full field-level change history |
| `PATCH` | `/api/jobs/{id}/recruiter` | Assign a recruiter to the requirement |
| `PATCH` | `/api/jobs/{id}/status` | Change job status (publish, hold, close, reopen, cancel) |
| `POST` | `/api/jobs/{id}/submit` | Submit a draft for approval |
| `GET` | `/api/jobs/export` | Export job requirements as CSV or Excel |
| `GET` | `/api/jobs/pending-approvals` | Job requirements awaiting your approval |

### Notifications

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/notifications` | Your in-app notifications |
| `PATCH` | `/api/notifications/{id}/read` | Mark one notification as read |
| `GET` | `/api/notifications/email-logs` | Email delivery log |
| `PATCH` | `/api/notifications/read-all` | Mark all your notifications as read |
| `GET` | `/api/notifications/templates` | Email / notification templates |
| `PATCH` | `/api/notifications/templates/{id}` | Edit a notification template |
| `GET` | `/api/notifications/unread-count` | Unread notification count (for the bell badge) |

### Offers

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/offers` | List offers |
| `POST` | `/api/offers` | Create an offer (saved as DRAFT) |
| `GET` | `/api/offers/{id}` | Get one offer |
| `PATCH` | `/api/offers/{id}` | Update offer terms (draft or pending approval only) |
| `POST` | `/api/offers/{id}/approval` | Approve or reject an offer |
| `POST` | `/api/offers/{id}/respond` | Accept or decline your own offer |
| `POST` | `/api/offers/{id}/send` | Send an approved offer to the candidate |
| `POST` | `/api/offers/{id}/submit` | Submit an offer for approval |
| `PATCH` | `/api/offers/{id}/withdraw` | Withdraw an offer |

### Onboarding

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/onboarding` | List onboarding records |
| `GET` | `/api/onboarding/{id}` | Get one onboarding record with its checklist |
| `PATCH` | `/api/onboarding/{id}` | Update an onboarding record |
| `POST` | `/api/onboarding/{id}/initialise-tasks` | Seed the default onboarding checklist |
| `POST` | `/api/onboarding/{id}/tasks` | Add an onboarding task |
| `GET` | `/api/onboarding/my-tasks` | Onboarding tasks assigned to you |
| `PATCH` | `/api/onboarding/tasks/{taskId}` | Update an onboarding task |
| `DELETE` | `/api/onboarding/tasks/{taskId}` | Remove an onboarding task |

### Public Careers Portal

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/public/departments` | Departments that currently have published openings |
| `GET` | `/api/public/jobs` | Browse published job openings |
| `GET` | `/api/public/jobs/{slug}` | Job detail page by its public slug |
| `GET` | `/api/public/locations` | Locations that currently have published openings |
| `GET` | `/api/public/sources` | Recruitment sources offered on the application form |

### Reports

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/reports` | List available reports and their metric definitions |
| `GET` | `/api/reports/{key}` | Run a report (JSON) |
| `GET` | `/api/reports/{key}/export` | Export a report as CSV or Excel |
| `GET` | `/api/reports/offer-acceptance-summary` | Offer acceptance rate with its stated denominator |

---

## Metric definitions

Reports return their own definition so a number is never read out of
context.

| Metric | Definition |
|---|---|
| Time to hire | Days from the candidate applying to `HIRED` being recorded |
| Time to fill | Days from the job being **published** to a hire against it |
| Offer acceptance rate | accepted / (sent + accepted + declined + expired). Withdrawn offers are excluded |
| Open positions | Sum of `vacancies - vacanciesFilled` on PUBLISHED and APPROVED jobs |
| New applications | Applications received in the last 7 days |
| Conversion rate (source) | hires / applications from that source |
| Fulfilment rate | `vacanciesFilled / vacancies` per requirement |

Where there is no data, endpoints return `null` and a `sampleSize`
rather than a misleading zero.

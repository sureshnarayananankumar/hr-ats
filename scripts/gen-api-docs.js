/**
 * Generates docs/API.md from the running API's OpenAPI document.
 *
 * Generated rather than hand-written so the endpoint tables can never
 * drift from the actual routes.
 *
 *   docker compose up -d
 *   node scripts/gen-api-docs.js            # reads http://localhost:8000/api/docs-json
 *   node scripts/gen-api-docs.js <url>
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const url = process.argv[2] ?? 'http://localhost:8000/api/docs-json';

const PREAMBLE = `# HR-ATS — REST API Reference

Base URL (through Kong): \`http://localhost:8000/api\`

The endpoint tables below are **generated from the running API's OpenAPI
document** (\`node scripts/gen-api-docs.js\`), so they cannot drift from
the real routes. The interactive explorer is at \`/api/docs\` in
development.

---

## Conventions

### Authentication

Session credentials are **HTTP-only cookies** set by the server. No
token is readable by JavaScript, so an XSS flaw cannot steal a session.

| Cookie | Purpose |
|---|---|
| \`hr_ats_access\` | Short-lived access token (15 min default) |
| \`hr_ats_refresh\` | Rotating refresh token, scoped to \`/api/auth\` |
| \`hr_ats_csrf\` | CSRF token — readable by JS by design |

A \`Bearer\` token is also accepted for non-browser clients.

### CSRF

Cookie-authenticated **state-changing** requests must send the CSRF
token in an \`X-CSRF-Token\` header:

\`\`\`http
GET /api/auth/csrf          → sets the hr_ats_csrf cookie
POST /api/jobs
X-CSRF-Token: <cookie value>
\`\`\`

Bearer-token clients are exempt: a bearer token is not sent
automatically by the browser, so it is not subject to CSRF.

### Pagination

List endpoints accept \`page\`, \`pageSize\` (max 100), \`search\`,
\`sortBy\` and \`sortDir\`, and return:

\`\`\`json
{
  "data": [ ... ],
  "meta": {
    "page": 1, "pageSize": 20, "totalItems": 137,
    "totalPages": 7, "hasNextPage": true, "hasPreviousPage": false
  }
}
\`\`\`

\`sortBy\` is validated against a per-endpoint allow-list, so it can
never be used to probe arbitrary columns.

### Filtering

Array filters accept comma-separated values:

\`\`\`
GET /api/applications?stage=APPLIED,SHORTLISTED&status=ACTIVE
\`\`\`

### Errors

Every error uses one shape:

\`\`\`json
{
  "statusCode": 403,
  "error": "Forbidden",
  "message": "Missing permission: job.approve",
  "requestId": "fde83c7b-a74c-4ec8-a583-3d39ed6b8de3",
  "timestamp": "2026-10-14T13:45:12.004Z",
  "path": "/api/jobs/abc/approval"
}
\`\`\`

\`message\` is an array when validation fails. \`requestId\` correlates
with the gateway log and the audit trail. Stack traces and database
internals are never returned.

| Status | Meaning |
|---|---|
| \`400\` | Validation failed, or an invalid state transition |
| \`401\` | Not authenticated, or the session expired |
| \`403\` | Authenticated but lacking permission, or not your record |
| \`404\` | Not found — also used to avoid disclosing existence |
| \`409\` | Conflict, e.g. a duplicate active application |
| \`413\` | Request body too large |
| \`429\` | Rate limit exceeded |

### Exports

Export endpoints accept \`?format=csv\` or \`?format=xlsx\`. Cells
beginning with \`=\`, \`+\`, \`-\` or \`@\` are escaped to prevent
spreadsheet formula injection. Each export requires its own permission.

---

## Authorization model

70 permission keys across 6 roles, enforced **server-side on every
endpoint**. The frontend hides what you cannot use; the API independently
rejects it.

Key patterns:

- \`*.read.any\` — across all records (HR, recruiters)
- \`*.read.own\` — only your own records (candidates)
- \`*.read.assigned\` — records you are attached to (recruiter, hiring manager)

Object-level checks apply on top of permissions: holding
\`application.read.own\` does not let a candidate read another
candidate's application, because the query is pinned to their own
candidate id.

---

## Rate limits

Enforced at Kong **and** in the application.

| Endpoint group | Limit |
|---|---|
| \`/api/auth/login\`, \`/api/auth/mfa/verify\` | 5/min per IP |
| register, forgot/reset password | 3/min per IP |
| \`/api/documents\` | 30/min per IP |
| \`/api/public/*\` | 120/min per IP |
| everything else | 300/min per IP |

Exceeding a limit returns \`429\` with a \`Retry-After\` header.

---

## Recruitment stage transitions

\`PATCH /api/applications/:id/transition\` validates every move:

- Stages advance in order, or skip forward (Assessment is often skipped).
- A stage may be stepped back by **one** position, to correct mistakes.
- \`HIRED\` is reachable **only** from \`OFFER_ACCEPTED\`.
- \`OFFER_ACCEPTED\` is driven by the candidate's response on the offer,
  not by a manual move.

Invalid moves return \`400\` with an explanation. Every accepted move
writes an immutable history row.

---

## Endpoints
`;

const FOOTER = `
---

## Metric definitions

Reports return their own definition so a number is never read out of
context.

| Metric | Definition |
|---|---|
| Time to hire | Days from the candidate applying to \`HIRED\` being recorded |
| Time to fill | Days from the job being **published** to a hire against it |
| Offer acceptance rate | accepted / (sent + accepted + declined + expired). Withdrawn offers are excluded |
| Open positions | Sum of \`vacancies - vacanciesFilled\` on PUBLISHED and APPROVED jobs |
| New applications | Applications received in the last 7 days |
| Conversion rate (source) | hires / applications from that source |
| Fulfilment rate | \`vacanciesFilled / vacancies\` per requirement |

Where there is no data, endpoints return \`null\` and a \`sampleSize\`
rather than a misleading zero.
`;

async function main() {
  const response = await fetch(url);
  if (!response.ok) {
    console.error(`Could not fetch ${url} (HTTP ${response.status}).`);
    console.error('Is the stack running, and is NODE_ENV not "production"?');
    process.exit(1);
  }

  const spec = await response.json();
  const byTag = {};

  for (const [routePath, operations] of Object.entries(spec.paths ?? {})) {
    for (const [method, operation] of Object.entries(operations)) {
      const tag = operation.tags?.[0] ?? 'Other';
      (byTag[tag] ??= []).push({
        method: method.toUpperCase(),
        path: routePath,
        summary: (operation.summary ?? '').replace(/\|/g, '-'),
      });
    }
  }

  let tables = '';
  let total = 0;

  for (const tag of Object.keys(byTag).sort()) {
    tables += `\n### ${tag}\n\n| Method | Path | Description |\n|---|---|---|\n`;
    for (const row of byTag[tag].sort((a, b) => a.path.localeCompare(b.path))) {
      tables += `| \`${row.method}\` | \`${row.path}\` | ${row.summary} |\n`;
      total += 1;
    }
  }

  const generated =
    `\n> ${total} operations across ${Object.keys(byTag).length} tags. ` +
    `Generated ${new Date().toISOString().slice(0, 10)}.\n`;

  fs.writeFileSync(
    path.join(root, 'docs', 'API.md'),
    PREAMBLE + generated + tables + FOOTER,
  );

  console.log(`Wrote docs/API.md — ${total} operations, ${Object.keys(byTag).length} tags`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

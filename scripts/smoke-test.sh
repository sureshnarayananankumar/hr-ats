#!/usr/bin/env bash
# =====================================================================
#  HR-ATS end-to-end smoke test
#
#  Exercises the full recruitment workflow plus the security controls
#  against a RUNNING API. Every assertion checks a real HTTP response.
#
#  Usage:  bash scripts/smoke-test.sh [base-url]
#  Default base-url: http://127.0.0.1:3000/api
# =====================================================================
set -uo pipefail

BASE="${1:-http://127.0.0.1:3000/api}"
JAR_DIR="$(mktemp -d)"
PASS=0
FAIL=0
FAILED_NAMES=()

cleanup() { rm -rf "$JAR_DIR"; }
trap cleanup EXIT

pass() { PASS=$((PASS+1)); printf '  \033[32mPASS\033[0m  %s\n' "$1"; }
fail() { FAIL=$((FAIL+1)); FAILED_NAMES+=("$1"); printf '  \033[31mFAIL\033[0m  %s\n     expected: %s\n     actual:   %s\n' "$1" "$2" "$3"; }

check() { # name expected actual
  if [ "$2" = "$3" ]; then pass "$1"; else fail "$1" "$2" "$3"; fi
}

section() { printf '\n\033[1m%s\033[0m\n' "$1"; }

# --- helpers --------------------------------------------------------
# login <jar> <email> <password>  -> prints HTTP status
login() {
  curl -s -o "$JAR_DIR/login.json" -w '%{http_code}' \
    -c "$1" -b "$1" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$2\",\"password\":\"$3\"}" \
    "$BASE/auth/login"
}

# api <jar> <method> <path> [json]  -> prints body; status via code()
#
# The status is written to a FILE rather than a shell variable: callers
# use `BODY=$(api ...)`, which runs api in a subshell, so any variable
# it set would be discarded the moment the substitution ends.
CODE_FILE="$JAR_DIR/last_code"
api() {
  local jar="$1" method="$2" path="$3" body="${4:-}"
  local csrf
  csrf=$(grep -i 'hr_ats_csrf' "$jar" 2>/dev/null | awk '{print $7}' | tail -1)
  local out
  if [ -n "$body" ]; then
    out=$(curl -s -w '\n%{http_code}' -X "$method" -c "$jar" -b "$jar" \
      -H 'Content-Type: application/json' -H "X-CSRF-Token: ${csrf:-}" \
      -d "$body" "$BASE$path")
  else
    out=$(curl -s -w '\n%{http_code}' -X "$method" -c "$jar" -b "$jar" \
      -H "X-CSRF-Token: ${csrf:-}" "$BASE$path")
  fi
  printf '%s' "$out" | tail -n1 > "$CODE_FILE"
  printf '%s' "$out" | sed '$d'
}

# Status code of the most recent api() call.
code() { cat "$CODE_FILE" 2>/dev/null; }

jqv() { node -e "try{const d=JSON.parse(require('fs').readFileSync(0,'utf8'));const v=$2;console.log(v===undefined?'':v)}catch(e){console.log('')}" <<< "$1"; }

PW="${SEED_DEFAULT_PASSWORD:-}"
if [ -z "$PW" ]; then
  echo "SEED_DEFAULT_PASSWORD is not set. Export it or source your .env first." >&2
  exit 2
fi

printf '\033[1mHR-ATS smoke test\033[0m  ->  %s\n' "$BASE"

# =====================================================================
section '1. Health'
# =====================================================================
CODE=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/health")
check "health endpoint returns 200" "200" "$CODE"

READY=$(curl -s "$BASE/health/ready")
check "readiness reports database connected" "connected" "$(jqv "$READY" 'd.database')"

# =====================================================================
section '2. Authentication'
# =====================================================================
HR_JAR="$JAR_DIR/hr.txt"; : > "$HR_JAR"
CODE=$(login "$HR_JAR" "hr.admin@hr-ats.local" "$PW")
check "HR admin can sign in" "200" "$CODE"

CODE=$(curl -s -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' \
  -d "{\"email\":\"hr.admin@hr-ats.local\",\"password\":\"definitely-wrong-password\"}" \
  "$BASE/auth/login")
check "wrong password is rejected" "401" "$CODE"

CODE=$(curl -s -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' \
  -d "{\"email\":\"nobody@nowhere.invalid\",\"password\":\"whatever-123456\"}" \
  "$BASE/auth/login")
check "unknown account returns the same 401 (no enumeration)" "401" "$CODE"

CODE=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/jobs")
check "protected route rejects anonymous access" "401" "$CODE"

# establish CSRF for subsequent writes
curl -s -c "$HR_JAR" -b "$HR_JAR" "$BASE/auth/csrf" > /dev/null

ME=$(api "$HR_JAR" GET /auth/me)
check "authenticated profile is readable" "200" "$(code)"
check "profile reports the HR_ADMIN role" "HR_ADMIN" "$(jqv "$ME" 'd.roles[0]')"
check "password hash is never returned" "" "$(jqv "$ME" 'd.passwordHash')"

# =====================================================================
section '3. Job requirement workflow'
# =====================================================================
DEPTS=$(api "$HR_JAR" GET /admin/departments)
DEPT_ID=$(jqv "$DEPTS" 'd[0].id')
[ -n "$DEPT_ID" ] && pass "departments are seeded" || fail "departments are seeded" "an id" "empty"

JOB=$(api "$HR_JAR" POST /jobs "{
  \"title\":\"Smoke Test Engineer\",
  \"description\":\"Validates the HR ATS end to end.\",
  \"departmentId\":\"$DEPT_ID\",
  \"designation\":\"Senior Engineer\",
  \"employmentType\":\"FULL_TIME\",
  \"workMode\":\"HYBRID\",
  \"location\":\"Muscat, Oman\",
  \"priority\":\"HIGH\",
  \"vacancies\":2,
  \"minExperience\":3,
  \"maxExperience\":8,
  \"salaryMin\":40000,
  \"salaryMax\":60000,
  \"salaryConfidential\":false,
  \"skills\":[{\"name\":\"TypeScript\"},{\"name\":\"NestJS\",\"isRequired\":false}]
}")
check "job requirement created" "201" "$(code)"
JOB_ID=$(jqv "$JOB" 'd.id')
JOB_CODE=$(jqv "$JOB" 'd.requirementCode')
check "new job starts as DRAFT" "DRAFT" "$(jqv "$JOB" 'd.status')"
[ -n "$JOB_CODE" ] && pass "requirement code generated ($JOB_CODE)" || fail "requirement code generated" "JR-..." "empty"

# invalid transition must be refused server-side
api "$HR_JAR" PATCH "/jobs/$JOB_ID/status" '{"status":"PUBLISHED"}' > /dev/null
check "DRAFT cannot jump straight to PUBLISHED" "400" "$(code)"

HR_ID=$(jqv "$ME" 'd.id')
api "$HR_JAR" POST "/jobs/$JOB_ID/submit" "{\"approverIds\":[\"$HR_ID\"]}" > /dev/null
check "job submitted for approval" "201" "$(code)"

APPROVALS=$(api "$HR_JAR" GET /jobs/pending-approvals)
check "approval appears in the approver queue" "200" "$(code)"

api "$HR_JAR" POST "/jobs/$JOB_ID/approval" '{"decision":"APPROVED","comments":"Looks good"}' > /dev/null
check "approval decision recorded" "201" "$(code)"

PUB=$(api "$HR_JAR" PATCH "/jobs/$JOB_ID/status" '{"status":"PUBLISHED"}')
check "approved job can be published" "200" "$(code)"
check "job status is PUBLISHED" "PUBLISHED" "$(jqv "$PUB" 'd.status')"

HIST=$(api "$HR_JAR" GET "/jobs/$JOB_ID/history")
HIST_LEN=$(jqv "$HIST" 'd.length')
[ "${HIST_LEN:-0}" -ge 3 ] && pass "change history recorded ($HIST_LEN entries)" \
  || fail "change history recorded" ">=3 entries" "${HIST_LEN:-0}"

# =====================================================================
section '4. Public careers portal'
# =====================================================================
PUBJOBS=$(curl -s "$BASE/public/jobs?search=Smoke%20Test%20Engineer")
FOUND=$(jqv "$PUBJOBS" 'd.data.length')
[ "${FOUND:-0}" -ge 1 ] && pass "published job is visible on the public portal" \
  || fail "published job is visible on the public portal" ">=1" "${FOUND:-0}"

SLUG=$(jqv "$PUBJOBS" 'd.data[0].slug')
DETAIL=$(curl -s "$BASE/public/jobs/$SLUG")
check "public job detail page loads" "Smoke Test Engineer" "$(jqv "$DETAIL" 'd.title')"
check "public payload omits internal notes" "" "$(jqv "$DETAIL" 'd.internalNotes')"
check "public payload omits recruiter identity" "" "$(jqv "$DETAIL" 'd.recruiterId')"

CODE=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/public/jobs/this-slug-does-not-exist")
check "unknown slug returns 404" "404" "$CODE"

# =====================================================================
section '5. Candidate application'
# =====================================================================
C1_JAR="$JAR_DIR/c1.txt"; : > "$C1_JAR"
CODE=$(login "$C1_JAR" "candidate1@example.com" "$PW")
check "candidate can sign in" "200" "$CODE"
curl -s -c "$C1_JAR" -b "$C1_JAR" "$BASE/auth/csrf" > /dev/null

APP=$(api "$C1_JAR" POST /applications "{\"jobId\":\"$JOB_ID\",\"coverLetter\":\"I would like to apply.\"}")
check "candidate can apply to a published job" "201" "$(code)"
APP_ID=$(jqv "$APP" 'd.id')
APP_CODE=$(jqv "$APP" 'd.applicationCode')
check "application starts at APPLIED" "APPLIED" "$(jqv "$APP" 'd.currentStage')"

# THE duplicate guard -- enforced by a UNIQUE index, not a race-prone read
api "$C1_JAR" POST /applications "{\"jobId\":\"$JOB_ID\"}" > /dev/null
check "duplicate active application is blocked (409)" "409" "$(code)"

# =====================================================================
section '6. Authorization / IDOR'
# =====================================================================
C2_JAR="$JAR_DIR/c2.txt"; : > "$C2_JAR"
login "$C2_JAR" "candidate2@example.com" "$PW" > /dev/null
curl -s -c "$C2_JAR" -b "$C2_JAR" "$BASE/auth/csrf" > /dev/null

api "$C2_JAR" GET "/applications/$APP_ID" > /dev/null
check "candidate B cannot read candidate A's application" "403" "$(code)"

C1_ME=$(api "$C1_JAR" GET /candidates/me)
C1_CAND_ID=$(jqv "$C1_ME" 'd.id')
api "$C2_JAR" GET "/candidates/$C1_CAND_ID" > /dev/null
check "candidate B cannot read candidate A's profile" "403" "$(code)"

api "$C1_JAR" GET /candidates > /dev/null
check "candidate cannot list the candidate directory" "403" "$(code)"

api "$C1_JAR" GET /admin/users > /dev/null
check "candidate cannot reach user administration" "403" "$(code)"

api "$C1_JAR" GET /dashboard/summary > /dev/null
check "candidate cannot read the HR dashboard" "403" "$(code)"

api "$C1_JAR" PATCH "/applications/$APP_ID/transition" '{"toStage":"HIRED"}' > /dev/null
check "candidate cannot move their own application to HIRED" "403" "$(code)"

# header spoofing must not grant privileges
CODE=$(curl -s -o /dev/null -w '%{http_code}' -b "$C1_JAR" \
  -H 'X-User-Id: 00000000-0000-0000-0000-000000000000' \
  -H 'X-Role: SUPER_ADMIN' \
  "$BASE/admin/users")
check "spoofed X-Role header grants nothing" "403" "$CODE"

# =====================================================================
section '7. Pipeline transitions'
# =====================================================================
MOVED=$(api "$HR_JAR" PATCH "/applications/$APP_ID/transition" \
  '{"toStage":"RESUME_SCREENING","screeningResult":"PASS","notifyCandidate":false}')
check "HR can advance the application one stage" "200" "$(code)"
check "stage is now RESUME_SCREENING" "RESUME_SCREENING" "$(jqv "$MOVED" 'd.currentStage')"

api "$HR_JAR" PATCH "/applications/$APP_ID/transition" '{"toStage":"HIRED"}' > /dev/null
check "cannot skip straight to HIRED" "400" "$(code)"

APPHIST=$(api "$HR_JAR" GET "/applications/$APP_ID/history")
AH_LEN=$(jqv "$APPHIST" 'd.length')
[ "${AH_LEN:-0}" -ge 2 ] && pass "application history recorded ($AH_LEN entries)" \
  || fail "application history recorded" ">=2" "${AH_LEN:-0}"

PIPE=$(api "$HR_JAR" GET "/applications/pipeline/$JOB_ID")
check "pipeline board loads" "200" "$(code)"
check "pipeline exposes all 12 stages" "12" "$(jqv "$PIPE" 'd.columns.length')"

# =====================================================================
section '8. Dashboard & reports (live data)'
# =====================================================================
SUM=$(api "$HR_JAR" GET /dashboard/summary)
check "dashboard summary loads" "200" "$(code)"
PUBCOUNT=$(jqv "$SUM" 'd.jobs.published')
[ "${PUBCOUNT:-0}" -ge 1 ] && pass "dashboard counts real published jobs ($PUBCOUNT)" \
  || fail "dashboard counts real published jobs" ">=1" "${PUBCOUNT:-0}"

STAGES=$(api "$HR_JAR" GET /dashboard/candidates-by-stage)
check "candidates-by-stage returns all 12 stages" "12" "$(jqv "$STAGES" 'd.length')"

api "$HR_JAR" GET /dashboard/time-metrics > /dev/null
check "time-to-hire metrics endpoint works" "200" "$(code)"

REPORTS=$(api "$HR_JAR" GET /reports)
RCOUNT=$(jqv "$REPORTS" 'd.length')
[ "${RCOUNT:-0}" -ge 12 ] && pass "report catalogue exposes $RCOUNT reports" \
  || fail "report catalogue" ">=12" "${RCOUNT:-0}"

api "$HR_JAR" GET '/reports/open-vacancies' > /dev/null
check "open-vacancies report runs" "200" "$(code)"

CSV_CODE=$(curl -s -o /dev/null -w '%{http_code}' -b "$HR_JAR" "$BASE/reports/open-vacancies/export?format=csv")
check "report CSV export works" "200" "$CSV_CODE"

XLSX_CODE=$(curl -s -o /dev/null -w '%{http_code}' -b "$HR_JAR" "$BASE/jobs/export?format=xlsx")
check "job Excel export works" "200" "$XLSX_CODE"

# =====================================================================
section '9. Input validation & audit'
# =====================================================================
api "$HR_JAR" POST /jobs '{"title":"Missing everything else"}' > /dev/null
check "incomplete job payload is rejected" "400" "$(code)"

# mass-assignment: unknown properties must be refused outright
api "$HR_JAR" POST /jobs "{\"title\":\"X\",\"description\":\"Y\",\"departmentId\":\"$DEPT_ID\",\"designation\":\"Z\",\"employmentType\":\"FULL_TIME\",\"workMode\":\"ONSITE\",\"location\":\"L\",\"priority\":\"LOW\",\"status\":\"PUBLISHED\",\"vacanciesFilled\":99}" > /dev/null
check "mass-assignment of status/vacanciesFilled is rejected" "400" "$(code)"

api "$HR_JAR" GET /applications/not-a-valid-uuid > /dev/null
check "malformed UUID is rejected" "400" "$(code)"

# Audit logs belong to the Super Admin role (see section 4 of the spec):
# HR Admin deliberately does NOT hold audit.read.
api "$HR_JAR" GET '/admin/audit-logs?pageSize=5' > /dev/null
check "HR Admin cannot read the audit trail (Super Admin only)" "403" "$(code)"

SA_JAR="$JAR_DIR/sa.txt"; : > "$SA_JAR"
login "$SA_JAR" "${SEED_ADMIN_EMAIL:-superadmin@hr-ats.local}" "$PW" > /dev/null
curl -s -c "$SA_JAR" -b "$SA_JAR" "$BASE/auth/csrf" > /dev/null

AUDIT=$(api "$SA_JAR" GET '/admin/audit-logs?pageSize=5')
check "Super Admin can read the audit trail" "200" "$(code)"
AUDIT_TOTAL=$(jqv "$AUDIT" 'd.meta.totalItems')
[ "${AUDIT_TOTAL:-0}" -ge 1 ] && pass "audit entries were written ($AUDIT_TOTAL total)" \
  || fail "audit entries were written" ">=1" "${AUDIT_TOTAL:-0}"

SEC=$(api "$SA_JAR" GET '/admin/security-summary?days=1')
check "security summary is readable by Super Admin" "200" "$(code)"
FAILED_LOGINS=$(jqv "$SEC" 'd.failedLogins')
[ "${FAILED_LOGINS:-0}" -ge 1 ] && pass "failed logins were recorded ($FAILED_LOGINS)" \
  || fail "failed logins were recorded" ">=1" "${FAILED_LOGINS:-0}"

# =====================================================================
section '10. Session lifecycle'
# =====================================================================
api "$C1_JAR" POST /auth/logout '{}' > /dev/null
check "logout succeeds" "200" "$(code)"
api "$C1_JAR" GET /auth/me > /dev/null
check "session is unusable after logout" "401" "$(code)"

# =====================================================================
printf '\n\033[1m================ RESULT ================\033[0m\n'
printf '  passed: \033[32m%d\033[0m\n  failed: \033[31m%d\033[0m\n' "$PASS" "$FAIL"
if [ "$FAIL" -gt 0 ]; then
  printf '\n  failing checks:\n'
  for name in "${FAILED_NAMES[@]}"; do printf '    - %s\n' "$name"; done
  exit 1
fi
printf '\n  All checks passed.\n'

#!/usr/bin/env bash
# =====================================================================
#  Kong Gateway verification
#
#  Checks the gateway-level controls from section 27.9 against the
#  RUNNING Docker stack. Run after `docker compose up -d`.
#
#    bash scripts/kong-test.sh
# =====================================================================
set -uo pipefail

KONG="${KONG_URL:-http://localhost:8000}"
PASS=0
FAIL=0
FAILED=()

pass() { PASS=$((PASS+1)); printf '  \033[32mPASS\033[0m  %s\n' "$1"; }
fail() { FAIL=$((FAIL+1)); FAILED+=("$1"); printf '  \033[31mFAIL\033[0m  %s\n     expected: %s\n     actual:   %s\n' "$1" "$2" "$3"; }
check() { if [ "$2" = "$3" ]; then pass "$1"; else fail "$1" "$2" "$3"; fi }
section() { printf '\n\033[1m%s\033[0m\n' "$1"; }

status() { curl -s -o /dev/null -w '%{http_code}' --max-time 8 "$@"; }

printf '\033[1mKong gateway verification\033[0m  ->  %s\n' "$KONG"

# =====================================================================
section '1. Routing'
# =====================================================================
check "Kong forwards /api/health to NestJS" "200" "$(status "$KONG/api/health")"
check "Kong forwards the public careers API" "200" "$(status "$KONG/api/public/jobs")"
check "unknown path returns 404 from Kong" "404" "$(status "$KONG/nonexistent")"

# =====================================================================
section '2. Network isolation'
# =====================================================================
# 000 means the connection was refused -- the port is not published.
check "backend is NOT reachable directly on :3000" "000" "$(status http://localhost:3000/api/health)"
check "Kong Admin API is NOT exposed on :8001" "000" "$(status http://localhost:8001/)"
check "Redis is NOT exposed on :6379" "000" "$(status http://localhost:6379/)"

MYSQL_PORT=$(docker compose port mysql 3306 2>/dev/null || echo "")
if [[ "$MYSQL_PORT" == 127.0.0.1:* ]]; then
  pass "MySQL is bound to loopback only ($MYSQL_PORT)"
else
  fail "MySQL is bound to loopback only" "127.0.0.1:*" "${MYSQL_PORT:-not published}"
fi

# =====================================================================
section '3. Authorization still enforced behind the gateway'
# =====================================================================
check "protected route rejects anonymous access" "401" "$(status "$KONG/api/jobs")"
check "admin route rejects anonymous access" "401" "$(status "$KONG/api/admin/users")"

# Gateway headers must not grant anything.
SPOOF=$(status -H 'X-User-Id: 00000000-0000-0000-0000-000000000000' \
               -H 'X-Role: SUPER_ADMIN' \
               -H 'X-Permissions: user.read' \
               "$KONG/api/admin/users")
check "spoofed identity headers grant no access" "401" "$SPOOF"

# A forged gateway-secret header must be stripped by Kong, not honoured.
FORGED=$(status -H 'X-Gateway-Secret: forged-value' "$KONG/api/admin/users")
check "forged X-Gateway-Secret grants no access" "401" "$FORGED"

# =====================================================================
section '4. Security headers'
# =====================================================================
HEADERS=$(curl -s -D - -o /dev/null --max-time 8 "$KONG/api/health")

grep -qi 'x-content-type-options: nosniff' <<< "$HEADERS" \
  && pass "X-Content-Type-Options: nosniff is set" \
  || fail "X-Content-Type-Options" "nosniff" "missing"

grep -qi 'x-frame-options: DENY' <<< "$HEADERS" \
  && pass "X-Frame-Options: DENY is set" \
  || fail "X-Frame-Options" "DENY" "missing"

grep -qi 'referrer-policy' <<< "$HEADERS" \
  && pass "Referrer-Policy is set" \
  || fail "Referrer-Policy" "present" "missing"

grep -qi '^x-request-id:' <<< "$HEADERS" \
  && pass "X-Request-Id is generated for correlation" \
  || fail "X-Request-Id" "present" "missing"

grep -qiE '^server: kong|^x-powered-by' <<< "$HEADERS" \
  && fail "stack is not advertised" "no Server/X-Powered-By" "present" \
  || pass "stack version is not advertised"

# =====================================================================
section '5. CORS'
# =====================================================================
ALLOWED=$(curl -s -D - -o /dev/null --max-time 8 \
  -H 'Origin: http://localhost:5173' \
  -H 'Access-Control-Request-Method: POST' \
  -X OPTIONS "$KONG/api/auth/login" | grep -i 'access-control-allow-origin' || true)

[[ "$ALLOWED" == *"localhost:5173"* ]] \
  && pass "configured origin is allowed by CORS" \
  || fail "configured origin is allowed" "localhost:5173" "${ALLOWED:-none}"

EVIL=$(curl -s -D - -o /dev/null --max-time 8 \
  -H 'Origin: https://evil.example.com' \
  -H 'Access-Control-Request-Method: POST' \
  -X OPTIONS "$KONG/api/auth/login" | grep -i 'access-control-allow-origin' || true)

[[ "$EVIL" == *"evil.example.com"* ]] \
  && fail "unknown origin is rejected by CORS" "no allow-origin" "$EVIL" \
  || pass "unknown origin is rejected by CORS"

# Credentialed requests must never be paired with a wildcard origin.
[[ "$ALLOWED" == *"*"* ]] \
  && fail "no wildcard origin with credentials" "explicit origin" "wildcard" \
  || pass "no wildcard origin with credentials"

# =====================================================================
section '6. Request size limiting'
# =====================================================================
# 3 MB body against a route whose limit is 2 MB.
# The body is streamed from a FILE: passing 3 MB as a curl argument
# exceeds the OS command-line length limit.
BIGFILE="$(mktemp)"
{
  printf '{"x":"'
  head -c 3000000 /dev/zero | tr '\0' 'a'
  printf '"}'
} > "$BIGFILE"

# "Expect:" disables curl's automatic 100-continue. Without it, nginx
# rejects at the expect stage with 417 before the request-size-limiting
# plugin ever runs. Both codes block the body, but 413 is the one that
# proves the PLUGIN did it.
OVERSIZE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 \
  -X POST -H 'Content-Type: application/json' -H 'Expect:' \
  --data-binary "@$BIGFILE" "$KONG/api/jobs")

# And confirm the default client behaviour is still refused.
OVERSIZE_EXPECT=$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 \
  -X POST -H 'Content-Type: application/json' \
  --data-binary "@$BIGFILE" "$KONG/api/jobs")
rm -f "$BIGFILE"

check "oversized body rejected by the size plugin (413)" "413" "$OVERSIZE"

[[ "$OVERSIZE_EXPECT" == "413" || "$OVERSIZE_EXPECT" == "417" ]] \
  && pass "oversized body also refused with Expect: 100-continue ($OVERSIZE_EXPECT)" \
  || fail "oversized body refused with Expect" "413 or 417" "$OVERSIZE_EXPECT"

# A normal-sized body must NOT be size-rejected -- it should reach auth.
SMALL=$(status -X POST -H 'Content-Type: application/json' -d '{"x":"small"}' "$KONG/api/jobs")
check "normal-sized body passes the size limit (reaches auth)" "401" "$SMALL"

# =====================================================================
section '7. Rate limiting'
# =====================================================================
# Login is limited to 5/minute per IP at the gateway.
printf '  sending 12 rapid login attempts…\n'
SAW_429=0
for _ in $(seq 1 12); do
  CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 \
    -X POST -H 'Content-Type: application/json' \
    -d '{"email":"ratelimit@test.invalid","password":"wrong-password-here"}' \
    "$KONG/api/auth/login")
  [ "$CODE" = "429" ] && SAW_429=1 && break
done
[ "$SAW_429" = "1" ] \
  && pass "login rate limit returns 429" \
  || fail "login rate limit returns 429" "429 within 12 attempts" "never throttled"

RL=$(curl -s -D - -o /dev/null --max-time 8 "$KONG/api/public/jobs" | grep -ci 'ratelimit' || true)
[ "${RL:-0}" -ge 1 ] \
  && pass "rate-limit headers are returned" \
  || fail "rate-limit headers" "present" "missing"

# =====================================================================
printf '\n\033[1m================ RESULT ================\033[0m\n'
printf '  passed: \033[32m%d\033[0m\n  failed: \033[31m%d\033[0m\n' "$PASS" "$FAIL"
if [ "$FAIL" -gt 0 ]; then
  printf '\n  failing checks:\n'
  for n in "${FAILED[@]}"; do printf '    - %s\n' "$n"; done
  exit 1
fi
printf '\n  All gateway checks passed.\n'

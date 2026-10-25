# =====================================================================
#  HR-ATS — start the full Docker stack
#
#    powershell -File scripts\docker-start.ps1
#    powershell -File scripts\docker-start.ps1 -Build      # rebuild images
#    powershell -File scripts\docker-start.ps1 -Migrate    # run migrations too
# =====================================================================
param(
  [switch]$Build,
  [switch]$Migrate,
  [switch]$Seed
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Fail($message) { Write-Host $message -ForegroundColor Red; exit 1 }
function Ok($message)   { Write-Host $message -ForegroundColor Green }
function Info($message) { Write-Host $message -ForegroundColor Cyan }

# ---------------------------------------------------------------------
#  Preflight
# ---------------------------------------------------------------------
Info "Checking prerequisites..."

try { docker version --format '{{.Server.Version}}' | Out-Null }
catch { Fail "Docker is not running. Start Docker Desktop and try again." }

if (-not (Test-Path (Join-Path $root '.env'))) {
  Fail @"
No .env file found.

  Copy-Item .env.example .env

Then replace every CHANGE_ME value before starting. Generate secrets with:
  node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
"@
}

# Refuse to start with placeholder secrets still in place.
$placeholders = Select-String -Path (Join-Path $root '.env') -Pattern 'CHANGE_ME' -AllMatches |
                Where-Object { $_.Line -notmatch '^\s*#' }
if ($placeholders) {
  Write-Host "Your .env still contains CHANGE_ME placeholders:" -ForegroundColor Red
  $placeholders | ForEach-Object { Write-Host "  line $($_.LineNumber): $($_.Line.Split('=')[0])" }
  Fail "Replace them before starting."
}

# Warn about host ports that are already taken.
$envText = Get-Content (Join-Path $root '.env') -Raw
$mysqlPort = if ($envText -match '(?m)^MYSQL_HOST_PORT=(\d+)') { $Matches[1] } else { '3307' }
$kongPort  = if ($envText -match '(?m)^KONG_PROXY_PORT=(\d+)')  { $Matches[1] } else { '8000' }

foreach ($port in @($mysqlPort, $kongPort, '5173')) {
  $inUse = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
  if ($inUse) {
    $proc = (Get-Process -Id ($inUse | Select-Object -First 1).OwningProcess -ErrorAction SilentlyContinue).ProcessName
    Write-Host "  WARNING: port $port is already in use by '$proc'." -ForegroundColor Yellow
    Write-Host "           Change the port in .env or stop that process." -ForegroundColor Yellow
  }
}

Ok "Prerequisites look good."

# ---------------------------------------------------------------------
#  Start
# ---------------------------------------------------------------------
Info "`nValidating compose configuration..."
docker compose config --quiet
if ($LASTEXITCODE -ne 0) { Fail "docker-compose.yml is invalid." }

Info "Starting services..."
if ($Build) { docker compose up -d --build } else { docker compose up -d }
if ($LASTEXITCODE -ne 0) { Fail "Failed to start the stack. Check: docker compose logs" }

# ---------------------------------------------------------------------
#  Wait for health
# ---------------------------------------------------------------------
Info "`nWaiting for services to become healthy..."
$deadline = (Get-Date).AddMinutes(4)
$healthy = $false

while ((Get-Date) -lt $deadline) {
  Start-Sleep -Seconds 5
  $mysql   = docker inspect --format '{{.State.Health.Status}}' hr-ats-mysql 2>$null
  $backend = docker inspect --format '{{.State.Health.Status}}' hr-ats-backend 2>$null
  $kong    = docker inspect --format '{{.State.Health.Status}}' hr-ats-kong 2>$null

  Write-Host "  mysql=$mysql backend=$backend kong=$kong"

  if ($mysql -eq 'healthy' -and $backend -eq 'healthy' -and $kong -eq 'healthy') {
    $healthy = $true
    break
  }
}

if (-not $healthy) {
  Write-Host "`nServices did not all become healthy in time." -ForegroundColor Yellow
  Write-Host "Inspect with: docker compose ps  /  docker compose logs" -ForegroundColor Yellow
}

# ---------------------------------------------------------------------
#  Optional migration + seed
# ---------------------------------------------------------------------
if ($Migrate) {
  Info "`nRunning database migrations (one-shot, elevated account)..."
  docker compose --profile migrate run --rm migrate
  if ($LASTEXITCODE -ne 0) { Fail "Migrations failed." }
  Ok "Migrations applied."
}

if ($Seed) {
  Info "`nSeeding reference data..."
  docker compose exec -T backend npx ts-node prisma/seed.ts
  if ($LASTEXITCODE -ne 0) { Write-Host "Seed failed." -ForegroundColor Yellow }
}

# ---------------------------------------------------------------------
#  Summary
# ---------------------------------------------------------------------
Write-Host ""
docker compose ps --format "table {{.Name}}`t{{.Status}}`t{{.Ports}}"

Write-Host ""
Ok "HR-ATS is running."
Write-Host @"

  Careers portal    http://localhost:5173/careers
  Application       http://localhost:5173
  API (via Kong)    http://localhost:8000/api
  API health        http://localhost:8000/api/health
  Swagger (dev)     http://localhost:8000/api/docs
  MailHog inbox     http://localhost:8025
  MySQL Workbench   127.0.0.1:$mysqlPort  (user: hr_ats_app)

  The backend, Redis and the Kong Admin API are deliberately NOT
  published to the host. Kong is the only way into the API.

  Stop the stack (keeps your data):  docker compose down
"@

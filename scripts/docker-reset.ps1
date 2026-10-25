# =====================================================================
#  HR-ATS — reset the Docker environment
#
#  DANGEROUS. With -IncludeData this DELETES the MySQL volume and every
#  record in the database. That cannot be undone.
#
#  Safeguards:
#    * data is never deleted unless -IncludeData is passed explicitly
#    * the exact phrase DELETE ALL DATA must be typed to confirm
#    * a backup is offered first, and taken by default
#    * row counts are shown before anything is destroyed
#
#    powershell -File scripts\docker-reset.ps1                 # containers only
#    powershell -File scripts\docker-reset.ps1 -IncludeData    # destroys data
# =====================================================================
param(
  [switch]$IncludeData,
  [switch]$SkipBackup
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Info($m) { Write-Host $m -ForegroundColor Cyan }
function Warn($m) { Write-Host $m -ForegroundColor Yellow }
function Bad($m)  { Write-Host $m -ForegroundColor Red }

# ---------------------------------------------------------------------
#  Safe path: recreate containers, keep every volume
# ---------------------------------------------------------------------
if (-not $IncludeData) {
  Info "Resetting containers only. Volumes and data are preserved."
  docker compose down
  docker compose up -d --build
  Write-Host ""
  Write-Host "Containers recreated. Your data is intact." -ForegroundColor Green
  Write-Host "To also destroy the database, re-run with -IncludeData." -ForegroundColor DarkGray
  exit 0
}

# ---------------------------------------------------------------------
#  Destructive path
# ---------------------------------------------------------------------
Write-Host ""
Bad "=============================================================="
Bad "  WARNING: this will PERMANENTLY DELETE the HR-ATS database"
Bad "=============================================================="
Write-Host ""

# Show what is actually at stake, read live from the database.
$counts = $null
try {
  $envText = Get-Content (Join-Path $root '.env') -Raw
  if ($envText -match '(?m)^MYSQL_ROOT_PASSWORD=(.+)$') {
    $rootPassword = $Matches[1].Trim()
    $sql = @"
SELECT CONCAT(
  (SELECT COUNT(*) FROM hr_ats_db.users),' users, ',
  (SELECT COUNT(*) FROM hr_ats_db.candidate_profiles),' candidates, ',
  (SELECT COUNT(*) FROM hr_ats_db.job_requirements),' job requirements, ',
  (SELECT COUNT(*) FROM hr_ats_db.job_applications),' applications, ',
  (SELECT COUNT(*) FROM hr_ats_db.offers),' offers, ',
  (SELECT COUNT(*) FROM hr_ats_db.audit_logs),' audit records'
);
"@
    $counts = docker exec -e MYSQL_PWD="$rootPassword" hr-ats-mysql mysql -u root -N -e $sql 2>$null
  }
} catch { }

if ($counts) {
  Bad "  You are about to destroy:"
  Bad "    $counts"
} else {
  Warn "  Could not read current row counts (is the database running?)."
  Warn "  Proceeding will still delete the volume if it exists."
}

Write-Host ""
Warn "  Uploaded candidate documents will also be deleted."
Write-Host ""

# ---- Backup first, unless explicitly skipped ----
if (-not $SkipBackup) {
  $stamp  = Get-Date -Format 'yyyyMMdd-HHmmss'
  $backup = Join-Path $root "backup-hr_ats_db-$stamp.sql"
  Info "Taking a backup first: $backup"
  try {
    docker exec hr-ats-mysql sh -c 'exec mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines --triggers hr_ats_db' |
      Out-File -FilePath $backup -Encoding utf8
    if ((Get-Item $backup -ErrorAction SilentlyContinue).Length -gt 1024) {
      Write-Host "  Backup written ($([math]::Round((Get-Item $backup).Length / 1KB)) KB)." -ForegroundColor Green
    } else {
      Warn "  Backup looks empty. The database may already be down."
    }
  } catch {
    Warn "  Backup failed: $_"
    $answer = Read-Host "  Continue WITHOUT a backup? (yes/no)"
    if ($answer -ne 'yes') { Write-Host "Aborted."; exit 1 }
  }
} else {
  Warn "  -SkipBackup was passed: no backup will be taken."
}

# ---- Typed confirmation ----
Write-Host ""
Bad "  Type exactly:  DELETE ALL DATA"
$confirmation = Read-Host "  Confirmation"

if ($confirmation -cne 'DELETE ALL DATA') {
  Write-Host ""
  Write-Host "Confirmation did not match. Nothing was deleted." -ForegroundColor Green
  exit 1
}

# ---- Proceed ----
Write-Host ""
Info "Stopping the stack and removing named volumes..."
docker compose down -v

Info "Removing any leftover HR-ATS volumes..."
$leftovers = docker volume ls --filter "name=hr_ats" --format "{{.Name}}"
foreach ($volume in ($leftovers -split "`n" | Where-Object { $_ })) {
  docker volume rm $volume 2>$null | Out-Null
  Write-Host "  removed $volume"
}

Write-Host ""
Write-Host "Reset complete. Rebuild a clean environment with:" -ForegroundColor Green
Write-Host "  powershell -File scripts\docker-start.ps1 -Build -Migrate -Seed"

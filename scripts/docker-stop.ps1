# =====================================================================
#  HR-ATS — stop the Docker stack
#
#  This PRESERVES all data. It deliberately never passes `-v`, which
#  would delete the named volumes and every database record with them.
#
#    powershell -File scripts\docker-stop.ps1
#    powershell -File scripts\docker-stop.ps1 -KeepRunning   # pause only
# =====================================================================
param(
  # Stops containers without removing them. Slightly faster to resume.
  [switch]$KeepRunning
)

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)

if ($KeepRunning) {
  Write-Host "Stopping containers (not removing them)..." -ForegroundColor Cyan
  docker compose stop
} else {
  Write-Host "Stopping and removing containers..." -ForegroundColor Cyan
  # NOTE: no -v. Named volumes, and therefore all MySQL data, survive.
  docker compose down
}

Write-Host ""
Write-Host "Stack stopped. Your data is intact." -ForegroundColor Green

$volumes = docker volume ls --filter "name=hr_ats" --format "{{.Name}}"
if ($volumes) {
  Write-Host "`nPreserved volumes:"
  $volumes -split "`n" | Where-Object { $_ } | ForEach-Object { Write-Host "  $_" }
}

Write-Host "`nStart again with:  powershell -File scripts\docker-start.ps1"

# =====================================================================
#  HR-ATS — view container logs
#
#    powershell -File scripts\docker-logs.ps1                 # app logs, follow
#    powershell -File scripts\docker-logs.ps1 -Service mysql
#    powershell -File scripts\docker-logs.ps1 -Errors         # errors only
#    powershell -File scripts\docker-logs.ps1 -Tail 200 -NoFollow
# =====================================================================
param(
  [ValidateSet('all', 'backend', 'frontend', 'mysql', 'redis', 'kong', 'mailhog', 'app')]
  [string]$Service = 'app',

  [int]$Tail = 100,
  [switch]$NoFollow,
  [switch]$Errors
)

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)

# "app" is the common case: the two services you are usually debugging.
$target = switch ($Service) {
  'app' { @('backend', 'frontend') }
  'all' { @() }
  default { @($Service) }
}

$arguments = @('compose', 'logs', '--tail', $Tail)
if (-not $NoFollow -and -not $Errors) { $arguments += '-f' }
$arguments += $target

Write-Host "Logs: $(if ($target) { $target -join ', ' } else { 'all services' })" -ForegroundColor Cyan

if ($Errors) {
  # Follow mode cannot be filtered, so -Errors implies a bounded read.
  Write-Host "(filtering for errors; not following)" -ForegroundColor Yellow
  & docker @arguments 2>&1 |
    Select-String -Pattern 'error|exception|fatal|failed|denied|refused' |
    Select-Object -Last 80
} else {
  Write-Host "(Ctrl+C to stop)`n" -ForegroundColor DarkGray
  & docker @arguments
}

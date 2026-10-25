# =====================================================================
#  Start / restart the HR-ATS backend directly on Windows
#  (MySQL, Redis and MailHog still run in Docker).
#
#  Stops whatever currently holds the port first -- a backgrounded node
#  process that fails to bind exits silently, which otherwise leaves a
#  stale build serving requests.
#
#    powershell -File scripts\dev-api.ps1
#    powershell -File scripts\dev-api.ps1 -Stop
#    powershell -File scripts\dev-api.ps1 -TestMode   # raised rate limits
# =====================================================================
param(
  [int]$Port = 3000,
  [switch]$Stop,
  [switch]$TestMode
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root 'backend'

function Stop-OnPort([int]$p) {
  $conns = Get-NetTCPConnection -State Listen -LocalPort $p -ErrorAction SilentlyContinue
  if (-not $conns) { Write-Host "Port $p is free." ; return }
  foreach ($c in $conns) {
    $proc = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue
    if ($proc) {
      Write-Host "Stopping PID $($proc.Id) ($($proc.ProcessName)) on port $p..."
      Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    }
  }
  Start-Sleep -Seconds 2
}

Stop-OnPort $Port
if ($Stop) { Write-Host "Backend stopped."; exit 0 }

if (-not (Test-Path (Join-Path $backend 'dist\main.js'))) {
  Write-Host "No build found. Running npm run build..."
  Push-Location $backend
  npm run build
  Pop-Location
}

if ($TestMode) {
  # Local test runs only. Kong still enforces its own limits at the edge,
  # and the secure defaults apply whenever these are not set.
  Write-Host "TEST MODE: auth rate limits raised for this process." -ForegroundColor Yellow
  $env:AUTH_THROTTLE_LIMIT     = '200'
  $env:REGISTER_THROTTLE_LIMIT = '200'
  $env:RESET_THROTTLE_LIMIT    = '200'
  $env:MFA_THROTTLE_LIMIT      = '200'
  $env:PUBLIC_THROTTLE_LIMIT   = '500'
}

$log = Join-Path $backend 'api.log'
Write-Host "Starting backend (log: $log)..."
Push-Location $backend
$proc = Start-Process -FilePath 'node' -ArgumentList 'dist/main.js' `
  -RedirectStandardOutput $log -RedirectStandardError "$log.err" `
  -PassThru -WindowStyle Hidden
Pop-Location

# Wait for the health endpoint rather than assuming the process survived.
$ok = $false
for ($i = 1; $i -le 30; $i++) {
  Start-Sleep -Seconds 1
  try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/api/health" -UseBasicParsing -TimeoutSec 3
    if ($r.StatusCode -eq 200) { $ok = $true; break }
  } catch { }
}

if ($ok) {
  Write-Host "Backend is up on http://127.0.0.1:$Port/api  (PID $($proc.Id))" -ForegroundColor Green
  Write-Host "Swagger: http://127.0.0.1:$Port/api/docs"
} else {
  Write-Host "Backend did not become healthy. Last log lines:" -ForegroundColor Red
  if (Test-Path "$log.err") { Get-Content "$log.err" -Tail 20 }
  if (Test-Path $log) { Get-Content $log -Tail 20 }
  exit 1
}

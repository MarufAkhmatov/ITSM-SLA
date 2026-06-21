# SLANEST — Docker desktop launcher. Ensures Docker Desktop + the SLANEST
# container are up, then opens the app. Used by the "SLANEST" desktop icon.
$ErrorActionPreference = "SilentlyContinue"
$proj = Split-Path -Parent $MyInvocation.MyCommand.Path
$compose = Join-Path $proj "docker-compose.slanest.yml"

function DaemonUp { docker info 2>$null | Out-Null; return $? }

# 1) Make sure the Docker daemon is running (start Docker Desktop if needed).
if (-not (DaemonUp)) {
  $dd = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
  if (Test-Path $dd) { Start-Process $dd }
  for ($i = 0; $i -lt 60; $i++) { if (DaemonUp) { break }; Start-Sleep -Seconds 3 }
}

# 2) Bring the container up (idempotent — no-op if already running).
if (DaemonUp) {
  Push-Location $proj
  docker compose -f $compose up -d 2>$null | Out-Null
  Pop-Location
}

# 3) Wait for the API, then open the browser.
for ($i = 0; $i -lt 30; $i++) {
  try { $r = Invoke-WebRequest -Uri "http://localhost:8090/api/health" -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { break } } catch {}
  Start-Sleep -Milliseconds 700
}
Start-Process "http://localhost:8090"

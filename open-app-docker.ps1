# SLANEST - Docker desktop launcher. Ensures Docker Desktop + the SLANEST
# container are up, opens the app, and shows the phone (LAN) URL so any device
# on the same Wi-Fi (iPhone / Samsung) can open it - no tunnel needed.
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

# 2) Bring the container up (idempotent - no-op if already running).
if (DaemonUp) {
  Push-Location $proj
  docker compose -f $compose up -d 2>$null | Out-Null
  Pop-Location
}

# 3) Ensure the LAN firewall rule exists (so phones on the Wi-Fi can connect).
if (-not (Get-NetFirewallRule -DisplayName "SLANEST 8090" -ErrorAction SilentlyContinue)) {
  New-NetFirewallRule -DisplayName "SLANEST 8090" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8090 -Profile Any | Out-Null
}

# 4) Wait for the API to answer.
for ($i = 0; $i -lt 30; $i++) {
  try { $r = Invoke-WebRequest -Uri "http://localhost:8090/api/health" -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { break } } catch {}
  Start-Sleep -Milliseconds 700
}

# 5) Find the current Wi-Fi LAN IPv4 (DHCP) so the login page's QR encodes a
#    phone-reachable address. Open the app via the LAN IP (falls back to localhost).
$ip = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.PrefixOrigin -eq "Dhcp" -and $_.IPAddress -notmatch "^(127\.|169\.254\.)" } | Select-Object -First 1 -ExpandProperty IPAddress)
if (-not $ip) {
  $ip = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -match "^(192\.168\.|10\.|172\.)" } | Select-Object -First 1 -ExpandProperty IPAddress)
}
$host8090 = if ($ip) { "http://" + $ip + ":8090" } else { "http://localhost:8090" }
Start-Process $host8090

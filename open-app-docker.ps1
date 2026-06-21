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

# 5) Open the app on this PC (this is the important part - always runs).
Start-Process "http://localhost:8090"

# 6) Find the current Wi-Fi LAN IPv4 (DHCP) and show the phone URL + QR.
$ip = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.PrefixOrigin -eq "Dhcp" -and $_.IPAddress -notmatch "^(127\.|169\.254\.)" } | Select-Object -First 1 -ExpandProperty IPAddress)
if (-not $ip) {
  $ip = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -match "^(192\.168\.|10\.|172\.)" } | Select-Object -First 1 -ExpandProperty IPAddress)
}

if ($ip) {
  $phoneUrl = "http://" + $ip + ":8090"
  $qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=" + [uri]::EscapeDataString($phoneUrl)

  # Build the mobile page with plain concatenation (no here-strings).
  $h = '<!doctype html><html><head><meta charset="utf-8">'
  $h += '<meta name="viewport" content="width=device-width,initial-scale=1">'
  $h += '<title>SLANEST</title><style>'
  $h += 'body{font-family:Segoe UI,Arial,sans-serif;background:#0c1622;color:#eaf2f5;text-align:center;padding:40px}'
  $h += 'a{color:#4EB6A6;font-size:24px;font-weight:700;text-decoration:none}'
  $h += '.card{max-width:420px;margin:0 auto;background:#13202e;border-radius:18px;padding:28px}'
  $h += 'img{border-radius:12px;background:#fff;padding:10px;margin:18px 0}small{color:#9aa5b4}'
  $h += '</style></head><body><div class="card"><h2>SLANEST</h2>'
  $h += '<p>Bir xil Wi-Fi dagi telefonda oching:</p>'
  $h += '<a href="' + $phoneUrl + '">' + $phoneUrl + '</a>'
  $h += '<div><img width="240" height="240" src="' + $qrUrl + '"></div>'
  $h += '<small>QR-kodni telefon kamerasi bilan skanerlang. Login: Admin / Admin 2026</small>'
  $h += '</div></body></html>'

  $mob = Join-Path $proj "mobile-access.html"
  Set-Content -Path $mob -Value $h -Encoding UTF8
  Start-Process $mob

  try {
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    $ni = New-Object System.Windows.Forms.NotifyIcon
    $ni.Icon = [System.Drawing.SystemIcons]::Information
    $ni.BalloonTipTitle = "SLANEST - mobil kirish (bir xil Wi-Fi)"
    $ni.BalloonTipText = "Telefonda oching: " + $phoneUrl
    $ni.Visible = $true
    $ni.ShowBalloonTip(8000)
    Start-Sleep -Seconds 8
    $ni.Dispose()
  } catch {}
}

# SLANEST — Docker desktop launcher. Ensures Docker Desktop + the SLANEST
# container are up, opens the app, and shows the phone (LAN) URL so any device
# on the same Wi-Fi (iPhone / Samsung / ...) can open it — no tunnel needed.
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

# 3) Ensure the LAN firewall rule exists (so phones on the Wi-Fi can connect).
if (-not (Get-NetFirewallRule -DisplayName "SLANEST 8090" -ErrorAction SilentlyContinue)) {
  try { New-NetFirewallRule -DisplayName "SLANEST 8090" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8090 -Profile Any | Out-Null } catch {}
}

# 4) Wait for the API to answer.
for ($i = 0; $i -lt 30; $i++) {
  try { $r = Invoke-WebRequest -Uri "http://localhost:8090/api/health" -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { break } } catch {}
  Start-Sleep -Milliseconds 700
}

# 5) Find the current Wi-Fi LAN IPv4 (DHCP) so phones know where to connect.
$ip = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
       Where-Object { $_.PrefixOrigin -eq "Dhcp" -and $_.IPAddress -notmatch "^(127\.|169\.254\.)" } |
       Select-Object -First 1 -ExpandProperty IPAddress)
if (-not $ip) {
  $ip = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
         Where-Object { $_.IPAddress -match "^192\.168\.|^10\.|^172\.(1[6-9]|2[0-9]|3[0-1])\." } |
         Select-Object -First 1 -ExpandProperty IPAddress)
}

# 6) Open the app on this PC.
Start-Process "http://localhost:8090"

# 7) Write a small "mobile" page (with a scannable QR) and show the phone URL.
if ($ip) {
  $phoneUrl = "http://$ip`:8090"
  $qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=" + [uri]::EscapeDataString($phoneUrl)
  $html = @"
<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>
<title>SLANEST - mobil kirish</title>
<style>body{font-family:Segoe UI,Arial,sans-serif;background:#0c1622;color:#eaf2f5;text-align:center;padding:40px}
a{color:#4EB6A6;font-size:26px;font-weight:700;text-decoration:none}
.card{max-width:420px;margin:0 auto;background:#13202e;border-radius:18px;padding:28px;box-shadow:0 20px 60px rgba(0,0,0,.4)}
img{border-radius:12px;background:#fff;padding:10px;margin:18px 0}small{color:#9aa5b4}</style></head>
<body><div class='card'><h2>SLANEST</h2>
<p>Bir xil Wi-Fi'dagi telefonda oching:</p>
<a href='$phoneUrl'>$phoneUrl</a>
<div><img src='$qrUrl' alt='QR' width='240' height='240'></div>
<small>QR-kodni telefon kamerasi bilan skanерlang. Login: Admin / Admin 2026</small></div></body></html>
"@
  $mob = Join-Path $proj "mobile-access.html"
  Set-Content -Path $mob -Value $html -Encoding UTF8
  Start-Process $mob

  try {
    Add-Type -AssemblyName System.Windows.Forms
    $ni = New-Object System.Windows.Forms.NotifyIcon
    $ni.Icon = [System.Drawing.SystemIcons]::Information
    $ni.BalloonTipTitle = "SLANEST — mobil kirish (bir xil Wi-Fi)"
    $ni.BalloonTipText = "Telefonda oching: $phoneUrl"
    $ni.Visible = $true
    $ni.ShowBalloonTip(8000)
    Start-Sleep -Seconds 9
    $ni.Dispose()
  } catch {}
}

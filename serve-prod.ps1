# ITSM-SLA — production watchdog.
# Serves the built SPA + API from ONE resilient Python process on port 8090.
# Self-healing: if the server dies, it is restarted within ~15s. Runs forever
# (until the machine shuts down); relaunched at the next logon by the scheduled
# task created by install-autostart.ps1.
$ErrorActionPreference = "SilentlyContinue"
$proj = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $proj
$env:PN_PORT = "8090"

# Build the frontend once if it hasn't been built yet.
if (-not (Test-Path "$proj\dist\index.html")) {
  try { & npm run build 2>&1 | Out-Null } catch { }
}

$py = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $py) { $py = (Get-Command py -ErrorAction SilentlyContinue).Source }
if (-not $py) { $py = "python" }

while ($true) {
  $up = Get-NetTCPConnection -LocalPort 8090 -State Listen -ErrorAction SilentlyContinue
  if (-not $up) {
    Start-Process -FilePath $py -ArgumentList "`"$proj\backend\server.py`"" -WorkingDirectory $proj -WindowStyle Hidden
  }
  Start-Sleep -Seconds 15
}

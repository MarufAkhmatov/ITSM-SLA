# SLANEST — desktop launcher. Ensures the resilient server is running, then
# opens the app in the default browser. Used by the "SLANEST" desktop icon.
$ErrorActionPreference = "SilentlyContinue"
$proj = Split-Path -Parent $MyInvocation.MyCommand.Path

function Port8090Up { Get-NetTCPConnection -LocalPort 8090 -State Listen -ErrorAction SilentlyContinue }

if (-not (Port8090Up)) {
  # try the background scheduled task first, else launch the watchdog directly
  Start-ScheduledTask -TaskName "SLANEST" -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 1
  if (-not (Port8090Up)) {
    Start-Process powershell.exe -ArgumentList "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$proj\serve-prod.ps1`"" -WindowStyle Hidden
  }
  for ($i = 0; $i -lt 30; $i++) { if (Port8090Up) { break }; Start-Sleep -Milliseconds 500 }
}

Start-Process "http://localhost:8090"

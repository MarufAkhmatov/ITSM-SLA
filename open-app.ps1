# ProjectNest — desktop launcher. Ensures the resilient server is running, then
# opens the app in the default browser. Used by the "ProjectNest" desktop icon.
$ErrorActionPreference = "SilentlyContinue"
$proj = Split-Path -Parent $MyInvocation.MyCommand.Path

function Port8080Up { Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue }

if (-not (Port8080Up)) {
  # try the background scheduled task first, else launch the watchdog directly
  Start-ScheduledTask -TaskName "ProjectNest" -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 1
  if (-not (Port8080Up)) {
    Start-Process powershell.exe -ArgumentList "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$proj\serve-prod.ps1`"" -WindowStyle Hidden
  }
  for ($i = 0; $i -lt 30; $i++) { if (Port8080Up) { break }; Start-Sleep -Milliseconds 500 }
}

Start-Process "http://localhost:8080"

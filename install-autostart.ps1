# SLANEST — install resilient auto-start (run once).
# 1) Registers a Scheduled Task that launches the watchdog at every logon and
#    restarts it if it ever dies (self-healing, survives reboots).
# 2) Opens the LAN firewall for :8090 (admin needed).
# 3) Creates a Desktop icon "SLANEST" + a Startup-folder shortcut.
# Run in PowerShell:  powershell -ExecutionPolicy Bypass -File .\install-autostart.ps1
$ErrorActionPreference = "Stop"
$proj = Split-Path -Parent $MyInvocation.MyCommand.Path
$watch = "$proj\serve-prod.ps1"
$open  = "$proj\open-app.ps1"
$watchArg = '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $watch + '"'
$openArg  = '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $open + '"'

# ---- 1) Scheduled Task: run watchdog at logon, keep it alive ----
try {
  $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $watchArg
  $trigger = New-ScheduledTaskTrigger -AtLogOn
  $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit (New-TimeSpan -Seconds 0)
  Register-ScheduledTask -TaskName "SLANEST" -Action $action -Trigger $trigger -Settings $settings -Description "SLANEST resilient web app (port 8090)" -Force | Out-Null
  Start-ScheduledTask -TaskName "SLANEST" -ErrorAction SilentlyContinue
  Write-Host "Scheduled Task 'SLANEST' registered + started." -ForegroundColor Green
} catch {
  Write-Host "Scheduled Task registration failed. Falling back to Startup shortcut only." -ForegroundColor Yellow
}

# ---- 2) Open the firewall for the LAN (so the phone can reach :8090) ----
try {
  if (-not (Get-NetFirewallRule -DisplayName "SLANEST 8090" -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName "SLANEST 8090" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8090 -Profile Any | Out-Null
    Write-Host "Firewall rule 'SLANEST 8090' added (LAN access)." -ForegroundColor Green
  }
} catch {
  Write-Host "Firewall rule needs admin — run this script as Administrator for LAN access." -ForegroundColor Yellow
}

# ---- 3) Shortcuts (Desktop launcher + Startup watchdog) ----
$ws = New-Object -ComObject WScript.Shell
$ico = if (Test-Path "$proj\public\ipak-logo.ico") { "$proj\public\ipak-logo.ico" } else { "$env:SystemRoot\System32\SHELL32.dll,13" }

$desktop = [Environment]::GetFolderPath("Desktop")
$lnk = $ws.CreateShortcut("$desktop\SLANEST.lnk")
$lnk.TargetPath = "powershell.exe"
$lnk.Arguments = $openArg
$lnk.WorkingDirectory = $proj
$lnk.IconLocation = $ico
$lnk.Description = "Open SLANEST"
$lnk.Save()
Write-Host "Desktop icon 'SLANEST' created." -ForegroundColor Green

$startup = [Environment]::GetFolderPath("Startup")
$slnk = $ws.CreateShortcut("$startup\SLANEST (server).lnk")
$slnk.TargetPath = "powershell.exe"
$slnk.Arguments = $watchArg
$slnk.WorkingDirectory = $proj
$slnk.IconLocation = $ico
$slnk.WindowStyle = 7
$slnk.Description = "SLANEST background server"
$slnk.Save()
Write-Host "Startup shortcut created." -ForegroundColor Green
Write-Host "Done. App at http://localhost:8090 (and on your LAN)." -ForegroundColor Cyan

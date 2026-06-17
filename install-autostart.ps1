# ProjectNest — install resilient auto-start (run once).
# 1) Registers a Scheduled Task that launches the watchdog at every logon and
#    restarts it if it ever dies (self-healing, survives reboots).
# 2) Creates a Desktop icon "ProjectNest" + a Startup-folder shortcut.
# Run in PowerShell:  powershell -ExecutionPolicy Bypass -File .\install-autostart.ps1
$ErrorActionPreference = "Stop"
$proj = Split-Path -Parent $MyInvocation.MyCommand.Path
$watch = "$proj\serve-prod.ps1"
$open  = "$proj\open-app.ps1"

# ---- 1) Scheduled Task: run watchdog at logon, keep it alive ----
try {
  $action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$watch`""
  $trigger = New-ScheduledTaskTrigger -AtLogOn
  $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -StartWhenAvailable -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit (New-TimeSpan -Seconds 0)
  Register-ScheduledTask -TaskName "ProjectNest" -Action $action -Trigger $trigger `
    -Settings $settings -Description "ProjectNest resilient web app (port 8080)" -Force | Out-Null
  Start-ScheduledTask -TaskName "ProjectNest" -ErrorAction SilentlyContinue
  Write-Host "Scheduled Task 'ProjectNest' registered + started." -ForegroundColor Green
} catch {
  Write-Host "Scheduled Task registration failed ($($_.Exception.Message)). Falling back to Startup shortcut only." -ForegroundColor Yellow
}

# ---- 2) Shortcuts (Desktop launcher + Startup watchdog) ----
$ws = New-Object -ComObject WScript.Shell
$ico = if (Test-Path "$proj\public\ipak-logo.ico") { "$proj\public\ipak-logo.ico" } else { "$env:SystemRoot\System32\SHELL32.dll,13" }

# Desktop "ProjectNest" — opens the app (ensures server up first)
$desktop = [Environment]::GetFolderPath("Desktop")
$lnk = $ws.CreateShortcut("$desktop\ProjectNest.lnk")
$lnk.TargetPath = "powershell.exe"
$lnk.Arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$open`""
$lnk.WorkingDirectory = $proj
$lnk.IconLocation = $ico
$lnk.Description = "Open ProjectNest"
$lnk.Save()
Write-Host "Desktop icon 'ProjectNest' created." -ForegroundColor Green

# Startup-folder watchdog (belt-and-suspenders alongside the task)
$startup = [Environment]::GetFolderPath("Startup")
$slnk = $ws.CreateShortcut("$startup\ProjectNest (server).lnk")
$slnk.TargetPath = "powershell.exe"
$slnk.Arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$watch`""
$slnk.WorkingDirectory = $proj
$slnk.IconLocation = $ico
$slnk.WindowStyle = 7
$slnk.Description = "ProjectNest background server"
$slnk.Save()
Write-Host "Startup shortcut created." -ForegroundColor Green

Write-Host "`nDone. App will be at http://localhost:8080 (and on your LAN/tunnel)." -ForegroundColor Cyan

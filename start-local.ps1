# ProjectNest — local auto-launcher (no Docker, no tunnel, no API key needed).
# Starts the Python backend (:8077) and the Vite frontend (:5173) if they aren't
# already running, then optionally opens the dashboard. Idempotent — safe to run
# repeatedly (it never starts a duplicate).
#
#   Startup (silent):  powershell -WindowStyle Hidden -ExecutionPolicy Bypass -File start-local.ps1
#   Open the page:     powershell -WindowStyle Hidden -ExecutionPolicy Bypass -File start-local.ps1 -Open
param([switch]$Open)

$ErrorActionPreference = "SilentlyContinue"
$proj = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $proj

function PortUp([int]$p) {
  return [bool](Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue)
}

# 1) Backend — Python stdlib API on :8077 (uses the host Claude Code CLI; no key).
if (-not (PortUp 8077)) {
  Start-Process -FilePath "python" -ArgumentList "backend\server.py" `
    -WorkingDirectory $proj -WindowStyle Hidden
}

# 2) Frontend — Vite dev on :5173, bound to 0.0.0.0 so a same-Wi-Fi phone can reach it.
if (-not (PortUp 5173)) {
  Start-Process -FilePath "npm.cmd" -ArgumentList "run", "dev" `
    -WorkingDirectory $proj -WindowStyle Hidden
}

# 3) Wait for the page to be ready, then open it (only with -Open).
if ($Open) {
  for ($i = 0; $i -lt 60; $i++) { if (PortUp 5173) { break }; Start-Sleep -Milliseconds 500 }
  Start-Process "http://localhost:5173"
}

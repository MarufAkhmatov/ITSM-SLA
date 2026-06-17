# ProjectNest — on-demand public HTTPS tunnel (only run this when you need to
# reach the dashboard from outside your Wi-Fi, e.g. mobile data, or to use the
# microphone/voice on a phone — voice needs HTTPS).
#
# Points at the Docker app on :8080. The printed https://<name>.trycloudflare.com
# URL works from anywhere. Close this window to stop exposing the dashboard.
#
# NOTE: a quick tunnel is PUBLIC — anyone with the URL can see your data. Only
# keep it open while you need it.
$proj = Split-Path -Parent $MyInvocation.MyCommand.Path
Write-Host "Starting HTTPS tunnel to the Docker app (http://localhost:8080)..." -ForegroundColor Cyan
Write-Host "Your public URL will appear below. Press Ctrl+C or close this window to stop." -ForegroundColor Yellow
& "$proj\cloudflared.exe" tunnel --url http://localhost:8080 --no-autoupdate

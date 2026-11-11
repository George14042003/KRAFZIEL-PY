# Applies the pending database migrations (subscriptions catalog, application resume/portfolio, job experience)
# and then restarts the backend on port 8003. Run it once from anywhere:
#   & "C:\Users\GEORGE\N.A.I.E - B.E\N.A.I.E.---BACKEND\update-backend.ps1"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here
$python = Join-Path $here ".venv\Scripts\python.exe"
$alembic = Join-Path $here ".venv\Scripts\alembic.exe"

Write-Host "Current database version:" -ForegroundColor Cyan
& $alembic current
Write-Host "Applying migrations..." -ForegroundColor Cyan
& $alembic upgrade head
if ($LASTEXITCODE -ne 0) {
    Write-Host "The migration failed, so the backend was NOT restarted. Nothing was changed on the running site." -ForegroundColor Red
    exit 1
}
& $alembic current

$busy = Get-NetTCPConnection -LocalPort 8003 -State Listen -ErrorAction SilentlyContinue
if ($busy) {
    Write-Host "Stopping the old backend (process $($busy[0].OwningProcess))..." -ForegroundColor Cyan
    taskkill /PID $busy[0].OwningProcess /T /F | Out-Null
    Start-Sleep -Seconds 2
}
Write-Host "Starting the backend on port 8003..." -ForegroundColor Cyan
Start-Process -FilePath $python -ArgumentList "-m", "uvicorn", "app.main:app", "--port", "8003" -WorkingDirectory $here -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $here "backend.out.log") -RedirectStandardError (Join-Path $here "backend.err.log")
Start-Sleep -Seconds 8
$code = (curl.exe -s -o NUL -w "%{http_code}" http://localhost:8003/billing/plans)
Write-Host "Backend answered with HTTP $code (200 means it is up)." -ForegroundColor Green

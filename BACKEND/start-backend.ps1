# Starts the MAATA backend on port 8003 using THIS folder's own virtual environment (.venv),
# no matter which environment or folder your terminal is in. Run it from anywhere:
#   & "C:\Users\GEORGE\N.A.I.E - B.E\N.A.I.E.---BACKEND\start-backend.ps1"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here

$python = Join-Path $here ".venv\Scripts\python.exe"
if (-not (Test-Path $python)) {
    Write-Error "Cannot find $python. Create the environment first: python -m venv .venv ; .\.venv\Scripts\pip install -r requirements.txt"
    exit 1
}

# Port 8003 is where the frontend sends API requests. Stop early if something already uses it.
$busy = Get-NetTCPConnection -LocalPort 8003 -State Listen -ErrorAction SilentlyContinue
if ($busy) {
    Write-Host "Port 8003 is already in use (process $($busy[0].OwningProcess)). The backend is probably already running."
    Write-Host "To restart it: Stop-Process -Id $($busy[0].OwningProcess) -Force   then run this script again."
    exit 1
}

& $python -m uvicorn app.main:app --reload --port 8003

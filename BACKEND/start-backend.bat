@echo off
rem Double-click to start the MAATA backend on port 8003 with this folder's own .venv.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-backend.ps1"
pause

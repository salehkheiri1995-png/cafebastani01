@echo off
title Cafe Bastani
cd /d "%~dp0"

if not exist "backend\venv" (
    echo.
    echo  Installing Python packages...
    echo  (first time only)
    echo.
    cd /d backend
    python -m venv venv
    call venv\Scripts\activate
    python -m pip install --upgrade pip
    python -m pip install -r requirements.txt
    cd /d "%~dp0"
)

if not exist "backend\static\frontend\index.html" (
    echo.
    echo  ERROR: Frontend not built!
    echo  Run build.bat first.
    echo.
    pause
    exit /b 1
)

echo.
echo  ============================================
echo    Cafe Bastani - Starting...
echo    Browser will open...
echo  ============================================
echo.

cd /d backend
call venv\Scripts\activate
start "" http://127.0.0.1:8000
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000

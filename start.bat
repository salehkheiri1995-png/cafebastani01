@echo off
title Cafe Bastani Runner

cd /d "%~dp0"

echo Starting backend...
start "Cafe Backend" cmd /k "cd /d backend && venv\Scripts\activate && python -m uvicorn app.main:app --reload"

timeout /t 5 /nobreak >nul

echo Starting frontend...
start "Cafe Frontend" cmd /k "cd /d frontend && npm run dev"

timeout /t 6 /nobreak >nul

echo Opening browser...
start http://localhost:5173

exit
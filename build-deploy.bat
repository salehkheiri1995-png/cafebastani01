@echo off
title Cafe Bastani - Build for Deploy
cd /d "%~dp0"

echo ==========================================
echo   Cafe Bastani - Build for Deploy (Chabokan)
echo ==========================================
echo.

echo [1/3] Building frontend...
cd /d frontend
call npm install
if %errorlevel% neq 0 (
    echo ERROR: npm install failed!
    pause
    exit /b 1
)
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Frontend build failed!
    pause
    exit /b 1
)
cd /d "%~dp0"
echo       Done.
echo.

echo [2/3] Copying frontend to backend/static/frontend...
if exist "backend\static\frontend" rmdir /s /q "backend\static\frontend"
xcopy /e /i /q "frontend\dist" "backend\static\frontend" >nul
echo       Done.
echo.

echo [3/3] Git add and commit...
git add backend/static/frontend/
git add Procfile runtime.txt requirements.txt
git status
echo.
echo ==========================================
echo   Build Complete!
echo.
echo   Next steps:
echo   1. git commit -m "build: frontend for deploy"
echo   2. git push origin main
echo   3. Deploy on Chabokan
echo ==========================================
pause

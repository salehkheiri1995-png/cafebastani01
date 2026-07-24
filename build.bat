@echo off
title Cafe Bastani - Build
cd /d "%~dp0"

echo ==========================================
echo   Cafe Bastani - Build Script
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

echo [2/3] Copying frontend to backend...
if exist "backend\static\frontend" rmdir /s /q "backend\static\frontend"
xcopy /e /i /q "frontend\dist" "backend\static\frontend" >nul
echo       Done.
echo.

echo [3/3] Checking .env...
if not exist "backend\.env" (
    copy "backend\.env.example" "backend\.env" >nul
    echo       Created backend\.env
) else (
    echo       backend\.env exists.
)
echo.

echo ==========================================
echo   Build Complete!
echo   To run: start-prod.bat
echo ==========================================
pause

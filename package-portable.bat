@echo off
title Cafe Bastani - Package
cd /d "%~dp0"

echo ==========================================
echo   Cafe Bastani - Packaging
echo ==========================================
echo.

if exist "dist" rmdir /s /q "dist"
mkdir dist

echo [1/5] Building frontend...
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

echo [2/5] Copying backend...
xcopy /e /i /q "backend\app" "dist\backend\app" >nul
copy "backend\requirements.txt" "dist\backend\" >nul
mkdir "dist\backend\static\products" 2>nul
mkdir "dist\backend\static\frontend" 2>nul
xcopy /e /i /q "frontend\dist" "dist\backend\static\frontend" >nul

(
echo CASHIER_PASSWORD=cafe1234
echo ADMIN_PASSWORD=admin1234
echo SECRET_KEY=%RANDOM%%RANDOM%%RANDOM%%RANDOM%
echo TOKEN_EXPIRE_HOURS=12
echo CORS_ORIGINS=http://localhost:8000
echo IS_OPEN=true
) > "dist\backend\.env"
echo       Done.
echo.

echo [3/5] Downloading Python packages for offline install...
if not exist "packages" mkdir packages
python -m pip download -r backend\requirements.txt -d packages --python-version 3.11 --only-binary=:all: --platform win_amd64
if %errorlevel% neq 0 (
    echo       Retrying with source packages...
    python -m pip download -r backend\requirements.txt -d packages --python-version 3.11
)
echo       Done.
echo.

echo [4/5] Copying packages to dist...
xcopy /e /i /q "packages" "dist\packages" >nul
echo       Done.
echo.

echo [5/5] Copying scripts...
copy "start-prod.bat" "dist\start.bat" >nul
copy "setup-venv.bat" "dist\setup-venv.bat" >nul
echo       Done.
echo.

echo ==========================================
echo   Packaging Complete!
echo.
echo   Portable:  Run dist\start.bat
echo   Installer: Open installer.iss in Inno Setup
echo ==========================================
pause

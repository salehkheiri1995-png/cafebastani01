@echo off
title Cafe Bastani - Download Packages
cd /d "%~dp0"

echo ==========================================
echo   Downloading Python packages for offline install
echo ==========================================
echo.

if exist "packages" rmdir /s /q "packages"
mkdir packages

echo Downloading for Python 3.11 (Windows 64-bit)...
python -m pip download -r backend\requirements.txt -d packages --python-version 3.11 --only-binary=:all: --platform win_amd64
if %errorlevel% neq 0 (
    echo.
    echo Trying with source packages...
    python -m pip download -r backend\requirements.txt -d packages --python-version 3.11
)

echo.
echo ==========================================
echo   Done! Packages saved to packages/ folder
echo ==========================================
pause

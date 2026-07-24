@echo off
title Cafe Bastani - Build Offline
cd /d "%~dp0"

echo ==========================================
echo   Cafe Bastani - Offline Build
echo ==========================================
echo.

if exist "dist" rmdir /s /q "dist"
mkdir dist

echo [1/6] Checking Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python not found! Install from python.org
    pause
    exit /b 1
)
python --version
echo.

echo [2/6] Downloading Python embeddable...
curl --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: curl not found! Update Windows or install curl.
    pause
    exit /b 1
)
curl -L -o "python-embed.zip" "https://www.python.org/ftp/python/3.11.9/python-3.11.9-embed-amd64.zip"
if %errorlevel% neq 0 (
    echo ERROR: Failed to download Python!
    pause
    exit /b 1
)
echo       Extracting...
mkdir "dist\python"
tar -xf "python-embed.zip" -C "dist\python"
del "python-embed.zip"
echo       Done.
echo.

echo [3/6] Enabling pip in embedded Python...
powershell -Command "(Get-Content 'dist\python\python311._pth') -replace '#import site','import site' | Set-Content 'dist\python\python311._pth'"
curl -L -o "dist\python\get-pip.py" "https://bootstrap.pypa.io/get-pip.py"
dist\python\python.exe dist\python\get-pip.py --no-warn-script-location
if %errorlevel% neq 0 (
    echo ERROR: Failed to install pip!
    pause
    exit /b 1
)
del "dist\python\get-pip.py"
echo       Done.
echo.

echo [4/6] Building frontend...
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

echo [5/6] Copying application...
xcopy /e /i /q "backend\app" "dist\app" >nul
copy "backend\requirements.txt" "dist\" >nul
mkdir "dist\static\products" 2>nul
mkdir "dist\static\frontend" 2>nul
xcopy /e /i /q "frontend\dist" "dist\static\frontend" >nul
(
echo CASHIER_PASSWORD=cafe1234
echo ADMIN_PASSWORD=admin1234
echo SECRET_KEY=%RANDOM%%RANDOM%%RANDOM%%RANDOM%
echo TOKEN_EXPIRE_HOURS=12
echo CORS_ORIGINS=http://localhost:8000
echo IS_OPEN=true
) > "dist\.env"
echo       Done.
echo.

echo [6/6] Installing Python packages...
dist\python\python.exe -m pip install -r requirements.txt --target "dist\python\Lib\site-packages" --no-warn-script-location
if %errorlevel% neq 0 (
    echo ERROR: Failed to install packages!
    pause
    exit /b 1
)
echo       Done.
echo.

echo Creating launcher...
(
echo @echo off
echo title Cafe Bastani
echo cd /d "%%~dp0"
echo echo.
echo echo  ============================================
echo echo    Cafe Bastani - Starting...
echo echo  ============================================
echo echo.
echo start "" http://127.0.0.1:8000
echo python\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
) > "dist\start.bat"

echo ==========================================
echo   BUILD COMPLETE!
echo   dist\ folder is ready
echo   Copy it to customer laptop
echo   Run start.bat
echo ==========================================
pause

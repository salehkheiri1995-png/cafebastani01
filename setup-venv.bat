@echo off
cd /d "%~dp0backend"

echo.
echo  ============================================
echo    Cafe Bastani - Installing packages...
echo    Please wait...
echo  ============================================
echo.

python -m venv venv
if %errorlevel% neq 0 (
    echo.
    echo  ERROR: Python is not installed!
    echo  Install Python 3.11+ from python.org
    echo.
    pause
    exit /b 1
)

call venv\Scripts\activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo.
    echo  ERROR: Failed to install packages!
    echo.
    pause
    exit /b 1
)

echo.
echo  Installation complete!
echo.
pause

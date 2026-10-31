@echo off
setlocal
cd /d "%~dp0"

where py >nul 2>nul
if errorlevel 1 (
    echo Python launcher "py" not found. Install Python 3.10+ and enable Add Python to PATH.
    pause
    exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
    echo Creating Python virtual environment...
    py -m venv .venv
    if errorlevel 1 goto :error
)

echo Installing local parser dependencies...
".venv\Scripts\python.exe" -m pip install -r requirements-local.txt
if errorlevel 1 goto :error

echo Installing Playwright Chromium...
".venv\Scripts\python.exe" -m playwright install chromium
if errorlevel 1 goto :error

echo Starting RuTracker parser...
".venv\Scripts\python.exe" parser_local.py
if errorlevel 1 goto :error

echo.
echo Done.
pause
exit /b 0

:error
echo.
echo The parser exited with an error. Read the message above.
pause
exit /b 1

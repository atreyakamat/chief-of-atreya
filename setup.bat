@echo off
setlocal enabledelayedexpansion

echo.
echo ============================================
echo   CHIEF - Local AI Chief of Staff Setup
echo ============================================
echo.

echo [1/4] Installing Node.js dependencies...
call npm install
if errorlevel 1 (
    echo [!] npm install failed
    pause
    exit /b 1
)

echo.
echo [2/4] Installing Python dependencies...
python --version >nul 2>&1
if errorlevel 1 (
    echo [!] Python not found. Install Python 3.9+ from python.org
    pause
    exit /b 1
)

python -m pip install --user -r requirements.txt
if errorlevel 1 (
    echo [!] Python pip install failed
    pause
    exit /b 1
)

echo.
echo [3/4] Checking Ollama...
curl -s http://localhost:11434/api/tags >nul 2>&1
if errorlevel 1 (
    echo [!] Ollama is not running
    echo    Install from: https://ollama.com
    echo    Then run: ollama pull llama3.2
    echo.
) else (
    echo [+] Ollama is running
)

echo.
echo [4/4] Environment setup...
if not exist .env (
    copy .env.example .env
    echo [+] Created .env file - edit it to configure
) else (
    echo [+] .env already exists
)

echo.
echo ============================================
echo   Setup Complete!
echo ============================================
echo.
echo NEXT STEPS:
echo   1. Install Ollama from https://ollama.com
echo   2. Run: ollama pull llama3.2
echo   3. Run: ollama serve
echo   4. Start Chrome with: chrome --remote-debugging-port=9222
echo   5. Run: npm start
echo   6. Open: http://localhost:3000
echo.
echo For auto-start on Windows, see Task Scheduler
echo ============================================
pause

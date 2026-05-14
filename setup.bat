@echo off
echo [Zen Setup] Starting deployment on Windows...

:: 1. Verify Node
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [Error] Node.js not found. Please install LTS version.
    exit /b 1
)

:: 2. Verify Python
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [Error] Python not found. Please ensure it is in your PATH.
    exit /b 1
)

:: 3. Install NPM dependencies
echo [Zen Setup] Installing dependencies...
call npm install --silent

:: 4. Install Python dependencies
echo [Zen Setup] Installing Python dependencies...
call pip install --user openwakeword numpy pyautogui

:: 5. Initialize Database
echo [Zen Setup] Initializing database...
if not exist db\chief.db (
    echo Creating empty database...
    type nul > db\chief.db
)

echo [Zen Setup] Success! You can now run "npm start".
pause

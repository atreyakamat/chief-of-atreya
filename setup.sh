#!/bin/bash
echo "[Zen Setup] Starting deployment..."

# 1. Verify Node
if ! command -v node &> /dev/null; then
    echo "[Error] Node.js not found."
    exit 1
fi

# 2. Verify Python
if ! command -v python3 &> /dev/null; then
    echo "[Error] Python3 not found."
    exit 1
fi

# 3. Install NPM dependencies
echo "[Zen Setup] Installing dependencies..."
npm install --silent

# 4. Install Python dependencies
echo "[Zen Setup] Installing Python dependencies..."
pip3 install --user openwakeword numpy pyautogui

# 5. Initialize Database
if [ ! -f "db/chief.db" ]; then
    touch db/chief.db
fi

echo "[Zen Setup] Success! Run 'npm start' to begin."

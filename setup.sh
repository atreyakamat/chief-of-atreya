#!/bin/bash
set -e

echo "⚡ CHIEF — Setup Script"
echo "=================================="

# Detect OS
OS=$(uname -s)

# ─── Install System Dependencies ───
echo "[1/5] Installing system dependencies..."

if [[ "$OS" == "Darwin" ]]; then
    # macOS
    which brew >/dev/null 2>&1 && brew install node python3 portaudio ffmpeg || \
        echo "Install Homebrew: https://brew.sh"
elif [[ "$OS" == "Linux" ]]; then
    # Linux - detect package manager
    if command -v apt-get &> /dev/null; then
        sudo apt-get update
        sudo apt-get install -y nodejs npm python3 python3-pip portaudio19-headers ffmpeg libnotify-bin sqlite3
    elif command -v pacman &> /dev/null; then
        sudo pacman -S --needed nodejs npm python python-pip portaudio ffmpeg libnotify sqlite
    elif command -v dnf &> /dev/null; then
        sudo dnf install -y nodejs npm python3 python3-pip portaudio ffmpeg libnotify sqlite
    fi
fi

echo "[2/5] Installing Ollama..."
if ! command -v ollama &> /dev/null; then
    curl -fsSL https://ollama.com/install.sh | sh
else
    echo "[+] Ollama already installed"
fi

echo ""
echo "[3/5] Pulling AI model (llama3.2)..."
ollama pull llama3.2 2>/dev/null || echo "[!] Ollama not running - run 'ollama serve' after setup"

echo "[4/5] Installing Node.js dependencies..."
npm install

echo "[5/5] Installing Python dependencies..."
pip3 install --user --break-system-packages -r requirements.txt 2>/dev/null || \
    pip3 install --user -r requirements.txt

echo ""
echo "=================================="
echo "✓ Setup complete!"
echo ""
echo "NEXT STEPS:"
echo "  1. Run Ollama: ollama serve"
echo "  2. Start Chrome with --remote-debugging-port=9222"
echo "  3. Run CHIEF: npm start"
echo "  4. Open http://localhost:3000"
echo ""
echo "Optional - Enable auto-start:"
echo "  - Windows: Use Task Scheduler"
echo "  - macOS: launchctl"
echo "  - Linux: systemctl --user"
echo "=================================="

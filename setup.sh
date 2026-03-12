#!/bin/bash
# ═══════════════════════════════════════════════════════
# CHIEF — Setup Script for Omarchy / Arch Linux
# ═══════════════════════════════════════════════════════

set -e

echo "⚡ CHIEF — Arch Linux Setup"
echo "═══════════════════════════════════════"
echo ""

# ─── System Dependencies via pacman ───
echo "[1/4] Installing system dependencies via pacman..."
sudo pacman -S --needed --noconfirm \
    nodejs npm \
    python python-pip \
    portaudio \
    libnotify \
    espeak-ng \
    ffmpeg \
    sqlite

echo ""

# ─── Node.js Dependencies ───
echo "[2/4] Installing Node.js dependencies..."
npm install

echo ""

# ─── Python Dependencies ───
echo "[3/4] Installing Python dependencies..."
pip install --user --break-system-packages -r requirements.txt 2>/dev/null || \
pip install --user -r requirements.txt

echo ""

# ─── .env Setup ───
if [ ! -f .env ]; then
    echo "[4/4] Creating .env from template..."
    cp .env.example .env
    echo "  → Edit .env and add your ANTHROPIC_API_KEY"
else
    echo "[4/4] .env already exists, skipping."
fi

echo ""
echo "═══════════════════════════════════════"
echo "✓ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Edit .env and add your ANTHROPIC_API_KEY"
echo "  2. Start Chrome/Chromium with: chromium --remote-debugging-port=9222"
echo "  3. Run CHIEF with: npm start"
echo "  4. Open http://localhost:3000"
echo ""
echo "Optional: Install systemd service for auto-start:"
echo "  sudo cp chief.service /etc/systemd/system/"
echo "  sudo systemctl enable --now chief"
echo "═══════════════════════════════════════"

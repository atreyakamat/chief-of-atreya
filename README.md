# ⚡ CHIEF — Local AI Chief of Staff

> A privacy-first AI desktop assistant that monitors your browser, manages reminders, tracks notifications, and responds to voice — all running locally on your machine.

## Features

- **🌐 Browser Orchestration** — Tracks Chromium tabs via CDP, detects distractions, monitors focus time
- **⏰ Smart Reminders** — Natural language creation, recurring support, context-aware nudges
- **🔔 Notification Intelligence** — Intercepts desktop notifications via dbus-monitor, logs and classifies urgency
- **🎙️ Voice Interface** — Wake word detection, local Whisper transcription, espeak-ng/pyttsx3 TTS
- **🧠 Claude AI Brain** — Anthropic's Claude with tool_use for full context-aware actions
- **🛡️ Privacy First** — Everything runs on localhost with a local SQLite database

---

## Prerequisites

- **Arch Linux / Omarchy** (primary target)
- Node.js 18+
- Python 3.9+
- Chromium browser

## Quick Start (Arch / Omarchy)

### 1. Clone and setup

```bash
git clone <your-repo-url> ~/chief
cd ~/chief
chmod +x setup.sh
./setup.sh
```

The setup script installs all dependencies via `pacman`:
- `nodejs`, `npm`, `python`, `python-pip`
- `portaudio` (for microphone access)
- `libnotify` (for `notify-send`)
- `espeak-ng` (offline text-to-speech)
- `ffmpeg` (audio processing for Whisper)
- `sqlite`

### 2. Configure API key

```bash
# Edit .env and add your Anthropic API key
nano .env
```

```env
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

### 3. Launch Chromium with remote debugging

```bash
chromium --remote-debugging-port=9222 &
```

### 4. Start CHIEF

```bash
npm start
```

Then open **http://localhost:3000** in your browser.

---

## Auto-Start with systemd (Arch / Omarchy)

### User Service (recommended)

```bash
# Copy the service file
mkdir -p ~/.config/systemd/user/
cp chief.service ~/.config/systemd/user/

# Edit WorkingDirectory to match your install path
nano ~/.config/systemd/user/chief.service

# Enable and start
systemctl --user enable chief
systemctl --user start chief

# Check status
systemctl --user status chief

# View logs
journalctl --user -u chief -f
```

---

## Architecture

```
chief/
├── index.js              # Main orchestrator + Express server
├── modules/
│   ├── browser.js        # Chromium CDP monitor
│   ├── notifications.js  # Linux dbus-monitor + notify-send
│   ├── reminders.js      # SQLite CRUD reminder engine
│   ├── voice.js          # Node.js ↔ Python voice bridge
│   ├── voice_engine.py   # Whisper STT + espeak-ng TTS
│   └── claude.js         # Anthropic Claude API + tool_use
├── ui/
│   ├── index.html        # Landing page + Dashboard
│   ├── style.css         # Design system
│   └── script.js         # Dashboard logic
├── db/
│   ├── schema.sql        # SQLite schema
│   └── index.js          # DB connection
├── chief.service         # systemd service file
├── setup.sh              # Arch Linux setup script
├── .env                  # API keys (create from .env.example)
└── package.json          # Node dependencies
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js + Python |
| AI | Anthropic Claude (claude-sonnet-4-20250514) |
| Database | SQLite (better-sqlite3) |
| Browser | Chrome DevTools Protocol (chrome-remote-interface) |
| Notifications | libnotify / dbus-monitor |
| Voice STT | OpenAI Whisper (local) |
| Voice TTS | espeak-ng / pyttsx3 |
| UI | Vanilla HTML/CSS/JS |
| Auto-start | systemd user service |

## Keyboard Shortcuts

- **Ctrl+Space** — Push-to-talk (voice command input)
- **Enter** — Submit command in dashboard

## Graceful Degradation

CHIEF works even if optional components aren't available:

| Component | Status if Missing |
|-----------|------------------|
| Anthropic API Key | Chat commands disabled, dashboard still works |
| Chromium CDP | Browser panel shows "No connection" |
| Python/Whisper | Voice input unavailable, TTS falls back to espeak-ng |
| dbus-monitor | Notification interception off, CHIEF-generated notifs still logged |

# ⚡ CHIEF — Local AI Chief of Staff

A privacy-first AI desktop assistant powered entirely by Ollama.

## Features

- **🧠 AI Brain** — Powered by Ollama (100% local, privacy-first)
- **🎯 Skills** — calculator, system_info, code_runner, open_app, and more
- **💬 Channels** — general, work, quick — different contexts
- **🌐 Browser** — Track tabs, detect distractions
- **⏰ Reminders** — Natural language, recurring
- **🎙️ Voice** — "Hey Chief" wake word, local Whisper

---

## Quick Start

### Prerequisites

| Requirement | Windows | macOS | Linux |
|-------------|---------|-------|-------|
| Node.js 18+ | ✅ | ✅ | ✅ |
| Python 3.9+ | ✅ | ✅ | ✅ |
| Ollama | ✅ | ✅ | ✅ |
| Chrome | ✅ | ✅ | ✅ |

### Step 1: Install Ollama

```bash
# Install from https://ollama.com
# OR on Linux:
curl -fsSL https://ollama.com/install.sh | sh

# Pull a model
ollama pull llama3.2
ollama serve
```

### Step 2: Setup

```cmd
# Windows
setup.bat

# macOS/Linux
chmod +x setup.sh
./setup.sh
```

### Step 3: Start Chrome

```bash
chrome --remote-debugging-port=9222
```

### Step 4: Run

```bash
npm start
```

Open **http://localhost:3000**

---

## AI Model Selection

In the dashboard, use the dropdown to switch between Ollama models:

- **Ollama (Local)** — llama3.2, mistral, codellama, etc.

Set your preference in `.env`:

```env
AI_PROVIDER=ollama
OLLAMA_MODEL=llama3.2
```

---

## Skills

Built-in skills:
- `calculator` — Perform calculations
- `system_info` — Get system information
- `code_runner` — Execute code snippets
- `open_app` — Open applications
- `run_command` — Run shell commands
- `web_search` — Search the web

Click a skill in the sidebar to use it.

---

## Channels

- **#general** — All skills available
- **work** — Work-focused skills
- **quick** — Quick commands only

Switch channels using the dropdown in the header.

---

## Voice Commands

- **Wake word**: "Hey Chief" or "Okay Chief"
- **Push-to-talk**: Ctrl+Space
- Say commands naturally!

---

## Configuration

```env
AI_PROVIDER=ollama
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3.2
PORT=3000
```

---

## Architecture

```
chief/
├── index.js              # Main server
├── modules/
│   ├── browser.js        # CDP monitor
│   ├── notifications.js  # OS notifications
│   ├── reminders.js      # SQLite reminders
│   ├── voice.js          # Voice bridge
│   ├── voice_engine.py   # Whisper + TTS
│   ├── ai.js             # AI (Ollama)
│   └── skills.js         # Skills system
├── ui/
│   ├── index.html        # Dashboard
│   ├── style.css
│   └── script.js
└── db/
    ├── schema.sql
    └── index.js
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js + Python |
| AI | Ollama |
| Database | SQLite |
| Voice | Faster-Whisper + pyttsx3 |
| UI | Vanilla HTML/CSS/JS |

---

## License

MIT

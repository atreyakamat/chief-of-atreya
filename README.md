# ⚡ Zen Agent: The Ultimate Personal Jarvis

Welcome to **Zen**. Your system is a Multi-Agent Supervisor tailored for your Ryzen 5700G. It runs natively as a Windows application, consumes zero idle CPU/VRAM, and operates completely free.

## Step 1: Initial Installation
Because we built robust cross-platform setup scripts, installation is fully automated.

1. **Open your terminal** in the project folder (`C:\Projects\chief-of-atreya`).
2. **Download Supertonic TTS:** Because Supertonic is a standalone highly-optimized engine, you need to clone it directly into the project root:
   ```bash
   git clone https://github.com/supertone-inc/supertonic.git supertonic
   cd supertonic
   npm install
   cd ..
   ```
3. **Run the Setup Script:** 
   Double-click `setup.bat` in your file explorer, or run it in the terminal:
   ```bash
   setup.bat
   ```
   *This will verify Node/Python, install all NPM packages, install Python dependencies (PyAutoGUI, OpenWakeWord), and create your empty `chief.db` database.*

## Step 2: Configuration (`.env`)
Zen is highly modular. It only turns on the features you provide keys for, saving massive amounts of RAM.

1. Rename the `.env.example` file to `.env`.
2. **Set your AI Brain (100% Free):**
   ```env
   AI_PROVIDER=openrouter
   OPENROUTER_API_KEY=your_free_key_from_openrouter_ai
   OPENROUTER_MODEL=meta-llama/llama-3-8b-instruct:free
   ```
3. **Configure Supertonic TTS:** Ensure `TTS_ENGINE=supertonic` is set in the file.
4. **Configure Home Lab:** Add your server IP, username, and SSH key path so Zen can access your lab.
5. **Configure Emails/Socials:** Add your IMAP/SMTP app passwords, Discord tokens, etc., for whatever you want Zen to manage. Leave the rest commented out or blank!

## Step 3: Launching Zen
1. In your terminal, run:
   ```bash
   npm start
   ```
2. **The Electron App:** Zen will launch invisibly in the background. It now lives in your system tray.
3. **The Magic Hotkey:** Press **`Ctrl + Space`** at any time, over any app or game, and your sleek transparent Zen Dashboard will pop up. Press it again to hide it.

---

## Step 4: How to Use Your Agent

### 🗣️ Voice & Wake Word
*   **How it works:** Zen’s Python bridge is always listening locally (zero API cost). 
*   **Action:** Just say **"Hey Zen"**. 
*   Zen will pause its TTS, reply *"Yes, how can I help?"*, and pop open the dashboard automatically. You can then speak your command naturally.

### 📸 Photographic Memory & OCR
*   **Action:** Press **`Alt + S`**.
*   **How it works:** Zen takes an instant screenshot. In the background, it runs local Tesseract OCR and saves the text to its semantic RAG memory.
*   **Usage:** Later, you can ask, *"Zen, what was the code snippet I was looking at 2 hours ago?"* Zen will query its RAG memory and tell you.

### ⏱️ Work Management & Health
*   **Action:** Say or type: *"Zen, clock me in for deep work."*
*   **How it works:** Zen starts your time tracker. Because you are now "clocked in," Zen will activate the **Water Drinker Loop** and verbally remind you to hydrate every 60 minutes.
*   **Action:** Say *"Clock out, I finished the API setup."* Zen logs the duration and notes in the database and mutes the health reminders so you can game in peace.

### 🏢 Multi-Agent Delegation
*   **Action:** Give Zen a massive command: *"Zen, research the latest React 19 changes on Reddit and write a summary script."*
*   **How it works:** Zen realizes this is too big for a single prompt. It will reply, *"Delegating task to Researcher..."* 
*   In the background, a specialized `researcher.js` sub-agent spins up, browses Reddit, formats a report, and pushes a Windows notification when done.

### 💻 Deep OS & Home Lab Control
*   **Computer Use:** Tell Zen, *"Open Spotify and type 'Jazz'."* Zen will physically move your mouse and use your keyboard via PyAutoGUI.
*   **Home Lab:** Tell Zen, *"Check the disk space on my home lab server."* Zen will securely SSH into your server, run `df -h`, and read the results back to you.

### 🛡️ The "Human-in-the-Loop" (HITL) Command Center
*   **How it works:** If you get a WhatsApp message or an email, Zen will automatically read it and generate a draft reply. 
*   **Safety First:** Zen will **never** send it automatically. It goes into the `pending_review` queue. Open your dashboard (`Ctrl+Space`), review what Zen wrote, and click **Approve**. Only then will it send.

---

## Step 5: Troubleshooting & Best Practices
*   **"WhatsApp isn't syncing!"** Look at the terminal where you ran `npm start`. On the very first run, WhatsApp Web requires you to scan a QR code in the terminal using your phone.
*   **"Supertonic isn't speaking!"** Ensure you actually cloned the `supertone-inc/supertonic` repo into the folder and ran `npm install` inside it, as it relies on ONNX Runtime binaries.
*   **"It's taking up too much CPU!"** Ensure `AI_PROVIDER` is set to `openrouter` or `groq`, not `ollama`. If Ollama is running, it will eat up your VRAM. Cloud providers keep your PC resources free for gaming.
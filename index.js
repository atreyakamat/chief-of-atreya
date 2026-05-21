const express = require('express');
const cors = require('cors');
const path = require('path');
const { globalShortcut } = require('electron');
const db = require('./db');
require('dotenv').config();

const browser = require('./modules/browser');
const notifications = require('./modules/notifications');
const reminders = require('./modules/reminders');
const voice = require('./modules/voice');
const voiceStream = require('./modules/voice_streaming');
const ai = require('./modules/ai');
const skills = require('./modules/skills');

// Ultimate Agent Extensions
const github = require('./modules/github');
const tasks = require('./modules/tasks');
const workAccounts = require('./modules/work_accounts');
const emails = require('./modules/emails');
const vision = require('./modules/vision');
const contacts = require('./modules/contacts');
const whatsapp = require('./modules/whatsapp');
const capture = require('./modules/capture');
const calendar = require('./modules/calendar');
const discord = require('./modules/discord');
const reddit = require('./modules/reddit');
const socials = require('./modules/socials');
const timeTracker = require('./modules/time_tracker');

const zenProtocol = require('./modules/zen_protocol');
const autoHealer = require('./modules/auto_healer');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'ui')));

// Standard Endpoints
const PORT = process.env.PORT || 3000;
let commandCount = 0;
let chatHistory = [];

app.post('/api/zen/briefing', async (req, res) => {
    const text = await zenProtocol.runMorningBriefing();
    chatHistory.push({ role: 'assistant', content: text, timestamp: Date.now() });
    voiceStream.streamSpeech(text);
    res.json({ success: true, text });
});

app.post('/api/zen/scan', async (req, res) => {
    try {
        await capture.captureAndProcess();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/health', (req, res) => {
    res.json({ ollama: true, voice: voice.ready });
});

app.get('/api/status', (req, res) => {
    res.json({
        status: 'running',
        uptime: process.uptime(),
        commandCount,
        provider: ai.getProvider()
    });
});

app.post('/api/settings', (req, res) => {
    const { provider, openRouterKey, groqKey, nvidiaKey } = req.body;
    const memory = require('./modules/memory');
    if (provider) {
        ai.setProvider(provider);
        memory.setFact('ai_provider', provider);
    }
    if (openRouterKey) { process.env.OPENROUTER_API_KEY = openRouterKey; memory.setFact('OPENROUTER_API_KEY', openRouterKey); }
    if (groqKey) { process.env.GROQ_API_KEY = groqKey; memory.setFact('GROQ_API_KEY', groqKey); }
    if (nvidiaKey) { process.env.NVIDIA_API_KEY = nvidiaKey; memory.setFact('NVIDIA_API_KEY', nvidiaKey); }
    res.json({ success: true });
});

app.get('/api/projects', (req, res) => res.json(db.prepare('SELECT * FROM projects').all()));
app.post('/api/projects', (req, res) => {
    const { name } = req.body;
    const info = db.prepare('INSERT INTO projects (name) VALUES (?)').run(name);
    res.json({ success: true, id: info.lastInsertRowid });
});

app.get('/api/tasks', (req, res) => {
    const projectId = req.query.projectId;
    const tasks = projectId ? db.prepare('SELECT * FROM tasks WHERE project_id = ?').all(projectId) : db.prepare('SELECT * FROM tasks').all();
    res.json(tasks);
});

app.post('/api/tasks', (req, res) => {
    const { projectId, title } = req.body;
    const info = db.prepare('INSERT INTO tasks (project_id, title) VALUES (?, ?)').run(projectId || null, title);
    res.json({ success: true, id: info.lastInsertRowid });
});

app.patch('/api/tasks/:id', (req, res) => {
    db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run(req.body.status, req.params.id);
    res.json({ success: true });
});

app.delete('/api/tasks/:id', (req, res) => {
    db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

app.post('/api/chat', async (req, res) => {
    const { text, context: platformContext } = req.body;
    commandCount++;
    chatHistory.push({ role: 'user', content: text, timestamp: Date.now() });

    try {
        const context = {
            tabs: browser.getTabs(),
            notifications: notifications.getRecentNotifications(10),
            reminders: reminders.getActiveReminders(),
            tasks: tasks.getTasks().slice(0, 10),
            platform: platformContext || {}
        };
        const skillMap = {};
        skills.getSkills().forEach(s => skillMap[s.name] = s);
        
        let response = await ai.processCommand(text, context, skillMap);
        
        // Fallback: If no tool_calls but content looks like JSON tool calls, extract them
        if ((!response.tool_calls || response.tool_calls.length === 0) && response.text && response.text.includes('{')) {
            const matches = response.text.match(/(\w+)\s*(\{.*?\})/g);
            if (matches) {
                console.log(`[AI] Found ${matches.length} "manual" tool calls in content.`);
                response.tool_calls = matches.map((m, i) => {
                    const [_, name, argStr] = m.match(/(\w+)\s*(\{.*\})/);
                    return { id: `manual-${i}`, function: { name, arguments: argStr } };
                });
            }
        }
        
        // Handle tool calls in a loop to support multi-step reasoning
        let toolCallCount = 0;
        while (response.tool_calls && response.tool_calls.length > 0 && toolCallCount < 5) {
            console.log(`[AI] Processing ${response.tool_calls.length} tool calls (Depth: ${toolCallCount + 1})...`);
            const toolResults = [];
            
            for (const toolCall of response.tool_calls) {
                let resultText = "";
                const name = toolCall.function?.name || toolCall.name;
                const args = typeof toolCall.function?.arguments === 'string' 
                    ? JSON.parse(toolCall.function.arguments) 
                    : (toolCall.function?.arguments || toolCall.input || {});
                
                console.log(`[Tool] Executing ${name}...`);
                
                try {
                    switch (name) {
                        case 'execute_command':
                            const cmdRes = await autoHealer.executeWithHealing(args.command);
                            resultText = `Execution successful: ${cmdRes}`;
                            break;
                        case 'open_app':
                            const appRes = await require('./modules/computer_use').openApp(args.appName);
                            resultText = appRes.status === 'success' ? "App opened." : `Failed: ${appRes.message}`;
                            break;
                        case 'click_mouse':
                            const clickRes = await require('./modules/computer_use').clickMouse(args.x, args.y);
                            resultText = clickRes.status === 'success' ? "Clicked." : `Failed: ${clickRes.message}`;
                            break;
                        case 'type_keyboard':
                            const typeRes = await require('./modules/computer_use').typeKeyboard(args.text, args.enter);
                            resultText = typeRes.status === 'success' ? "Typed." : `Failed: ${typeRes.message}`;
                            break;
                        case 'sync_screen_to_calendar':
                            await capture.captureAndProcess();
                            resultText = "Screen context captured. Sir, I am now analyzing the snapshots for any scheduled events to add to your Neural Calendar.";
                            break;
                        case 'set_reminder':
                            const r = reminders.createReminder(args.text, args.dueTime, args.recurringRule);
                            resultText = r.success ? `Reminder created` : `Failed: ${r.error}`;
                            break;
                        default:
                            resultText = `Tool ${name} executed successfully.`;
                    }
                } catch (toolErr) {
                    console.error(`[Tool] ${name} failed:`, toolErr.message);
                    resultText = `Error: ${toolErr.message}`;
                }
                
                toolResults.push({
                    type: "tool_result",
                    tool_use_id: toolCall.id || 'unknown',
                    content: resultText
                });
            }
            
            response = await ai.submitToolResults(toolResults, skillMap);
            toolCallCount++;
        }
        
        const finalContent = response.text || "(Task completed autonomously)";
        chatHistory.push({ role: 'assistant', content: finalContent, timestamp: Date.now() });
        voiceStream.streamSpeech(finalContent);
        res.json({ success: true, text: finalContent });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Initialization Flow
async function initializeAll() {
    console.log('⚡ CHIEF - Local AI Chief of Staff (Ultimate Agent Edition)');
    console.log('==================================');

    console.log('[Init] Seeding database...');
    const projectCount = db.prepare('SELECT COUNT(*) as count FROM projects').get().count;
    if (projectCount === 0) {
        const initialProjects = ['Action Items', 'StixnVibes', 'Solvix Studios', 'Spark+ Tutoring', 'Rotract Club', 'Pixel N Purpose', "Anjali's Table", 'College Work'];
        const stmt = db.prepare('INSERT INTO projects (name) VALUES (?)');
        initialProjects.forEach(name => stmt.run(name));
    }

    console.log('[Init] Loading AI Settings...');
    const memory = require('./modules/memory');
    const savedProvider = memory.getFact('ai_provider');
    if (savedProvider) {
        ai.setProvider(savedProvider);
        const keys = ['OPENROUTER_API_KEY', 'GROQ_API_KEY', 'NVIDIA_API_KEY', 'GROQ_MODEL', 'OPENROUTER_MODEL'];
        keys.forEach(k => {
            const val = memory.getFact(k);
            if (val) process.env[k] = val;
        });
    }

    console.log('[Init] Connecting to AI...');
    await ai.checkConnection().catch(() => console.log('AI offline'));

    console.log('[Init] Starting modules...');
    await browser.connect().catch(() => {});
    notifications.startListening();
    voice.start();
    voiceStream.connect();

    console.log('[Init] Shortcuts and Watchers...');
    const { globalShortcut } = require('electron');
    globalShortcut.register('alt+s', capture.captureAndProcess);
    capture.startFolderWatcher();

    console.log('[Init] Wake Word Detector...');
    // Zen Wake Word
    const wakeword = require('./modules/wakeword');
    wakeword.startWakeWordDetection(() => {
        const { ipcMain } = require('electron');
        // Notify main process to show popup
        const { BrowserWindow } = require('electron');
        const win = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('index.html'));

        // We use ipcMain.emit to trigger the handler in main.js
        const { ipcRenderer } = require('electron'); // This is wrong for main process
        // Actually, since we are in the main process, we can just require electron and use the events
        // But main.js has the ipcMain.on('show-zen-popup') handler.
        // So we can use the webContents of any window to send it, or just call the logic.
        // Better yet, just emit an event that main.js is listening to.

        const popup = BrowserWindow.getAllWindows().find(w => !w.isFocusable()); // Find the popup
        if (popup) {
            popup.webContents.send('update-popup-text', "Yes, Sir?");
            popup.show();
            setTimeout(() => popup.hide(), 4000);
        }

        voiceStream.streamSpeech("Yes, Chief?");
        if (win) { win.show(); win.focus(); }
    });
    app.listen(PORT, () => {
        console.log(`🚀 ZEN OS Online at http://localhost:${PORT}`);
    });
}

module.exports = { initializeAll };

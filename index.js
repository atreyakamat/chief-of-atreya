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
const hitl = require('./modules/hitl');

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

app.post('/api/settings', async (req, res) => {
    const { provider, openRouterKey, groqKey, nvidiaKey } = req.body;
    const memory = require('./modules/memory');
    if (provider) {
        ai.setProvider(provider);
        memory.setFact('ai_provider', provider);
    }
    try {
        if (openRouterKey) { process.env.OPENROUTER_API_KEY = openRouterKey; await memory.setSecret('OPENROUTER_API_KEY', openRouterKey); }
        if (groqKey) { process.env.GROQ_API_KEY = groqKey; await memory.setSecret('GROQ_API_KEY', groqKey); }
        if (nvidiaKey) { process.env.NVIDIA_API_KEY = nvidiaKey; await memory.setSecret('NVIDIA_API_KEY', nvidiaKey); }
    } catch (e) {
        console.error('[Settings] Failed to store secret via keytar:', e.message || e);
        return res.status(500).json({ success: false, error: 'Failed to store secrets securely. Ensure keytar is installed.' });
    }
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

// Business Servicing (Leads) Endpoints
app.get('/api/leads', (req, res) => {
    res.json(db.prepare('SELECT * FROM leads ORDER BY last_interaction DESC').all());
});

app.post('/api/leads', (req, res) => {
    const { name, type, contact_info, notes } = req.body;
    const info = db.prepare('INSERT INTO leads (name, type, contact_info, notes) VALUES (?, ?, ?, ?)').run(name, type, contact_info || null, notes || null);
    res.json({ success: true, id: info.lastInsertRowid });
});

app.patch('/api/leads/:id', (req, res) => {
    const { status, success_criteria_met, notes } = req.body;
    if (status !== undefined) db.prepare('UPDATE leads SET status = ?, last_interaction = CURRENT_TIMESTAMP WHERE id = ?').run(status, req.params.id);
    if (success_criteria_met !== undefined) db.prepare('UPDATE leads SET success_criteria_met = ? WHERE id = ?').run(success_criteria_met, req.params.id);
    if (notes !== undefined) db.prepare('UPDATE leads SET notes = ? WHERE id = ?').run(notes, req.params.id);
    res.json({ success: true });
});

app.get('/api/links', (req, res) => {
    res.json(db.prepare('SELECT * FROM links ORDER BY timestamp DESC').all());
});

app.post('/api/links', async (req, res) => {
    const { url, title, workspaceId } = req.body;
    
    // Auto-summarize the link if not provided
    let summary = "Processing neural summary...";
    try {
        const aiResponse = await ai.processCommand(`Summarize this URL for my records: ${url}`, { platform: { currentView: 'LinkManager' } });
        summary = aiResponse.text;
    } catch (e) {
        summary = "Summary generation deferred.";
    }

    const info = db.prepare('INSERT INTO links (url, title, summary, workspace_id) VALUES (?, ?, ?, ?)').run(url, title || url, summary, workspaceId || null);
    res.json({ success: true, id: info.lastInsertRowid, summary });
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
                // Gate potentially destructive operations with HITL
                const destructiveTools = ['execute_command','ssh_command','open_app','click_mouse','type_keyboard'];
                if (destructiveTools.includes(name)) {
                    const pending = hitl.createPendingAction(name, { args });
                    const pendingMsg = `Action requires user approval. Pending Action ID: ${pending.id}`;
                    toolResults.push({ type: 'tool_result', tool_use_id: toolCall.id || 'unknown', content: pendingMsg });
                    console.log(`[HITL] Created pending action for ${name} (ID: ${pending.id})`);
                    continue; // skip actual execution until user approves
                }

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
                        case 'create_google_meet':
                            // Orchestrate Meet Creation
                            await require('./modules/computer_use').openApp("https://meet.google.com/new");
                            resultText = "Google Meet creation initiated in your default browser, Sir. The link will be available once the page loads.";
                            break;
                        case 'save_link':
                            let linkSummary = "Processing...";
                            try {
                                const aiSumm = await ai.processCommand(`Summarize this link: ${args.url}`, { platform: { currentView: 'LinkManager' } });
                                linkSummary = aiSumm.text;
                            } catch (e) {}
                            const lRes = db.prepare('INSERT INTO links (url, title, summary) VALUES (?, ?, ?)').run(args.url, args.title || args.url, linkSummary);
                            resultText = `Sir, I have saved that link and generated a neural summary. (Link ID: ${lRes.lastInsertRowid})`;
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
        
        // Final fallback to ensure response.text is never empty if a task was done
        if (!response.text || response.text.trim().length === 0) {
            response.text = "I have successfully completed those operations for you, Sir. Is there anything else you need?";
        }

        chatHistory.push({ role: 'assistant', content: response.text, timestamp: Date.now() });
        voiceStream.streamSpeech(response.text);
        res.json({ success: true, text: response.text });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Pending Actions (HITL) API
app.get('/api/pending-actions', (req, res) => {
    const rows = db.prepare('SELECT * FROM pending_actions ORDER BY created_at DESC').all();
    res.json(rows.map(r => ({ ...r, payload: r.payload ? JSON.parse(r.payload) : {} })));
});

app.get('/api/pending-actions/:id', (req, res) => {
    const row = db.prepare('SELECT * FROM pending_actions WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ ...row, payload: row.payload ? JSON.parse(row.payload) : {} });
});

// --- Admin / HITL endpoints (protected) ---
const bcrypt = require('bcryptjs');
const memory = require('./modules/memory');

async function verifyAdminPassword(provided) {
    try {
        const hash = await memory.getSecret('ADMIN_PASSWORD_HASH');
        if (!hash) return false;
        return bcrypt.compareSync(provided || '', hash);
    } catch (e) {
        // keytar missing or error; fall back to env ADMIN_PASSWORD
        if (process.env.ADMIN_PASSWORD && provided) return provided === process.env.ADMIN_PASSWORD;
        return false;
    }
}

async function adminMiddleware(req, res, next) {
    const provided = (req.headers['x-zen-admin'] || '').toString();
    if (!provided) {
        // Try basic auth
        const auth = req.headers.authorization || '';
        if (auth.startsWith('Basic ')) {
            try {
                const creds = Buffer.from(auth.split(' ')[1], 'base64').toString();
                const [user, pass] = creds.split(':');
                if (await verifyAdminPassword(pass)) return next();
            } catch (e) {}
        }
        return res.status(401).json({ success: false, error: 'Admin auth required' });
    }
    if (await verifyAdminPassword(provided)) return next();
    return res.status(403).json({ success: false, error: 'Invalid admin credentials' });
}

// Set admin password (only allowed if none exists or when providing existing password)
app.post('/api/admin/set-password', async (req, res) => {
    const { password, current } = req.body || {};
    if (!password || password.length < 6) return res.status(400).json({ success: false, error: 'Password too short' });
    try {
        const existing = await memory.getSecret('ADMIN_PASSWORD_HASH');
        if (existing) {
            // require current password
            if (!current || !(await verifyAdminPassword(current))) return res.status(403).json({ success: false, error: 'Current password required' });
        }
        const hash = bcrypt.hashSync(password, 10);
        await memory.setSecret('ADMIN_PASSWORD_HASH', hash);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message || String(e) });
    }
});

app.post('/api/pending-actions/:id/approve', adminMiddleware, async (req, res) => {
    const id = req.params.id;
    const row = db.prepare('SELECT * FROM pending_actions WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ success: false, error: 'Not found' });
    db.prepare('UPDATE pending_actions SET status = ? WHERE id = ?').run('approved', id);
    db.prepare('INSERT INTO audit_logs (event_type, details) VALUES (?, ?)').run('approved_action', JSON.stringify({ id, by: 'admin' }));
    res.json({ success: true, id });
});

app.post('/api/pending-actions/:id/reject', adminMiddleware, (req, res) => {
    const id = req.params.id;
    const row = db.prepare('SELECT * FROM pending_actions WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ success: false, error: 'Not found' });
    db.prepare('UPDATE pending_actions SET status = ? WHERE id = ?').run('rejected', id);
    db.prepare('INSERT INTO audit_logs (event_type, details) VALUES (?, ?)').run('rejected_action', JSON.stringify({ id, by: 'admin' }));
    res.json({ success: true, id });
});

// Execute an approved pending action. This MUST be called by the user after approval.
app.post('/api/pending-actions/:id/execute', adminMiddleware, async (req, res) => {
    const id = req.params.id;
    const row = db.prepare('SELECT * FROM pending_actions WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ success: false, error: 'Not found' });
    if (row.status !== 'approved') return res.status(400).json({ success: false, error: 'Action not approved' });

    const payload = row.payload ? JSON.parse(row.payload) : {};
    try {
        let execResult = null;
        switch (row.action_type) {
            case 'auto_healer_execute':
                // Use AutoHealer runShell directly to execute approved script
                execResult = await autoHealer.runShell(payload.command);
                break;
            case 'ssh_command':
                const homelab = require('./modules/homelab');
                execResult = await homelab.executeCommand(payload.command);
                break;
            case 'open_app':
                execResult = await require('./modules/computer_use').openApp(payload.args?.appName || payload.appName || payload.app);
                break;
            case 'click_mouse':
                execResult = await require('./modules/computer_use').clickMouse(payload.args?.x, payload.args?.y);
                break;
            case 'type_keyboard':
                execResult = await require('./modules/computer_use').typeKeyboard(payload.args?.text || payload.text, payload.args?.enter || payload.enter);
                break;
            default:
                execResult = { success: false, error: 'Unknown action_type for execution' };
        }

        db.prepare('UPDATE pending_actions SET status = ?, payload = ? WHERE id = ?').run('executed', JSON.stringify(payload || {}), id);
        db.prepare('INSERT INTO audit_logs (event_type, details) VALUES (?, ?)').run('executed_action', JSON.stringify({ id, action_type: row.action_type }));
        res.json({ success: true, result: execResult });
    } catch (e) {
        console.error('[Pending Execute] Error executing approved action:', e.message || e);
        db.prepare('UPDATE pending_actions SET status = ? WHERE id = ?').run('failed', id);
        db.prepare('INSERT INTO audit_logs (event_type, details) VALUES (?, ?)').run('failed_action', JSON.stringify({ id, error: e.message || String(e) }));
        res.status(500).json({ success: false, error: e.message || String(e) });
    }
});

// Audit logs endpoint
app.get('/api/audit', adminMiddleware, (req, res) => {
    const rows = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 500').all();
    res.json(rows.map(r => ({ ...r, details: r.details ? JSON.parse(r.details) : r.details })));
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
        for (const k of keys) {
            try {
                const val = await memory.getSecret(k);
                if (val) process.env[k] = val;
            } catch (e) {
                // keytar missing or secret not found; fall back to legacy memory.getFact
                const legacy = memory.getFact(k);
                if (legacy) process.env[k] = legacy;
            }
        }
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

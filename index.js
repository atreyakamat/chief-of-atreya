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

app.post('/api/zen/briefing', async (req, res) => {
    const text = await zenProtocol.runMorningBriefing();
    chatHistory.push({ role: 'assistant', content: text, timestamp: Date.now() });
    voiceStream.streamSpeech(text);
    res.json({ success: true, text });
});
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'ui')));

// ... (Rest of index.js remains the same)

const PORT = process.env.PORT || 3000;

let commandCount = 0;
let chatHistory = [];

app.get('/api/health', (req, res) => {
    res.json({
        ollama: true, // we assume it's true if this request works and is reachable, but we could do more checks
        browser: browser.activeTabs.size > 0,
        voice: voice.ready
    });
});

app.get('/api/status', (req, res) => {
    res.json({
        status: 'running',
        uptime: process.uptime(),
        commandCount,
        provider: ai.getProvider(),
        activeChannel: skills.getActiveChannel()?.name || 'general',
        services: {
            ai: 'connected',
            voice: voice.ready ? 'ready' : 'starting',
            browser: browser.activeTabs.size > 0 ? 'connected' : 'disconnected'
        }
    });
});

app.get('/api/models', async (req, res) => {
    const models = { ollama: [] };
    
    try {
        const ollamaModels = await ai.makeRequest('ollama', '/api/tags', {});
        models.ollama = ollamaModels.models?.map(m => m.name) || [];
    } catch (e) {
        console.log('Ollama not available');
    }
    
    res.json(models);
});

app.post('/api/model', (req, res) => {
    const { provider, model } = req.body;
    
    if (provider === 'ollama') {
        ai.setProvider('ollama');
        process.env.OLLAMA_MODEL = model;
    }
    
    ai.clearHistory();
    chatHistory = [];
    
    res.json({ success: true, provider: ai.getProvider() });
});

app.get('/api/skills', (req, res) => {
    res.json({
        skills: skills.getSkills(),
        channels: skills.getChannels(),
        activeChannel: skills.getActiveChannel()
    });
});

app.post('/api/skills/execute', async (req, res) => {
    const { skillName, input, confirmed } = req.body;
    const result = await skills.executeSkill(skillName, input, confirmed);
    res.json(result);
});

app.post('/api/channel', (req, res) => {
    const { channelName } = req.body;
    const success = skills.setActiveChannel(channelName);
    res.json({ success, channel: skills.getActiveChannel() });
});

// Ultimate Agent Endpoints Scaffold
app.get('/api/projects', (req, res) => {
    const projects = db.prepare('SELECT * FROM projects').all();
    res.json(projects);
});

app.post('/api/projects', (req, res) => {
    const { name, repoUrl, prdSummary } = req.body;
    const stmt = db.prepare('INSERT INTO projects (name, repo_url, prd_summary) VALUES (?, ?, ?)');
    const info = stmt.run(name, repoUrl || null, prdSummary || null);
    res.json({ success: true, id: info.lastInsertRowid });
});

app.get('/api/tasks', (req, res) => {
    const projectId = req.query.projectId;
    let tasksList;
    if (projectId) {
        tasksList = db.prepare('SELECT * FROM tasks WHERE project_id = ?').all(projectId);
    } else {
        tasksList = db.prepare('SELECT * FROM tasks').all();
    }
    res.json(tasksList);
});

app.post('/api/tasks', (req, res) => {
    const { projectId, title, description, dueTime } = req.body;
    const stmt = db.prepare('INSERT INTO tasks (project_id, title, description, due_time) VALUES (?, ?, ?, ?)');
    const info = stmt.run(projectId || null, title, description || null, dueTime || null);
    res.json({ success: true, id: info.lastInsertRowid });
});

app.patch('/api/tasks/:id', (req, res) => {
    const { status } = req.body;
    const stmt = db.prepare('UPDATE tasks SET status = ? WHERE id = ?');
    stmt.run(status, req.params.id);
    res.json({ success: true });
});

app.delete('/api/tasks/:id', (req, res) => {
    db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

// Mobile Ingest Endpoint
app.post('/api/ingest', (req, res) => {
    const { text, source } = req.body;
    if (!text) return res.status(400).json({ error: 'No text provided' });

    // Find or create 'Action Items' project
    let actionProject = db.prepare('SELECT id FROM projects WHERE name = "Action Items"').get();
    if (!actionProject) {
        const info = db.prepare('INSERT INTO projects (name) VALUES ("Action Items")').run();
        actionProject = { id: info.lastInsertRowid };
    }

    const stmt = db.prepare('INSERT INTO tasks (project_id, title, description) VALUES (?, ?, ?)');
    stmt.run(actionProject.id, text, `Mobile ingest via ${source || 'remote'}`);
    
    notifications.sendNotification('Mobile Ingest', `Added: ${text}`, true);
    
    res.json({ success: true, message: 'Action item captured' });
});
app.post('/api/settings', (req, res) => {
    const { provider, apiKey, openRouterKey, groqKey, nvidiaKey, wakeWord } = req.body;
    const memory = require('./modules/memory');
    
    if (provider) {
        ai.setProvider(provider);
        memory.setFact('ai_provider', provider);
    }
    
    // Explicitly handle each cloud key
    if (openRouterKey) {
        process.env.OPENROUTER_API_KEY = openRouterKey;
        memory.setFact('OPENROUTER_API_KEY', openRouterKey);
    }
    if (groqKey) {
        process.env.GROQ_API_KEY = groqKey;
        memory.setFact('GROQ_API_KEY', groqKey);
    }
    if (nvidiaKey) {
        process.env.NVIDIA_API_KEY = nvidiaKey;
        memory.setFact('NVIDIA_API_KEY', nvidiaKey);
    }
    
    // For legacy/simple compatibility if only apiKey is sent
    if (apiKey && provider && provider !== 'ollama') {
        const config = {
            'openrouter': 'OPENROUTER_API_KEY',
            'groq': 'GROQ_API_KEY',
            'nvidia': 'NVIDIA_API_KEY'
        };
        if (config[provider]) {
            process.env[config[provider]] = apiKey;
            memory.setFact(config[provider], apiKey);
        }
    }
    
    res.json({ success: true, currentProvider: ai.getProvider() });
});

app.get('/api/work-accounts', (req, res) => res.json(workAccounts.getWorkAccounts()));
app.get('/api/snapshots', (req, res) => res.json(vision.getSnapshots(req.query.limit)));
app.get('/api/contacts', (req, res) => res.json(contacts.getContacts(req.query.category)));
app.get('/api/drafts', (req, res) => res.json(contacts.getDrafts('pending_review')));
app.post('/api/drafts/:id/approve', async (req, res) => {
    const draftId = parseInt(req.params.id, 10);
    const draft = db.prepare('SELECT * FROM message_drafts WHERE id = ?').get(draftId);
    
    if (!draft) return res.status(404).json({ success: false, error: 'Draft not found' });

    // Update status
    contacts.updateDraftStatus(draftId, 'approved');
    
    // Trigger actual send based on platform
    let sendResult = { success: false, error: 'Unknown platform' };
    if (draft.platform === 'email') {
        // Assume contact lookup logic exists or draft has email info
        // sendResult = await emails.sendEmail(...);
    }
    // WhatsApp/other platforms follow here...

    res.json({ success: true, draftId, sendResult });
});
app.get('/api/reminders', (req, res) => {
    res.json(reminders.getActiveReminders());
});

app.post('/api/reminders', (req, res) => {
    const { text, dueTime, recurringRule } = req.body;
    const result = reminders.createReminder(text, dueTime, recurringRule);
    if (result.success) {
        notifications.sendNotification('Reminder Added', text);
    }
    res.json(result);
});

app.delete('/api/reminders/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    const result = reminders.deleteReminder(id);
    res.json(result);
});

app.get('/api/notifications', (req, res) => {
    const limit = parseInt(req.query.limit, 10) || 50;
    res.json(notifications.getRecentNotifications(limit));
});

app.get('/api/browser', (req, res) => {
    res.json(browser.getTabs());
});

app.get('/api/chat/history', (req, res) => {
    res.json(chatHistory.slice(-50));
});

app.post('/api/chat', async (req, res) => {
    const { text, useVoice, context: platformContext } = req.body;
    commandCount++;

    const userMessage = { role: 'user', content: text, timestamp: Date.now() };
    chatHistory.push(userMessage);

    try {
        const context = {
            tabs: browser.getTabs(),
            notifications: notifications.getRecentNotifications(10),
            reminders: reminders.getActiveReminders(),
            channel: skills.getActiveChannel()?.name || 'general',
            // Added ultimate agent contexts
            tasks: tasks.getTasks().slice(0, 10),
            projects: github.getProjects().slice(0, 10),
            pendingDrafts: contacts.getDrafts().slice(0, 5),
            // User platform context
            platform: platformContext || {}
        };
        const skillMap = {};
        skills.getSkills().forEach(s => skillMap[s.name] = s);
        
        let response = await ai.processCommand(text, context, skillMap);
        
        if (response.tool_calls && response.tool_calls.length > 0) {
            const toolResults = [];
            
            for (const toolCall of response.tool_calls) {
                let resultText = "";
                const name = toolCall.function?.name || toolCall.name;
                const args = toolCall.function?.arguments || toolCall.input || {};
                
                switch (name) {
                    case 'set_reminder':
                        let rText = args.text;
                        let rDueTime = args.dueTime;
                        let rRecurring = args.recurringRule;
                        
                        // If AI didn't provide specific ISO time, try parsing the prompt
                        if (!rDueTime || rDueTime.length < 5) {
                            const parsed = parseNaturalLanguageReminder(text);
                            rText = rText || parsed.text;
                            rDueTime = rDueTime || parsed.dueTime;
                            rRecurring = rRecurring || parsed.recurring;
                        }
                        
                        const r = reminders.createReminder(rText, rDueTime, rRecurring);
                        resultText = r.success ? `Reminder created: "${rText}" for ${new Date(rDueTime).toLocaleString()}` : `Failed: ${r.error}`;
                        break;
                        
                    case 'delete_reminder':
                        const d = reminders.deleteReminder(args.id);
                        resultText = d.success ? `Reminder deleted` : `Failed: ${d.error}`;
                        break;
                        
                    case 'speak_response':
                        if (useVoice !== false) voice.speak(args.text);
                        resultText = "Speaking.";
                        break;
                        
                    case 'get_notifications':
                        const notifs = notifications.getRecentNotifications(args.limit || 10);
                        resultText = notifs.map(n => `${n.title}: ${n.body || ''}`).join('\n') || 'No notifications';
                        break;
                        
                    case 'get_browser_tabs':
                        const tabs = browser.getTabs();
                        resultText = tabs.map(t => t.title || t.url).join('\n') || 'No tabs';
                        break;
                        
                    case 'remember_fact':
                        const m = require('./modules/memory');
                        m.setFact(args.key, args.value);
                        resultText = `Saved ${args.key}.`;
                        break;

                    case 'use_skill':
                        const skillResult = await skills.executeSkill(args.skillName, args.input);
                        if (skillResult.needs_confirmation) {
                            resultText = `CONFIRMATION_REQUIRED: Skill "${args.skillName}" needs manual confirmation to run with input "${args.input}".`;
                            // We can also flag the response object to tell UI to show a button
                            response.needs_skill_confirmation = { 
                                skillName: args.skillName, 
                                input: args.input 
                            };
                        } else {
                            resultText = skillResult.success ? skillResult.result : skillResult.error;
                        }
                        break;
                        
                    default:
                        resultText = `Unknown tool: ${name}`;
                }
                
                const toolUseId = toolCall.id || toolCall.function?.id || 'unknown';
                toolResults.push({
                    type: "tool_result",
                    tool_use_id: toolUseId,
                    content: resultText
                });
            }
            
            response = await ai.submitToolResults(toolResults, skillMap);
        }
        
        const assistantMessage = { 
            role: 'assistant', 
            content: response.text || 'Command processed.', 
            timestamp: Date.now() 
        };
        chatHistory.push(assistantMessage);
        
        if (useVoice !== false && response.text) {
            voice.speak(response.text);
        }
        
        res.json({ 
            success: true, 
            text: response.text,
            history: chatHistory.slice(-20)
        });
        
    } catch (e) {
        const errorMessage = { role: 'error', content: e.message, timestamp: Date.now() };
        chatHistory.push(errorMessage);
        res.status(500).json({ success: false, error: e.message, history: chatHistory.slice(-20) });
    }
});

app.post('/api/voice/record', (req, res) => {
    if (voice.pythonProcess) {
        voice.pythonProcess.stdin.write(JSON.stringify({ command: 'record' }) + '\n');
    }
    res.json({ success: true });
});

app.delete('/api/voice/speak', (req, res) => {
    voice.stopSpeak();
    res.json({ success: true });
});

function parseNaturalLanguageReminder(text) {
    const lower = text.toLowerCase();
    const now = new Date();
    let dueTime = new Date(now);
    let recurring = null;
    
    const inMatch = lower.match(/in\s+(\d+)\s*(minutes?|mins?|hours?|hrs?|days?)/);
    if (inMatch) {
        const num = parseInt(inMatch[1]);
        const unit = inMatch[2];
        if (unit.startsWith('min')) dueTime.setMinutes(dueTime.getMinutes() + num);
        else if (unit.startsWith('hour')) dueTime.setHours(dueTime.getHours() + num);
        else if (unit.startsWith('day')) dueTime.setDate(dueTime.getDate() + num);
    }
    
    const atMatch = lower.match(/at\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/);
    if (atMatch) {
        const timeStr = atMatch[1];
        const [hours, minutes] = timeStr.split(':').map(Number);
        dueTime.setHours(hours, minutes || 0, 0, 0);
        if (dueTime < now) dueTime.setDate(dueTime.getDate() + 1);
    }
    
    if (lower.includes('every day') || lower.includes('daily')) recurring = 'daily';
    else if (lower.includes('every week') || lower.includes('weekly')) recurring = 'weekly';
    
    let reminderText = text
        .replace(/remind me to\s+/i, '')
        .replace(/remind me\s+/i, '')
        .replace(/reminder:\s*/i, '')
        .replace(/in\s+\d+\s*(minutes?|mins?|hours?|hrs?|days?)/i, '')
        .replace(/at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?/i, '')
        .trim();
    
    return { text: reminderText, dueTime: dueTime.toISOString(), recurring };
}

function checkRemindersLoop() {
    setInterval(() => {
        const active = reminders.getActiveReminders();
        const now = new Date();
        
        for (const r of active) {
            const due = new Date(r.due_time);
            if (due <= now && r.status === 'pending') {
                notifications.sendNotification('Reminder', r.text, true);
                voice.speak(`Reminder: ${r.text}`);
                
                if (r.recurring_rule) {
                    const nextDue = new Date(due);
                    if (r.recurring_rule === 'daily') nextDue.setDate(nextDue.getDate() + 1);
                    else if (r.recurring_rule === 'weekly') nextDue.setDate(nextDue.getDate() + 7);
                    reminders.updateReminderTime(r.id, nextDue.toISOString());
                } else {
                    reminders.updateReminderStatus(r.id, 'completed');
                }
            }
        }
    }, 30000);
}

function notificationSummarizationLoop() {
    setInterval(() => {
        const notifs = notifications.getRecentNotifications(30);
        if (notifs.length > 0) {
            const urgent = notifs.filter(n => n.priority === 'urgent').length;
            const summary = `${notifs.length} notifications (${urgent} urgent)`;
            notifications.sendNotification('Notification Summary', summary);
        }
    }, 30 * 60 * 1000);
}

function checkBrowserDistraction() {
    setInterval(() => {
        const tabs = browser.getDistractionTabs();
        const focusTabs = browser.getTabs().filter(t => !t.isDistraction);
        
        if (tabs.length > 0 && focusTabs.length === 0) {
            notifications.sendNotification('Distraction Alert', 'Time to get back to work!');
            voice.speak("Hey, you're distracted. Time to get back to work!");
        }
    }, 15 * 60 * 1000);
}

function waterDrinkerTimerLoop() {
    // Remind the user to drink water every 60 minutes
    setInterval(() => {
        notifications.sendNotification('Health Reminder', 'Stay hydrated! Time to drink a glass of water.', true);
        voice.speak('Stay hydrated! Time to drink a glass of water.');
    }, 60 * 60 * 1000);
}

function proactiveAgentLoop() {
    // Proactive Intelligence Loop (Zen V3)
    // Runs every 2 hours to check deadlines and project health
    setInterval(async () => {
        console.log('[Zen Proactive] Analyzing context for proactive suggestions...');
        const upcomingEvents = await calendar.getUpcomingEvents(3);
        const projects = github.getProjects();
        const activeTasks = tasks.getTasks();

        if (upcomingEvents.length > 0 || activeTasks.length > 0) {
            const prompt = `You are Zen, a proactive Multi-Agent Supervisor.
Review the following user context:
Events: ${JSON.stringify(upcomingEvents)}
Tasks: ${JSON.stringify(activeTasks.slice(0, 5))}
Projects: ${JSON.stringify(projects.slice(0, 3))}

If there is an upcoming deadline or a stalled project, write a brief, friendly 1-2 sentence proactive message to the user suggesting an action or offering to delegate work to a sub-agent. If everything is fine, output exactly "NO_ACTION".`;

            try {
                const response = await ai.makeOpenAICompatibleRequest({
                    model: ai.getModelName(),
                    messages: [{ role: 'system', content: prompt }],
                    max_tokens: 100
                });
                
                const suggestion = response.choices ? response.choices[0].message.content.trim() : "NO_ACTION";
                if (suggestion && suggestion !== "NO_ACTION" && !suggestion.includes("NO_ACTION")) {
                    console.log(`[Zen Proactive Suggestion]: ${suggestion}`);
                    notifications.sendNotification('Proactive Suggestion', suggestion, true);
                    chatHistory.push({
                        role: 'assistant',
                        content: `[Proactive]: ${suggestion}`,
                        timestamp: Date.now()
                    });
                    voice.speak(suggestion);
                }
            } catch (e) {
                console.error('[Zen Proactive] Analysis failed:', e.message);
            }
        }
    }, 2 * 60 * 60 * 1000); // 2 hours
}

function ultimateAgentBackgroundLoops() {
    // Scaffold: These loops would sync data in the background periodically
    setInterval(() => {
        console.log('[Background] Syncing emails...');
        emails.processEmailsForReminders();
    }, 60 * 60 * 1000);

    setInterval(() => {
        console.log('[Background] Syncing chats from work accounts...');
        workAccounts.syncChats();
    }, 30 * 60 * 1000);

    setInterval(() => {
        console.log('[Background] Syncing WhatsApp messages and drafting replies...');
        whatsapp.syncWhatsAppMessages();
        whatsapp.processMessagesForDrafts();
    }, 15 * 60 * 1000);

    setInterval(() => {
        vision.processPendingSnapshots();
    }, 10 * 1000); // Check for new snapshots every 10 seconds
}

async function initializeAll() {
    console.log('⚡ CHIEF - Local AI Chief of Staff (Ultimate Agent Edition)');
    console.log('==================================');
    
    // Seed projects if empty
    const projectCount = db.prepare('SELECT COUNT(*) as count FROM projects').get().count;
    if (projectCount === 0) {
        const initialProjects = [
            'Action Items', 'StixnVibes', 'Solvix Studios', 'Spark+ Tutoring', 
            'Rotract Club of Mapuca', 'Pixel N Purpose', "Anjali's Table", 'College Work & Projects'
        ];
        const stmt = db.prepare('INSERT INTO projects (name) VALUES (?)');
        initialProjects.forEach(name => stmt.run(name));
        console.log('[✓] Database seeded with initial projects');
    }

    // Load AI Settings
    const memory = require('./modules/memory');
    const savedProvider = memory.getFact('ai_provider');
    if (savedProvider) {
        ai.setProvider(savedProvider);
        const keys = ['OPENROUTER_API_KEY', 'GROQ_API_KEY', 'NVIDIA_API_KEY'];
        keys.forEach(k => {
            const val = memory.getFact(k);
            if (val) process.env[k] = val;
        });
    }

    console.log('[1/7] Connecting to AI...');
    const aiStatus = await ai.checkConnection();
    if (aiStatus) {
        console.log(`[✓] AI connected (${ai.getProvider()})`);
    } else {
        console.log('[!] AI not connected - check .env');
    }
    
    console.log('[2/7] Initializing integrations...');
    await browser.connect();
    whatsapp.initialize();
    github.initialize();
    calendar.initialize();
    discord.initialize();
    reddit.initialize();
    emails.initialize();
    
    console.log('[3/7] Starting notification tracker...');
    notifications.startListening();
    
    console.log('[4/7] Loading skills & channels...');
    console.log(`    Skills: ${skills.getSkills().length}`);
    console.log(`    Channels: ${skills.getChannels().map(c => c.name).join(', ')}`);
    
    console.log('[5/7] Starting voice engine...');
    voiceStream.connect();
    voice.on('transcription', async (text) => {
        console.log('[VOICE]:', text);
        // Interrupt current speech
        voiceStream.stopSpeak();
        
        commandCount++;
        try {
            const responseText = await handleAIChat(text, false);
            if (responseText) voice.speak(responseText);
        } catch (e) {
            console.error('Voice Error:', e);
            voice.speak("I encountered an error.");
        }
    });
    
    voice.on('ready', () => console.log('[✓] Voice ready'));
    voice.start();
    
    console.log('[6/7] Starting ultimate agent background services (Emails, Chats, Projects, Contacts, Drafting)...');
    ultimateAgentBackgroundLoops();

    console.log('[7/7] Starting core background services...');
    checkRemindersLoop();
    notificationSummarizationLoop();
    checkBrowserDistraction();
    waterDrinkerTimerLoop(); // Added health reminder loop

    // Zen Photographic Memory Setup
    globalShortcut.register('alt+s', capture.captureAndProcess);
    capture.startFolderWatcher(); // Changed from startContinuousCapture
    console.log('[✓] Zen Photographic Memory (Alt+S and Folder Watcher) ready.');

    // Zen Wake Word
    const wakeword = require('./modules/wakeword');
    wakeword.startWakeWordDetection(() => {
        voice.speak("Yes, how can I help?");
        // Launch dashboard
        const { exec } = require('child_process');
        exec(`start http://localhost:${PORT}`);
    });
    console.log('[✓] Zen Wake Word Engine ("Hey Zen") ready.');

    app.listen(PORT, () => {
        console.log('==================================');
        console.log(`🚀 Dashboard: http://localhost:${PORT}`);
        console.log('   Say "Hey Chief" or use the chat');
        console.log('==================================');
    });
}

async function handleAIChat(text, useVoice = true) {
    const context = {
        tabs: browser.getTabs(),
        notifications: notifications.getRecentNotifications(10),
        reminders: reminders.getActiveReminders(),
        channel: skills.getActiveChannel()?.name || 'general',
        tasks: tasks.getTasks().slice(0, 5),
        projects: github.getProjects().slice(0, 3),
        pendingDrafts: contacts.getDrafts().slice(0, 3)
    };

    const skillMap = {};
    skills.getSkills().forEach(s => skillMap[s.name] = s);
    
    let response = await ai.processCommand(text, context, skillMap);
    
    if (response.tool_calls && response.tool_calls.length > 0) {
        const toolResults = [];
        
        for (const toolCall of response.tool_calls) {
            let resultText = "";
            const name = toolCall.function?.name || toolCall.name;
            const args = toolCall.function?.arguments || toolCall.input || {};
            
            switch (name) {
                case 'set_reminder':
                    let rText = args.text;
                    let rDueTime = args.dueTime;
                    let rRecurring = args.recurringRule;
                    
                    if (!rDueTime || rDueTime.length < 5) {
                        const parsed = parseNaturalLanguageReminder(text);
                        rText = rText || parsed.text;
                        rDueTime = rDueTime || parsed.dueTime;
                        rRecurring = rRecurring || parsed.recurring;
                    }
                    
                    const r = reminders.createReminder(rText, rDueTime, rRecurring);
                    resultText = r.success ? `Reminder created: "${rText}" for ${new Date(rDueTime).toLocaleString()}` : `Failed: ${r.error}`;
                    break;
                case 'delete_reminder':
                    const d = reminders.deleteReminder(args.id);
                    resultText = d.success ? 'Deleted' : 'Failed';
                    break;
                case 'speak_response':
                    if (useVoice) voice.speak(args.text);
                    resultText = 'Speaking';
                    break;
                case 'remember_fact':
                    const mem = require('./modules/memory');
                    mem.setFact(args.key, args.value);
                    resultText = `Saved ${args.key}.`;
                    break;
                case 'search_reddit':
                    const redditRes = await reddit.searchReddit(args.query, 3);
                    resultText = redditRes.success ? JSON.stringify(redditRes.data) : `Failed: ${redditRes.error}`;
                    break;
                case 'read_calendar':
                    const events = await calendar.getUpcomingEvents(args.maxResults || 5);
                    resultText = events.length ? events.map(e => `${e.summary} at ${e.start?.dateTime}`).join('\n') : "No upcoming events.";
                    break;
                case 'add_calendar_event':
                    const addRes = await calendar.addEvent(args.summary, args.description, args.startTime, args.endTime);
                    resultText = addRes.success ? `Added: ${addRes.eventLink}` : `Failed: ${addRes.error}`;
                    break;
                case 'approve_draft':
                    contacts.updateDraftStatus(args.draftId, 'approved');
                    resultText = `Draft ${args.draftId} approved to be sent via ${contacts.getDrafts('pending_review').find(d => d.id === args.draftId)?.platform || 'platform'}.`;
                    break;
                case 'execute_command':
                    try {
                        const result = await autoHealer.executeWithHealing(args.command);
                        resultText = `Execution successful: ${result}`;
                    } catch (err) {
                        resultText = `Critical failure: ${err.message}`;
                    }
                    break;
                case 'click_mouse':
                    const clickRes = await require('./modules/computer_use').clickMouse(args.x, args.y);
                    resultText = clickRes.status === 'success' ? "Mouse clicked." : `Failed: ${clickRes.message}`;
                    break;
                case 'type_keyboard':
                    const typeRes = await require('./modules/computer_use').typeKeyboard(args.text, args.enter);
                    resultText = typeRes.status === 'success' ? "Text typed." : `Failed: ${typeRes.message}`;
                    break;
                case 'open_app':
                    const appRes = await require('./modules/computer_use').openApp(args.appName);
                    resultText = appRes.status === 'success' ? "App opened." : `Failed: ${appRes.message}`;
                    break;
                case 'home_assistant_control':
                    const iotRes = await iot.controlDevice(args.entity_id, args.action);
                    resultText = iotRes.success ? "IoT command sent." : `Failed: ${iotRes.error}`;
                    break;
                case 'ssh_command':
                    const hl = require('./modules/homelab');
                    const sshRes = await hl.executeCommand(args.command);
                    resultText = sshRes.success ? `STDOUT:\n${sshRes.stdout}\nSTDERR:\n${sshRes.stderr}` : `SSH Failed: ${sshRes.error}`;
                    break;
                case 'query_rag_memory':
                    const ragRes = await rag.queryMemory(args.query);
                    resultText = ragRes.length ? JSON.stringify(ragRes) : "No memories found.";
                    break;
                case 'clock_in':
                    const ciRes = timeTracker.clockIn(args.type);
                    resultText = ciRes.success ? `Clocked in for ${ciRes.type}.` : `Failed: ${ciRes.error}`;
                    break;
                case 'clock_out':
                    const coRes = timeTracker.clockOut(args.notes);
                    resultText = coRes.success ? `Clocked out. Duration: ${coRes.durationMinutes} minutes.` : `Failed: ${coRes.error}`;
                    break;
                case 'delegate_task':
                    resultText = `Delegating task to ${args.agent_role}: "${args.task_description}". This will run asynchronously.`;
                    console.log(`[Supervisor] Delegated task to ${args.agent_role}: ${args.task_description}`);
                    
                    // Run sub-agent asynchronously so it doesn't block the main thread
                    (async () => {
                        try {
                            let agentModule;
                            let role = args.agent_role.toLowerCase();
                            if (role.includes('coder') || role.includes('developer')) {
                                agentModule = require('./agents/coder');
                            } else if (role.includes('researcher') || role.includes('analyst')) {
                                agentModule = require('./agents/researcher');
                            } else {
                                agentModule = require('./agents/communicator');
                            }
                            
                            console.log(`[Supervisor] Sub-agent ${role} started...`);
                            const agentContext = { ...context }; // Pass context clone
                            const subAgentResult = await agentModule.runTask(args.task_description, agentContext);
                            
                            // Send a notification when the sub-agent completes
                            notifications.sendNotification(`Sub-Agent: ${args.agent_role}`, 'Task completed. Check dashboard for details.', true);
                            
                            // Log it in the chat history or memory
                            chatHistory.push({
                                role: 'assistant',
                                content: `[Sub-Agent ${args.agent_role} Report]:\n${subAgentResult}`,
                                timestamp: Date.now()
                            });
                            console.log(`[Supervisor] Sub-agent ${role} finished.`);
                        } catch (err) {
                            console.error(`[Supervisor] Sub-agent ${args.agent_role} failed:`, err);
                        }
                    })();
                    break;
                case 'use_skill':
                    const sr = await skills.executeSkill(args.skillName, args.input);
                    if (sr.needs_confirmation) {
                        resultText = `CONFIRMATION_REQUIRED: "${args.skillName}" needs manual confirmation.`;
                    } else {
                        resultText = sr.success ? sr.result : sr.error;
                    }
                    break;
                default:
                    resultText = `Unknown: ${name}`;
            }
            
            toolResults.push({
                type: "tool_result",
                tool_use_id: toolCall.id || 'unknown',
                content: resultText
            });
        }
        
        response = await ai.submitToolResults(toolResults, skillMap);
    }
    
    return response.text || 'Done.';
}

process.on('SIGINT', async () => {
    console.log('\n[CHIEF] Shutting down...');
    await browser.disconnect();
    notifications.stopListening();
    voice.stop();
    process.exit();
});

process.on('uncaughtException', (err) => {
    console.error('[CHIEF] Error:', err);
});

initializeAll();

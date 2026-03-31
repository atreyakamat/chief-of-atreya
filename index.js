const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const browser = require('./modules/browser');
const notifications = require('./modules/notifications');
const reminders = require('./modules/reminders');
const voice = require('./modules/voice');
const ai = require('./modules/ai');
const skills = require('./modules/skills');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'ui')));

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

app.get('/api/notifications', (req, res) => {
    const limit = parseInt(req.query.limit) || 10;
    const recent = notifications.getRecentNotifications(limit);
    res.json(recent);
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
    const { text, useVoice } = req.body;
    commandCount++;
    
    const userMessage = { role: 'user', content: text, timestamp: Date.now() };
    chatHistory.push(userMessage);
    
    try {
        const context = {
            tabs: browser.getTabs(),
            notifications: notifications.getRecentNotifications(10),
            reminders: reminders.getActiveReminders(),
            channel: skills.getActiveChannel()?.name || 'general'
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
                        resultText = `I will remember that ${args.key} is ${args.value}.`;
                        break;
                        
                    case 'remember_fact':
                    const mem = require('./modules/memory');
                    mem.setFact(args.key, args.value);
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

async function initializeAll() {
    console.log('⚡ CHIEF - Local AI Chief of Staff');
    console.log('==================================');
    
    console.log('[1/6] Connecting to AI...');
    const aiStatus = await ai.checkConnection();
    if (aiStatus) {
        console.log(`[✓] AI connected (${ai.getProvider()})`);
    } else {
        console.log('[!] AI not connected - check .env');
    }
    
    console.log('[2/6] Initializing browser monitor...');
    await browser.connect();
    
    console.log('[3/6] Starting notification tracker...');
    notifications.startListening();
    
    console.log('[4/6] Loading skills & channels...');
    console.log(`    Skills: ${skills.getSkills().length}`);
    console.log(`    Channels: ${skills.getChannels().map(c => c.name).join(', ')}`);
    
    console.log('[5/6] Starting voice engine...');
    voice.on('transcription', async (text) => {
        console.log('[VOICE]:', text);
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
    
    console.log('[6/6] Starting background services...');
    checkRemindersLoop();
    notificationSummarizationLoop();
    checkBrowserDistraction();

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
        channel: skills.getActiveChannel()?.name || 'general'
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
                case 'use_skill':
                    const sr = await skills.executeSkill(args.skillName, args.input);
                    if (sr.needs_confirmation) {
                        resultText = `CONFIRMATION_REQUIRED: "${args.skillName}" needs manual confirmation.`;
                        // Can't easily pass object back through this legacy wrapper without changing more,
                        // so we'll just return the text.
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

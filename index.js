const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const browser = require('./modules/browser');
const notifications = require('./modules/notifications');
const reminders = require('./modules/reminders');
const voice = require('./modules/voice');
const claude = require('./modules/claude');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'ui')));

const PORT = 3000;

// API Routes
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
    res.json(notifications.getRecentNotifications(50));
});

app.get('/api/browser', (req, res) => {
    res.json(browser.getTabs());
});

app.post('/api/chat', async (req, res) => {
    const { text } = req.body;
    try {
        const response = await handleAIChat(text);
        res.json({ success: true, text: response });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Claude Orchestration Logic
async function handleAIChat(text) {
    const context = {
        tabs: browser.getTabs(),
        notifications: notifications.getRecentNotifications(10),
        reminders: reminders.getActiveReminders()
    };

    let claudeResponse = await claude.processCommand(text, context);
    
    // Handle Tool Calls automatically
    if (claudeResponse.tool_calls.length > 0) {
        const toolResults = [];
        for (const toolCall of claudeResponse.tool_calls) {
            let resultResult = "";
            switch (toolCall.name) {
                case 'set_reminder':
                    const r = reminders.createReminder(toolCall.input.text, toolCall.input.dueTime, toolCall.input.recurringRule);
                    resultResult = r.success ? `Reminder created with ID ${r.id}` : `Failed: ${r.error}`;
                    break;
                case 'delete_reminder':
                    const d = reminders.deleteReminder(toolCall.input.id);
                    resultResult = d.success ? `Reminder deleted` : `Failed: ${d.error}`;
                    break;
                case 'speak_response':
                    voice.speak(toolCall.input.text);
                    resultResult = "Text spoken successfully.";
                    break;
                default:
                    resultResult = "Unknown tool call.";
            }
            toolResults.push({
                type: "tool_result",
                tool_use_id: toolCall.id,
                content: resultResult
            });
        }
        
        // Return tool results to Claude
        claudeResponse = await claude.submitToolResults(toolResults);
    }
    
    return claudeResponse.text;
}

// Background Loops
function checkRemindersLoop() {
    setInterval(() => {
        const active = reminders.getActiveReminders();
        const now = new Date();
        for (const r of active) {
            const due = new Date(r.due_time);
            if (due <= now && r.status === 'pending') {
                notifications.sendNotification('⏰ Reminder', r.text, true);
                voice.speak(`Reminder: ${r.text}`);
                reminders.updateReminderStatus(r.id, 'completed');
            }
        }
    }, 60000); // Check every minute
}

// Initialization
async function initializeAll() {
    console.log('[CHIEF] Initializing modules...');
    
    await browser.connect();
    notifications.startListening();
    
    // Setup Voice Events
    voice.on('transcription', async (text) => {
        console.log('[VOICE COMMAND]:', text);
        try {
            const responseText = await handleAIChat(text);
            if (responseText) {
                voice.speak(responseText);
            }
        } catch (e) {
            console.error('AI Error processing voice command:', e);
            voice.speak("I'm sorry, I encountered an error connecting to my brain.");
        }
    });
    
    voice.start();
    
    checkRemindersLoop();

    app.listen(PORT, () => {
        console.log(`[CHIEF] Dashboard running at http://localhost:${PORT}`);
    });
}

// Cleanup on exit
process.on('SIGINT', async () => {
    console.log('[CHIEF] Shutting down...');
    await browser.disconnect();
    notifications.stopListening();
    voice.stop();
    process.exit();
});

initializeAll();

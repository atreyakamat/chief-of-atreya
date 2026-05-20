const ai = require('./ai');
const browser = require('./browser');
const tasks = require('./tasks');
const reminders = require('./reminders');
const notifications = require('./notifications');

class ZenProtocol {
    async runMorningBriefing() {
        console.log('[Zen Protocol] Initiating system-wide scan for Morning Briefing...');
        
        // Gather system context
        const pendingTasks = tasks.getTasks().filter(t => t.status !== 'done').slice(0, 5);
        const openTabs = browser.getTabs();
        const pendingReminders = reminders.getActiveReminders();
        const recentNotifs = notifications.getRecentNotifications(5);

        const contextString = `
Current System State:
- Pending Tasks: ${pendingTasks.map(t => t.title).join(', ') || 'None'}
- Open Browser Tabs: ${openTabs.map(t => t.title).join(', ') || 'None'}
- Reminders: ${pendingReminders.map(r => r.text).join(', ') || 'None'}
- Recent Notifications: ${recentNotifs.map(n => n.title).join(', ') || 'None'}
`;

        const prompt = `You are Zen, my autonomous AI assistant (like Jarvis). It is morning. I have just initiated the Zen Protocol. 
Scan the provided system state and give me a brief, highly professional, conversational morning briefing. 
Tell me what I need to focus on today, summarize any important notifications or open tabs, and ask if I need you to execute any specific tasks.
Keep it concise, energetic, and extremely intelligent. Do not use asterisks or markdown, as this will be spoken aloud via TTS.

${contextString}`;

        try {
            const response = await ai.processCommand(prompt, { platform: { currentView: 'Zen Briefing' } });
            return response.text;
        } catch (err) {
            console.error('[Zen Protocol] Failed to generate briefing:', err);
            return "Sir, I encountered an error while scanning the system. However, all core modules are online.";
        }
    }
}

module.exports = new ZenProtocol();

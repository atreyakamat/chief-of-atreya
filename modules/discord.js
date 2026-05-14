const { Client, GatewayIntentBits } = require('discord.js');
const db = require('../db');

let client = null;

function initialize() {
    if (!process.env.DISCORD_TOKEN) {
        console.log('[Discord] Integration disabled (set DISCORD_TOKEN to enable).');
        return;
    }

    client = new Client({ 
        intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] 
    });

    client.once('ready', () => {
        console.log(`[Discord] Logged in as ${client.user.tag}. Monitoring project health.`);
    });

    client.on('messageCreate', message => {
        if (message.author.bot) return;

        // Monitor channels for keywords indicating project health issues
        const content = message.content.toLowerCase();
        if (content.includes('error') || content.includes('bug') || content.includes('failed') || content.includes('urgent')) {
            console.log(`[Discord] Potential issue flagged in channel ${message.channel.name}: ${message.content}`);
            // In a full implementation, we'd link this to a specific project ID
            db.prepare('INSERT INTO notifications (app_source, title, body, priority) VALUES (?, ?, ?, ?)')
              .run('Discord', `Issue in #${message.channel.name}`, message.content, 'urgent');
        }
    });

    client.login(process.env.DISCORD_TOKEN).catch(e => {
        console.error('[Discord] Login failed:', e.message);
    });
}

module.exports = {
    initialize
};
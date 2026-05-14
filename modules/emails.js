const db = require('../db');
const imaps = require('imap-simple');
const simpleParser = require('mailparser').simpleParser;
const contacts = require('./contacts');

let connection = null;

async function initialize() {
    if (!process.env.IMAP_USER || !process.env.IMAP_PASSWORD || !process.env.IMAP_HOST) {
        console.log('[Emails] Integration disabled (missing IMAP env vars).');
        return;
    }

    const config = {
        imap: {
            user: process.env.IMAP_USER,
            password: process.env.IMAP_PASSWORD,
            host: process.env.IMAP_HOST,
            port: process.env.IMAP_PORT || 993,
            tls: true,
            authTimeout: 3000
        }
    };

    try {
        connection = await imaps.connect(config);
        console.log('[Emails] IMAP connection established.');
    } catch (e) {
        console.error('[Emails] Connection failed:', e.message);
    }
}

async function syncEmails(accountId) {
    if (!connection) return { success: false, error: 'Not connected' };

    try {
        await connection.openBox('INBOX');
        const searchCriteria = ['UNSEEN'];
        const fetchOptions = { bodies: ['HEADER', 'TEXT'], struct: true, markSeen: true };
        
        const messages = await connection.search(searchCriteria, fetchOptions);
        
        for (const msg of messages) {
            const allParts = imaps.getParts(msg.attributes.struct);
            const bodyPart = allParts.filter(p => p.partID !== '1' || p.subtype === 'plain')[0];
            
            if (bodyPart) {
                const partData = await connection.getPartData(msg, bodyPart);
                const parsed = await simpleParser(partData);
                
                const sender = msg.parts.filter(p => p.which === 'HEADER')[0].body.from[0];
                const subject = msg.parts.filter(p => p.which === 'HEADER')[0].body.subject[0];

                db.prepare('INSERT INTO emails (account_id, sender, subject, body) VALUES (?, ?, ?, ?)')
                  .run(accountId || 1, sender, subject, parsed.text || '');
            }
        }
        return { success: true, message: `Synced ${messages.length} emails.` };
    } catch (e) {
        console.error('[Emails] Sync error:', e.message);
        return { success: false, error: e.message };
    }
}

function processEmailsForReminders() {
    // Scaffold: Read new emails from DB, pass to AI to identify action items
    // Link parsed_reminder_id in the emails table
    return { success: true, message: 'Emails processed for reminders' };
}

function getEmails(accountId, limit = 50) {
    return db.prepare('SELECT * FROM emails WHERE account_id = ? ORDER BY timestamp DESC LIMIT ?').all(accountId, limit);
}

module.exports = {
    initialize,
    syncEmails,
    processEmailsForReminders,
    getEmails
};

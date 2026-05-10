const db = require('../db');

function syncEmails(accountId) {
    // Scaffold: Connect to IMAP, fetch recent emails
    // Insert into 'emails' table
    return { success: true, message: 'Emails synchronized in background' };
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
    syncEmails,
    processEmailsForReminders,
    getEmails
};

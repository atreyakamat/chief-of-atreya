const db = require('../db');

function getWorkAccounts() {
    return db.prepare('SELECT id, platform, account_name, status FROM work_accounts').all();
}

function addWorkAccount(platform, accountName, credentialsEncrypted) {
    const stmt = db.prepare('INSERT INTO work_accounts (platform, account_name, credentials_encrypted) VALUES (?, ?, ?)');
    const info = stmt.run(platform, accountName, credentialsEncrypted);
    return { success: true, id: info.lastInsertRowid };
}

function syncChats() {
    // Scaffold: Fetch messages from Slack, Teams, etc.
    // Insert into 'chats' table
    return { success: true, message: 'Chats synchronized in background' };
}

function getChats(accountId, limit = 50) {
    return db.prepare('SELECT * FROM chats WHERE account_id = ? ORDER BY timestamp DESC LIMIT ?').all(accountId, limit);
}

module.exports = {
    getWorkAccounts,
    addWorkAccount,
    syncChats,
    getChats
};

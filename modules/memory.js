const db = require('../db');
const os = require('os');
let keytar;
try {
    keytar = require('keytar');
} catch (e) {
    // keytar may not be installed in some environments; functions will throw if used.
    keytar = null;
}

class MemoryService {
    constructor() {
        this.initializeTable();
    }

    initializeTable() {
        db.prepare(`
            CREATE TABLE IF NOT EXISTS memory (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `).run();

        db.prepare(`
            CREATE TABLE IF NOT EXISTS pending_actions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                action_type TEXT,
                payload TEXT,
                status TEXT DEFAULT 'pending',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `).run();
        
        db.prepare(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_type TEXT NOT NULL,
                details TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `).run();
    }

    getFact(key) {
        const stmt = db.prepare('SELECT value FROM memory WHERE key = ?');
        const result = stmt.get(key);
        return result ? result.value : null;
    }

    setFact(key, value) {
        const stmt = db.prepare('INSERT OR REPLACE INTO memory (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)');
        stmt.run(key, value);
    }

    getAllFacts() {
        return db.prepare('SELECT * FROM memory').all();
    }

    clearFact(key) {
        db.prepare('DELETE FROM memory WHERE key = ?').run(key);
    }

    // Secrets: use keytar when available. Service name uses app name + user hostname.
    async setSecret(key, value) {
        if (!keytar) throw new Error('keytar not available; please install keytar');
        const service = `zen-agent@${os.hostname()}`;
        return keytar.setPassword(service, key, value);
    }

    async getSecret(key) {
        if (!keytar) throw new Error('keytar not available; please install keytar');
        const service = `zen-agent@${os.hostname()}`;
        return keytar.getPassword(service, key);
    }

    async deleteSecret(key) {
        if (!keytar) throw new Error('keytar not available; please install keytar');
        const service = `zen-agent@${os.hostname()}`;
        return keytar.deletePassword(service, key);
    }
}

module.exports = new MemoryService();

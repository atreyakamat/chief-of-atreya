const db = require('../db');

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
}

module.exports = new MemoryService();

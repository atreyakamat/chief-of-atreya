const db = require('../db');

function saveSnapshot(imagePath, extractedText) {
    const stmt = db.prepare('INSERT INTO snapshots (image_path, extracted_text) VALUES (?, ?)');
    const info = stmt.run(imagePath, extractedText);
    return { success: true, id: info.lastInsertRowid };
}

function getSnapshots(limit = 10) {
    return db.prepare('SELECT * FROM snapshots ORDER BY timestamp DESC LIMIT ?').all(limit);
}

function processScreenshotForReminders(snapshotId) {
    // Scaffold: Pass extracted_text to AI, find actionable items, and create reminders
    return { success: true, message: `Processed snapshot ${snapshotId} for actionable items` };
}

module.exports = {
    saveSnapshot,
    getSnapshots,
    processScreenshotForReminders
};

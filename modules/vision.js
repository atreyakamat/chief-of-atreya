const db = require('../db');
const ai = require('./ai');
const fs = require('fs');

function saveSnapshot(imagePath, extractedText = null) {
    const stmt = db.prepare('INSERT INTO snapshots (image_path, extracted_text) VALUES (?, ?)');
    const info = stmt.run(imagePath, extractedText);
    return { success: true, id: info.lastInsertRowid };
}

function getSnapshots(limit = 10) {
    return db.prepare('SELECT * FROM snapshots ORDER BY timestamp DESC LIMIT ?').all(limit);
}

async function processPendingSnapshots() {
    const pending = db.prepare('SELECT * FROM snapshots WHERE extracted_text IS NULL').all();
    
    if (pending.length === 0) return;
    
    console.log(`[Vision] Processing ${pending.length} pending snapshots...`);

    const updateStmt = db.prepare('UPDATE snapshots SET extracted_text = ? WHERE id = ?');

    for (const snap of pending) {
        try {
            if (fs.existsSync(snap.image_path)) {
                const imageBuffer = fs.readFileSync(snap.image_path);
                const base64Image = imageBuffer.toString('base64');
                
                const description = await ai.analyzeImage(base64Image);
                updateStmt.run(description, snap.id);
                console.log(`[Vision] Snapshot ${snap.id} processed successfully.`);
            } else {
                console.warn(`[Vision] Image missing for snapshot ${snap.id}`);
                updateStmt.run('[Image File Missing]', snap.id);
            }
        } catch (err) {
            console.error(`[Vision] Failed to process snapshot ${snap.id}:`, err);
            updateStmt.run('[Analysis Failed]', snap.id);
        }
    }
}

function processScreenshotForReminders(snapshotId) {
    // Scaffold: Pass extracted_text to AI, find actionable items, and create reminders
    return { success: true, message: `Processed snapshot ${snapshotId} for actionable items` };
}

module.exports = {
    saveSnapshot,
    getSnapshots,
    processPendingSnapshots,
    processScreenshotForReminders
};

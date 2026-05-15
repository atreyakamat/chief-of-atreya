const screenshot = require('screenshot-desktop');
const path = require('path');
const fs = require('fs');
const vision = require('./vision');
const Tesseract = require('tesseract.js');
const rag = require('./rag');

async function captureAndProcess() {
    console.log('[Zen] Capturing snapshot...');
    const filename = `snapshot_${Date.now()}.png`;
    const filepath = path.join(__dirname, '../snapshots', filename);
    
    if (!fs.existsSync(path.join(__dirname, '../snapshots'))) {
        fs.mkdirSync(path.join(__dirname, '../snapshots'));
    }

    try {
        await screenshot({ filename: filepath });
        console.log(`[Zen] Snapshot saved to ${filepath}`);

        // Save to DB immediately with null text; background process will analyze it
        const snapRes = vision.saveSnapshot(filepath, null);
        console.log('[Zen] Snapshot added to queue for background analysis.');

        // Also run lightweight local OCR and add to RAG memory instantly
        Tesseract.recognize(filepath, 'eng', { logger: m => {} }).then(({ data: { text } }) => {
            if (text && text.trim().length > 0) {
                rag.addToMemory(`snapshot:${snapRes.id}`, text.trim());
            }
        });

    } catch (err) {
        console.error('[Zen] Error capturing snapshot:', err);
    }
}

// Phase 3: Continuous Screen Capture
function startContinuousCapture() {
    console.log('[Zen] Starting continuous photographic memory (capture every 15s).');
    setInterval(() => {
        captureAndProcess();
    }, 15000); // 15 seconds to not kill CPU
}

module.exports = {
    captureAndProcess,
    startContinuousCapture
};

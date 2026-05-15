const screenshot = require('screenshot-desktop');
const path = require('path');
const fs = require('fs');
const vision = require('./vision');
const Tesseract = require('tesseract.js');
const rag = require('./rag');

const snapshotsDir = path.join(__dirname, '../snapshots');
if (!fs.existsSync(snapshotsDir)) {
    fs.mkdirSync(snapshotsDir);
}

// Keep track of processing files to avoid double-processing
const processingFiles = new Set();

async function captureAndProcess() {
    console.log('[Zen] Capturing snapshot via hotkey...');
    const filename = `snapshot_${Date.now()}.png`;
    const filepath = path.join(snapshotsDir, filename);

    try {
        await screenshot({ filename: filepath });
        console.log(`[Zen] Snapshot saved to ${filepath}. Watcher will pick it up.`);
    } catch (err) {
        console.error('[Zen] Error capturing snapshot:', err);
    }
}

// Event-driven folder watcher for OCR
function startFolderWatcher() {
    console.log('[Zen] Starting ultra-efficient folder watcher for OCR (Zero CPU when idle)...');
    
    fs.watch(snapshotsDir, (eventType, filename) => {
        if (eventType === 'rename' && filename && (filename.endsWith('.png') || filename.endsWith('.jpg'))) {
            const filepath = path.join(snapshotsDir, filename);
            
            // fs.watch can trigger multiple times. Ensure file exists and isn't already processing.
            if (fs.existsSync(filepath) && !processingFiles.has(filepath)) {
                processingFiles.add(filepath);
                
                // Add a small delay to ensure file is fully written before reading
                setTimeout(() => {
                    console.log(`[Zen] New image detected: ${filename}. Running local OCR...`);
                    
                    // 1. Save to DB for background AI Vision processing
                    const snapRes = vision.saveSnapshot(filepath, null);
                    
                    // 2. Run lightweight local OCR for RAG Memory
                    Tesseract.recognize(filepath, 'eng', { logger: m => {} }).then(({ data: { text } }) => {
                        if (text && text.trim().length > 0) {
                            rag.addToMemory(`snapshot:${snapRes.id}`, text.trim());
                            console.log(`[Zen] OCR complete for ${filename}. Added to RAG memory.`);
                        } else {
                            console.log(`[Zen] OCR complete for ${filename}. No text found.`);
                        }
                    }).catch(err => {
                        console.error(`[Zen] OCR failed for ${filename}:`, err.message);
                    }).finally(() => {
                        // Cleanup memory
                        processingFiles.delete(filepath);
                    });
                }, 500);
            }
        }
    });
}

module.exports = {
    captureAndProcess,
    startFolderWatcher
};

const screenshot = require('screenshot-desktop');
const path = require('path');
const fs = require('fs');
const vision = require('./vision');

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
        vision.saveSnapshot(filepath, null);
        console.log('[Zen] Snapshot added to queue for background analysis.');
    } catch (err) {
        console.error('[Zen] Error capturing snapshot:', err);
    }
}

module.exports = {
    captureAndProcess
};

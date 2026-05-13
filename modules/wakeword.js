const { spawn } = require('child_process');
const path = require('path');

let detector = null;

function startWakeWordDetection(onWakeWord) {
    console.log('[Zen] Initializing wake word detector...');
    
    // Spawn python process
    detector = spawn('python', [path.join(__dirname, 'detector.py')]);

    detector.stdout.on('data', (data) => {
        const msg = data.toString().trim();
        if (msg.startsWith('DETECTED:')) {
            console.log('[Zen] Wake word detected!');
            onWakeWord();
        } else {
            console.log(`[Detector]: ${msg}`);
        }
    });

    detector.stderr.on('data', (data) => {
        console.error(`[Detector Error]: ${data}`);
    });
}

function stopWakeWordDetection() {
    if (detector) {
        detector.kill();
    }
}

module.exports = {
    startWakeWordDetection,
    stopWakeWordDetection
};

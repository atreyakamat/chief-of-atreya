const { spawn } = require('child_process');
const path = require('path');

let detector = null;

function startWakeWordDetection(onWakeWord) {
    console.log('[Zen] Initializing wake word detector...');
    
    // Ensure we are using the system python. 
    // On Windows, 'python' might refer to the Windows Store shim.
    detector = spawn('python', [path.join(__dirname, 'detector.py')], {
        stdio: ['pipe', 'pipe', 'pipe']
    });

    detector.stdout.on('data', (data) => {
        const lines = data.toString().split('\n');
        lines.forEach(line => {
            const msg = line.trim();
            if (msg.startsWith('DETECTED:')) {
                console.log('[Zen] Wake word detected!');
                onWakeWord();
            } else if (msg.length > 0) {
                console.log(`[Detector]: ${msg}`);
            }
        });
    });

    detector.stderr.on('data', (data) => {
        console.error(`[Detector Error]: ${data}`);
    });

    detector.on('close', (code) => {
        console.log(`[Detector] Process exited with code ${code}`);
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

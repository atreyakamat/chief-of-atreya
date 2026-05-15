const { spawn } = require('child_process');
const path = require('path');

let pyProcess = null;

function initialize() {
    pyProcess = spawn('python', [path.join(__dirname, 'os_control.py')]);
    
    pyProcess.stdout.on('data', (data) => {
        // Output from python
        // console.log(`[OS Control] ${data.toString().trim()}`);
    });
    
    pyProcess.stderr.on('data', (data) => {
        console.error(`[OS Control Error] ${data.toString().trim()}`);
    });
    console.log('[OS Control] Initialized deep OS control via PyAutoGUI.');
}

function sendCommand(cmdObj) {
    return new Promise((resolve) => {
        if (!pyProcess) {
            resolve({ status: 'error', message: 'Not initialized' });
            return;
        }

        const onData = (data) => {
            try {
                const res = JSON.parse(data.toString().trim());
                pyProcess.stdout.off('data', onData);
                resolve(res);
            } catch (e) {
                // Ignore partial JSON
            }
        };
        
        pyProcess.stdout.on('data', onData);
        pyProcess.stdin.write(JSON.stringify(cmdObj) + '\n');
        
        // Timeout
        setTimeout(() => {
            pyProcess.stdout.off('data', onData);
            resolve({ status: 'error', message: 'Timeout' });
        }, 5000);
    });
}

async function clickMouse(x = null, y = null) {
    return await sendCommand({ action: 'click', x, y });
}

async function typeKeyboard(text, enter = false) {
    return await sendCommand({ action: 'type', text, enter });
}

async function openApp(appName) {
    return await sendCommand({ action: 'open', app: appName });
}

module.exports = {
    initialize,
    clickMouse,
    typeKeyboard,
    openApp
};
const { spawn } = require('child_process');

const modules = {
    whatsapp: { cmd: 'node', args: ['-e', 'require("./modules/whatsapp").initialize()'], retries: 0 },
    wakeword: { cmd: 'python', args: ['modules/detector.py'], retries: 0 }
};

const MAX_RETRIES = 5;

function startModule(name, config) {
    console.log(`[Watchdog] Starting ${name}...`);
    const proc = spawn(config.cmd, config.args);

    proc.on('close', (code) => {
        console.warn(`[Watchdog] ${name} exited with code ${code}.`);
        if (config.retries < MAX_RETRIES) {
            config.retries++;
            const delay = Math.pow(2, config.retries) * 1000;
            console.log(`[Watchdog] Restarting ${name} in ${delay}ms (Attempt ${config.retries}/${MAX_RETRIES})...`);
            setTimeout(() => startModule(name, config), delay);
        } else {
            console.error(`[Watchdog] ${name} failed after ${MAX_RETRIES} attempts. Manual intervention required.`);
        }
    });
}

function initialize() {
    Object.keys(modules).forEach(name => startModule(name, modules[name]));
}

module.exports = { initialize };

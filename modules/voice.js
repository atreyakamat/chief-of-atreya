const { spawn } = require('child_process');
const path = require('path');
const EventEmitter = require('events');

class VoiceService extends EventEmitter {
    constructor() {
        super();
        this.pythonProcess = null;
        this.ready = false;
    }

    start() {
        const scriptPath = path.join(__dirname, 'voice_engine.py');
        this.pythonProcess = spawn('python', [scriptPath]);

        this.pythonProcess.stdout.on('data', (data) => {
            const lines = data.toString().split('\n').filter(l => l.trim().length > 0);
            for (const line of lines) {
                try {
                    const msg = JSON.parse(line);
                    this.handleMessage(msg);
                } catch (e) {
                    console.log('[Voice Engine Raw]:', line);
                }
            }
        });

        this.pythonProcess.stderr.on('data', (data) => {
            console.error('[Voice Engine Error]:', data.toString());
        });

        this.pythonProcess.on('close', (code) => {
            console.log(`Voice engine process exited with code ${code}`);
            this.ready = false;
        });
    }

    handleMessage(msg) {
        if (msg.event === 'ready') {
            this.ready = true;
            this.emit('ready', msg);
            console.log('Voice engine is ready. Microphones available:', msg.has_voice);
        } else if (msg.event === 'speak_done') {
            this.emit('speak_done');
        } else if (msg.event === 'transcription') {
            // Emitted when wake word triggers and user speaks
            this.emit('transcription', msg.text);
        } else if (msg.event === 'error') {
            console.error('[Voice Engine API Error]:', msg.error);
        }
    }

    speak(text) {
        if (!this.ready || !this.pythonProcess) {
            console.error('Cannot speak: Voice engine not ready');
            return;
        }
        this.pythonProcess.stdin.write(JSON.stringify({ command: 'speak', text }) + '\n');
    }

    stop() {
        if (this.pythonProcess) {
            this.pythonProcess.stdin.write(JSON.stringify({ command: 'stop' }) + '\n');
            this.pythonProcess.kill();
        }
    }
}

module.exports = new VoiceService();

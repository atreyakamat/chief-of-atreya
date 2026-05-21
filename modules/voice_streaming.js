const { EventEmitter } = require('events');
const { exec, spawn } = require('child_process');

class VoiceStreamingEngine extends EventEmitter {
    constructor() {
        super();
        this.isConnected = true;
        this.ttsEngine = 'system';
        this.audioProcess = null;
    }

    connect() {
        console.log(`[VoiceStream] Connecting to local Native TTS Engine for Zen...`);
        this.emit('ready');
    }

    sendAudioChunk(buffer) {
        // Microphone input logic (handled by client normally)
    }

    async streamSpeech(text) {
        if (!this.isConnected || !text) return;
        console.log(`[Zen Voice] Speaking: "${text}"`);
        this.emit('playing');
        
        // Show visual feedback popup
        try {
            const { BrowserWindow } = require('electron');
            const popup = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('popup.html'));
            if (popup) {
                popup.webContents.send('update-popup-text', text);
                popup.show();
                // We'll hide it after speaking finishes or a fixed delay if not sure
                // But for now, let's keep it visible for a bit
                setTimeout(() => popup.hide(), Math.max(3000, text.length * 100));
            }
        } catch (e) {}

        // Clean text for PowerShell execution
        const cleanText = text.replace(/"/g, '`"').replace(/'/g, "`'").replace(/\n/g, ' ');

        // Use native Windows Speech Synthesizer
        // We select the first available voice (usually David or Zira) but you can tweak it to sound more "Jarvis-like" if specific voices are installed.
        const psScript = `
            Add-Type -AssemblyName System.Speech
            $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
            $synth.Speak("${cleanText}")
        `;

        try {
            this.audioProcess = exec(`powershell -NoProfile -Command "${psScript}"`, (error) => {
                if (error && error.killed === false) {
                    console.error('[Zen Voice] TTS Error:', error);
                }
                this.emit('done_playing');
            });
        } catch (err) {
            console.error('[Zen Voice] Process launch error:', err.message);
            this.emit('done_playing');
        }
    }

    stopSpeak() {
        if (this.audioProcess) {
            // Kill the powershell process to stop TTS
            exec(`taskkill /PID ${this.audioProcess.pid} /T /F`, () => {
                console.log('[Zen Voice] Speech interrupted manually.');
                this.emit('done_playing');
            });
            this.audioProcess = null;
        }
    }
}

module.exports = new VoiceStreamingEngine();
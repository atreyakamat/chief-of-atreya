const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Supertonic TTS Bridge
 * This interfaces with the local ONNX-based Supertonic TTS engine.
 * Requires the user to have cloned the repo to C:\Projects\chief-of-atreya\supertonic
 */
function generateSpeech(text, outputPath = path.join(__dirname, '../ui/output.wav')) {
    return new Promise((resolve, reject) => {
        const supertonicDir = path.join(__dirname, '../supertonic/nodejs');
        
        if (!fs.existsSync(supertonicDir)) {
            console.error('[Supertonic] Engine not found.');
            return reject(new Error("Supertonic TTS not installed. Please clone the repository into the 'supertonic' folder."));
        }

        console.log(`[Supertonic] Generating high-speed TTS...`);
        
        // Mock command structure based on the provided Node.js execution format
        const proc = spawn('npm', ['start', '--', '--text', text, '--output', outputPath], { 
            cwd: supertonicDir,
            shell: true 
        });

        proc.stdout.on('data', data => console.log(`[Supertonic]: ${data.toString().trim()}`));
        proc.stderr.on('data', data => console.error(`[Supertonic Error]: ${data.toString().trim()}`));

        proc.on('close', code => {
            if (code === 0) {
                console.log(`[Supertonic] Audio generated at ${outputPath}`);
                resolve(outputPath);
            } else {
                reject(new Error(`Supertonic TTS failed with code ${code}`));
            }
        });
    });
}

module.exports = {
    generateSpeech
};
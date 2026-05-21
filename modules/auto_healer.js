const { spawn } = require('child_process');
const ai = require('./ai');
const fs = require('fs');
const os = require('os');
const path = require('path');
const hitl = require('./hitl');

class AutoHealer {
    async executeWithHealing(command, maxRetries = 2) {
        console.log(`[AutoHealer] Requested execute: ${command}`);

        // Detect obviously destructive commands and require HITL
        const destructiveRegex = /\b(remove-item|rm\s+-rf|del\s+\/s|format\-volume|format\-|erase\s+|rd\s+\/s|rmdir\s+\/s)\b/i;
        if (destructiveRegex.test(command) || process.env.AUTO_HEALER_AUTOEXEC !== 'true') {
            const pending = hitl.createPendingAction('auto_healer_execute', { command });
            throw new Error(`Auto-Healer requires approval before executing this command. Action ID: ${pending.id}`);
        }

        let currentTry = 0;
        let currentCommand = command;

        while (currentTry <= maxRetries) {
            try {
                const result = await this.runShell(currentCommand);
                console.log(`[AutoHealer] Success: ${currentCommand}`);
                return result;
            } catch (error) {
                console.error(`[AutoHealer] Execution failed (Attempt ${currentTry + 1}):`, error.message);
                if (currentTry === maxRetries) {
                    throw new Error(`AutoHealer failed after ${maxRetries} retries. Final error: ${error.message}`);
                }

                console.log(`[AutoHealer] Invoking AI for auto-correction (suggest-only)...`);
                // Ask AI to propose a corrected command but do not auto-run it; require approval.
                const prompt = `I attempted to run this PowerShell command:\n${currentCommand}\nIt failed with error:\n${error.message}\nProvide ONLY a corrected PowerShell command (single line) that would likely fix the issue. Do NOT include explanations.`;

                try {
                    const aiFix = await ai.processCommand(prompt, { platform: { currentView: 'AutoHealer' } });
                    let fixedCommand = aiFix.text.trim();
                    fixedCommand = fixedCommand.replace(/^```(?:powershell|ps1)?\s*/i, '').replace(/```$/i, '').trim();

                    console.log(`[AutoHealer] AI Suggested Fix (proposed, not run): ${fixedCommand}`);
                    // Create a pending HITL approval for the suggested fix
                    const pending = hitl.createPendingAction('auto_healer_suggestion', { original: currentCommand, suggestion: fixedCommand });
                    throw new Error(`Auto-Healer proposed a fix and requires approval. Action ID: ${pending.id}`);
                } catch (aiError) {
                    console.error('[AutoHealer] AI correction failed:', aiError.message || aiError);
                    throw error; // Throw original error if AI fails
                }
            }
        }
    }

    runShell(command) {
        return new Promise((resolve, reject) => {
            // Write command into a temporary .ps1 file to avoid fragile inline escaping
            const tmpDir = os.tmpdir();
            const filename = `zen_cmd_${Date.now()}.ps1`;
            const filepath = path.join(tmpDir, filename);

            try {
                fs.writeFileSync(filepath, command, { encoding: 'utf8' });
            } catch (e) {
                return reject(new Error('Failed to write temporary script: ' + e.message));
            }

            const child = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', filepath], { windowsHide: true });
            let stdout = '';
            let stderr = '';

            child.stdout.on('data', (d) => { stdout += d.toString(); });
            child.stderr.on('data', (d) => { stderr += d.toString(); });

            child.on('close', (code) => {
                // Clean up temp file
                try { fs.unlinkSync(filepath); } catch (e) {}

                if (code !== 0) {
                    return reject(new Error(stderr || stdout || `Exit code ${code}`));
                }
                if (stderr && stderr.trim().length > 0) {
                    return reject(new Error(stderr));
                }
                resolve(stdout.trim());
            });

            child.on('error', (err) => {
                try { fs.unlinkSync(filepath); } catch (e) {}
                reject(err);
            });
        });
    }
}

module.exports = new AutoHealer();

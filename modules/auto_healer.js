const { exec } = require('child_process');
const ai = require('./ai');

class AutoHealer {
    async executeWithHealing(command, maxRetries = 2) {
        console.log(`[AutoHealer] Executing: ${command}`);
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

                console.log(`[AutoHealer] Invoking AI for auto-correction...`);
                // Ask AI to fix the command based on the error
                const prompt = `I tried to execute this shell command on Windows PowerShell:\n\`\`\`\n${currentCommand}\n\`\`\`\nIt failed with this error:\n\`\`\`\n${error.message}\n\`\`\`\nPlease provide ONLY the corrected Windows PowerShell command to fix this. Do not include markdown formatting or explanations. Just the raw command.`;
                
                try {
                    const aiFix = await ai.processCommand(prompt, { platform: { currentView: 'AutoHealer' } });
                    let fixedCommand = aiFix.text.trim();
                    // Clean up markdown if AI accidentally included it
                    fixedCommand = fixedCommand.replace(/^```(powershell|ps1)?\s*/i, '').replace(/```$/i, '').trim();
                    
                    console.log(`[AutoHealer] AI Suggested Fix: ${fixedCommand}`);
                    currentCommand = fixedCommand;
                    currentTry++;
                } catch (aiError) {
                    console.error('[AutoHealer] AI correction failed:', aiError);
                    throw error; // Throw original error if AI fails
                }
            }
        }
    }

    runShell(command) {
        return new Promise((resolve, reject) => {
            exec(`powershell -NoProfile -Command "${command.replace(/"/g, '\\"')}"`, (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(stderr || stdout || error.message));
                    return;
                }
                if (stderr && stderr.trim().length > 0) {
                     // PowerShell sometimes writes warnings to stderr but succeeds. We'll be strict here.
                    reject(new Error(stderr));
                    return;
                }
                resolve(stdout.trim());
            });
        });
    }
}

module.exports = new AutoHealer();

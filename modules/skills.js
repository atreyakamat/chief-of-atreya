const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');
const os = require('os');

class SkillsService {
    constructor() {
        this.skills = new Map();
        this.channels = new Map();
        this.activeChannel = 'general';
        
        this.registerDefaultSkills();
        this.registerDefaultChannels();
    }

    registerDefaultSkills() {
        this.skills.set('web_search', {
            name: 'web_search',
            description: 'Search the web for information',
            handler: async (input) => {
                return `Web search for "${input}" - Configure a search API for live results.`;
            }
        });

        this.skills.set('calculator', {
            name: 'calculator',
            description: 'Perform calculations',
            handler: async (input) => {
                try {
                    const sanitized = input.replace(/[^0-9+\-*/.() ]/g, '');
                    const result = eval(sanitized);
                    return `Result: ${result}`;
                } catch (e) {
                    return `Calculation error: ${e.message}`;
                }
            }
        });

        this.skills.set('system_info', {
            name: 'system_info',
            description: 'Get system information',
            handler: async () => {
                const cpus = os.cpus();
                const totalMem = os.totalmem();
                const freeMem = os.freemem();
                return `System: ${os.hostname()}
OS: ${os.type()} ${os.release()}
CPU: ${cpus[0].model}
Cores: ${cpus.length}
Memory: ${Math.round((totalMem - freeMem) / 1024 / 1024 / 1024)}GB / ${Math.round(totalMem / 1024 / 1024 / 1024)}GB
Uptime: ${Math.floor(os.uptime() / 3600)}h`;
            }
        });

        this.skills.set('open_app', {
            name: 'open_app',
            description: 'Open an application',
            handler: async (appName) => {
                const platform = os.platform();
                try {
                    if (platform === 'win32') {
                        exec(`start ${appName}`);
                    } else if (platform === 'darwin') {
                        exec(`open -a "${appName}"`);
                    } else {
                        exec(`xdg-open ${appName}`);
                    }
                    return `Opened ${appName}`;
                } catch (e) {
                    return `Failed to open ${appName}: ${e.message}`;
                }
            }
        });

        this.skills.set('run_command', {
            name: 'run_command',
            description: 'Run a shell command',
            handler: async (command) => {
                return new Promise((resolve) => {
                    exec(command, { timeout: 10000 }, (error, stdout, stderr) => {
                        if (error) {
                            resolve(`Error: ${error.message}`);
                        } else {
                            resolve(stdout || stderr);
                        }
                    });
                });
            }
        });

        this.skills.set('weather', {
            name: 'weather',
            description: 'Get weather information',
            handler: async (input) => {
                return 'Weather feature requires API configuration. Add WEATHER_API_KEY to .env';
            }
        });

        this.skills.set('code_runner', {
            name: 'code_runner',
            description: 'Run code snippets',
            handler: async (code) => {
                const ext = code.includes('print') ? 'py' : code.includes('console.log') ? 'js' : 'txt';
                const tmpFile = path.join(os.tmpdir(), `chief_code.${ext}`);
                
                fs.writeFileSync(tmpFile, code);
                
                return new Promise((resolve) => {
                    const cmd = ext === 'py' ? `python ${tmpFile}` : `node ${tmpFile}`;
                    exec(cmd, { timeout: 5000 }, (error, stdout, stderr) => {
                        fs.unlinkSync(tmpFile);
                        resolve(stdout || stderr || (error ? error.message : 'Code executed'));
                    });
                });
            }
        });
    }

    registerDefaultChannels() {
        this.channels.set('general', {
            name: 'general',
            description: 'General conversation',
            skills: Array.from(this.skills.keys())
        });

        this.channels.set('work', {
            name: 'work',
            description: 'Work-related tasks',
            skills: ['calculator', 'system_info', 'run_command', 'code_runner']
        });

        this.channels.set('quick', {
            name: 'quick',
            description: 'Quick commands only',
            skills: ['calculator', 'system_info']
        });
    }

    getSkills() {
        return Array.from(this.skills.values());
    }

    getSkill(name) {
        return this.skills.get(name);
    }

    async executeSkill(name, input) {
        const skill = this.skills.get(name);
        if (!skill) {
            return { success: false, error: `Skill "${name}" not found` };
        }
        
        try {
            const result = await skill.handler(input);
            return { success: true, result };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    getChannels() {
        return Array.from(this.channels.values());
    }

    getChannel(name) {
        return this.channels.get(name);
    }

    setActiveChannel(name) {
        if (this.channels.has(name)) {
            this.activeChannel = name;
            return true;
        }
        return false;
    }

    getActiveChannel() {
        return this.channels.get(this.activeChannel);
    }

    addCustomSkill(skill) {
        this.skills.set(skill.name, {
            ...skill,
            handler: async (input) => skill.handler(input)
        });
    }

    addCustomChannel(channel) {
        this.channels.set(channel.name, channel);
    }
}

module.exports = new SkillsService();

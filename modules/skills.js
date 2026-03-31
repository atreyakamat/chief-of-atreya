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
                const query = encodeURIComponent(input);
                return `Search for "${input}": https://duckduckgo.com/?q=${query}`;
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
            dangerous: true,
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
            dangerous: true,
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
            description: 'Get weather information for a city',
            handler: async (city) => {
                const apiKey = process.env.WEATHER_API_KEY;
                if (!apiKey || apiKey === 'your_openweather_key_here') {
                    return 'Weather API key not configured. Please add WEATHER_API_KEY to your .env file.';
                }
                try {
                    const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`);
                    const data = await response.json();
                    if (data.cod !== 200) return `Error: ${data.message}`;
                    
                    return `Weather in ${data.name}: ${data.weather[0].description}, ${data.main.temp}°C (Feels like ${data.main.feels_like}°C). Humidity: ${data.main.humidity}%.`;
                } catch (e) {
                    return `Weather check failed: ${e.message}`;
                }
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

        this.skills.set('morning_briefing', {
            name: 'morning_briefing',
            description: 'Get a summary of your day (reminders, weather, notifications)',
            handler: async () => {
                const reminders = require('./reminders');
                const notifications = require('./notifications');
                const memory = require('./memory');
                
                const activeReminders = reminders.getActiveReminders();
                const recentNotifs = notifications.getRecentNotifications ? notifications.getRecentNotifications(10) : [];
                const city = memory.getFact('favorite_city') || 'London';
                
                let briefing = `Good morning! Here is your briefing for today:\n\n`;
                
                // Weather part
                const weatherSkill = this.skills.get('weather');
                if (weatherSkill) {
                    const weatherRes = await weatherSkill.handler(city);
                    briefing += `🌤️ Weather (${city}): ${weatherRes}\n\n`;
                }
                
                // Reminders part
                if (activeReminders && activeReminders.length > 0) {
                    briefing += `⏰ Reminders:\n` + activeReminders.map(r => `- ${r.text} (${new Date(r.due_time).toLocaleTimeString()})`).join('\n') + `\n\n`;
                } else {
                    briefing += `⏰ No reminders for today.\n\n`;
                }
                
                // Notifications part
                if (recentNotifs && recentNotifs.length > 0) {
                    const urgent = recentNotifs.filter(n => n.priority === 'urgent');
                    if (urgent.length > 0) {
                        briefing += `🔔 Urgent Notifications:\n` + urgent.map(n => `- ${n.title}: ${n.body}`).join('\n') + `\n\n`;
                    }
                }
                
                return briefing + `Have a productive day!`;
            }
        });
    }

    registerDefaultChannels() {
        this.channels.set('general', {
            name: 'general',
            description: 'General conversation',
            skills: [...Array.from(this.skills.keys()), 'morning_briefing']
        });

        this.channels.set('work', {
            name: 'work',
            description: 'Work-related tasks',
            skills: ['calculator', 'system_info', 'run_command', 'code_runner', 'weather', 'morning_briefing']
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

    async executeSkill(name, input, confirmed = false) {
        const skill = this.skills.get(name);
        if (!skill) {
            return { success: false, error: `Skill "${name}" not found` };
        }
        
        if (skill.dangerous && !confirmed) {
            return { 
                success: false, 
                error: `This skill is marked as dangerous and needs manual confirmation.`, 
                needs_confirmation: true,
                skillName: name,
                input: input
            };
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

require('dotenv').config();
const http = require('http');

const memory = require('./memory');

class AIService {
    constructor() {
        this.provider = 'ollama';
        this.conversationHistory = [];
        this.maxHistory = 20;
        
        this.baseSystemPrompt = `You are CHIEF, a local AI Chief of Staff. You help the user stay focused, manage reminders, and answer questions.
Current Time: ${new Date().toISOString()}

Capabilities:
- Create/delete reminders with set_reminder/delete_reminder tools
- Speak responses aloud with speak_response tool
- Get notifications with get_notifications tool
- Get browser tabs with get_browser_tabs tool
- Get weather for a city with use_skill(skillName: "weather", input: "City Name")
- Search the web with use_skill(skillName: "web_search", input: "Query")
- Remember a fact about the user with remember_fact(key: "string", value: "string")
- Use other skills like calculator, system_info, etc.

Always be concise and helpful.`;

        this.tools = [
            // ... existing tools ...
            {
                type: "function",
                function: {
                    name: "remember_fact",
                    description: "Save a fact about the user for long-term memory.",
                    parameters: {
                        type: "object",
                        properties: {
                            key: { type: "string", description: "The name of the fact, e.g. 'favorite_city'" },
                            value: { type: "string", description: "The value of the fact, e.g. 'New York'" }
                        },
                        required: ["key", "value"]
                    }
                }
            },
            // ... keep other tools ...
            {
                type: "function",
                function: {
                    name: "set_reminder",
                    description: "Create a new reminder for the user.",
                    parameters: {
                        type: "object",
                        properties: {
                            text: { type: "string", description: "The content of the reminder" },
                            dueTime: { type: "string", description: "ISO string timestamp of when it is due" },
                            recurringRule: { type: "string", description: "Optional recur rule, e.g. 'daily'" }
                        },
                        required: ["text", "dueTime"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "delete_reminder",
                    description: "Delete a reminder by ID.",
                    parameters: {
                        type: "object",
                        properties: {
                            id: { type: "integer", description: "The ID of the reminder to delete" }
                        },
                        required: ["id"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "speak_response",
                    description: "Speak the response aloud using the Voice Engine.",
                    parameters: {
                        type: "object",
                        properties: {
                            text: { type: "string", description: "The text to speak aloud" }
                        },
                        required: ["text"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "get_notifications",
                    description: "Get recent notifications from the system.",
                    parameters: {
                        type: "object",
                        properties: {
                            limit: { type: "integer", description: "Number of notifications to retrieve", default: 10 }
                        }
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "get_browser_tabs",
                    description: "Get current browser tabs information.",
                    parameters: {
                        type: "object",
                        properties: {}
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "use_skill",
                    description: "Use a skill to perform specialized tasks.",
                    parameters: {
                        type: "object",
                        properties: {
                            skillName: { type: "string", description: "Name of the skill to use" },
                            input: { type: "string", description: "Input for the skill" }
                        },
                        required: ["skillName", "input"]
                    }
                }
            }
        ];
    }

    setProvider(provider) {
        this.provider = provider; // For backward compatibility if needed, but only Ollama is supported
    }

    getProvider() {
        return 'ollama';
    }

    async checkConnection() {
        return await this.checkOllama();
    }

    async checkOllama() {
        try {
            const res = await this.makeRequest('ollama', '/api/tags', {});
            return true;
        } catch (err) {
            return false;
        }
    }

    makeRequest(host, endpoint, data) {
        return new Promise((resolve, reject) => {
            const baseUrl = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
            const url = new URL(endpoint, baseUrl);
            const postData = JSON.stringify(data);
            
            const options = {
                hostname: url.hostname,
                port: url.port || 11434,
                path: url.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                }
            };

            const req = http.request(options, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(body));
                    } catch (e) {
                        resolve(body);
                    }
                });
            });

            req.on('error', reject);
            req.write(postData);
            req.end();
        });
    }

    async processCommand(text, context, skills = {}) {
        const facts = memory.getAllFacts();
        const factsStr = facts.map(f => `${f.key}: ${f.value}`).join('\n') || 'None';
        
        const augmentedSystem = `${this.baseSystemPrompt}

Long-term User Facts:
${factsStr}

Available Skills: ${Object.keys(skills).join(', ') || 'none'}
${skills ? 'Skills can be used with use_skill tool.' : ''}

Active Tabs: ${JSON.stringify(context.tabs || [])}
Recent Notifications: ${JSON.stringify(context.notifications || [])}
Active Reminders: ${JSON.stringify(context.reminders || [])}
Current Channel: ${context.channel || 'general'}`;

        this.conversationHistory.push({ role: 'user', content: text });
        if (this.conversationHistory.length > this.maxHistory) {
            this.conversationHistory = this.conversationHistory.slice(-this.maxHistory);
        }

        try {
            const response = await this.makeRequest('ollama', '/api/chat', {
                model: process.env.OLLAMA_MODEL || 'llama3.2',
                messages: [
                    { role: 'system', content: augmentedSystem },
                    ...this.conversationHistory
                ],
                tools: this.tools,
                stream: false
            });
            
            if (response && response.message) {
                const assistantMsg = response.message;
                this.conversationHistory.push(assistantMsg);
                
                return {
                    response: response,
                    text: assistantMsg.content || '',
                    tool_calls: assistantMsg.tool_calls || []
                };
            }
            throw new Error('Invalid response from Ollama');
        } catch (err) {
            console.error('AI Error:', err);
            throw err;
        }
    }

    async submitToolResults(toolResults, skills = {}) {
        if (!toolResults || toolResults.length === 0) return null;

        const facts = memory.getAllFacts();
        const factsStr = facts.map(f => `${f.key}: ${f.value}`).join('\n') || 'None';

        this.conversationHistory.push({ role: 'user', content: toolResults.map(t => 
            `Tool result: ${t.content}`
        ).join('\n')});

        try {
            const response = await this.makeRequest('ollama', '/api/chat', {
                model: process.env.OLLAMA_MODEL || 'llama3.2',
                messages: [
                    { role: 'system', content: `${this.baseSystemPrompt}\n\nLong-term User Facts:\n${factsStr}` },
                    ...this.conversationHistory
                ],
                tools: this.tools,
                stream: false
            });

            if (response && response.message) {
                const assistantMsg = response.message;
                this.conversationHistory.push(assistantMsg);

                return {
                    response: response,
                    text: assistantMsg.content || '',
                    tool_calls: assistantMsg.tool_calls || []
                };
            }
            throw new Error('Invalid response from Ollama');
        } catch (err) {
            console.error('Tool followup error:', err);
            throw err;
        }
    }

    clearHistory() {
        this.conversationHistory = [];
    }
}

module.exports = new AIService();

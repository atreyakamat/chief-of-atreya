require('dotenv').config();
const http = require('http');

class AIService {
    constructor() {
        this.provider = process.env.AI_PROVIDER || 'ollama';
        this.conversationHistory = [];
        this.maxHistory = 20;
        
        this.systemPrompt = `You are CHIEF, a local AI Chief of Staff. You help the user stay focused, manage reminders, and answer questions.
Current Time: ${new Date().toISOString()}

Capabilities:
- Create/delete reminders with set_reminder/delete_reminder tools
- Speak responses aloud with speak_response tool
- Get notifications with get_notifications tool
- Get browser tabs with get_browser_tabs tool
- Use skills for specialized tasks

Always be concise and helpful.`;

        this.tools = [
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
        this.provider = provider;
    }

    getProvider() {
        return this.provider;
    }

    async checkConnection() {
        if (this.provider === 'ollama') {
            return await this.checkOllama();
        } else if (this.provider === 'claude') {
            return await this.checkClaude();
        }
        return false;
    }

    async checkOllama() {
        try {
            const res = await this.makeRequest('ollama', '/api/tags', {});
            return res;
        } catch (err) {
            return null;
        }
    }

    async checkClaude() {
        if (!process.env.ANTHROPIC_API_KEY) return null;
        try {
            const { Anthropic } = require('@anthropic-ai/sdk');
            const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
            await client.messages.create({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 1,
                messages: [{ role: 'user', content: 'hi' }]
            });
            this.claudeClient = client;
            return true;
        } catch (err) {
            return null;
        }
    }

    makeRequest(host, endpoint, data) {
        return new Promise((resolve, reject) => {
            const isOllama = host === 'ollama';
            const url = new URL(endpoint, isOllama ? process.env.OLLAMA_HOST : 'https://api.anthropic.com');
            const postData = JSON.stringify(data);
            
            const options = {
                hostname: url.hostname,
                port: url.port || (isOllama ? 11434 : 443),
                path: url.pathname,
                method: 'POST',
                headers: isOllama ? {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                } : {
                    'Content-Type': 'application/json',
                    'x-api-key': process.env.ANTHROPIC_API_KEY,
                    'anthropic-version': '2023-06-01',
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
        const augmentedSystem = `${this.systemPrompt}

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
            let response;
            
            if (this.provider === 'ollama') {
                response = await this.makeRequest('ollama', '/api/chat', {
                    model: process.env.OLLAMA_MODEL || 'llama3.2',
                    messages: [
                        { role: 'system', content: augmentedSystem },
                        ...this.conversationHistory
                    ],
                    tools: this.tools,
                    stream: false
                });
                
                const assistantMsg = response.message;
                this.conversationHistory.push(assistantMsg);
                
                return {
                    response: response,
                    text: assistantMsg.content || '',
                    tool_calls: assistantMsg.tool_calls || []
                };
                
            } else if (this.provider === 'claude' && this.claudeClient) {
                response = await this.claudeClient.messages.create({
                    model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
                    max_tokens: 1024,
                    system: augmentedSystem,
                    messages: this.conversationHistory,
                    tools: this.tools.map(t => ({
                        name: t.function.name,
                        description: t.function.description,
                        input_schema: t.function.parameters
                    }))
                });
                
                const assistantMsg = response.content[0];
                this.conversationHistory.push({ role: 'assistant', content: response.content });
                
                return {
                    response: response,
                    text: assistantMsg.type === 'text' ? assistantMsg.text : '',
                    tool_calls: response.content.filter(c => c.type === 'tool_use').map(c => ({
                        name: c.name,
                        input: c.input
                    }))
                };
            }
            
            throw new Error('AI provider not configured');
            
        } catch (err) {
            console.error('AI Error:', err);
            throw err;
        }
    }

    async submitToolResults(toolResults, skills = {}) {
        if (!toolResults || toolResults.length === 0) return null;

        this.conversationHistory.push({ role: 'user', content: toolResults.map(t => 
            `Tool result: ${t.content}`
        ).join('\n')});

        try {
            let response;
            
            if (this.provider === 'ollama') {
                response = await this.makeRequest('ollama', '/api/chat', {
                    model: process.env.OLLAMA_MODEL || 'llama3.2',
                    messages: [
                        { role: 'system', content: this.systemPrompt },
                        ...this.conversationHistory
                    ],
                    tools: this.tools,
                    stream: false
                });

                const assistantMsg = response.message;
                this.conversationHistory.push(assistantMsg);

                return {
                    response: response,
                    text: assistantMsg.content || '',
                    tool_calls: assistantMsg.tool_calls || []
                };
                
            } else if (this.provider === 'claude' && this.claudeClient) {
                response = await this.claudeClient.messages.create({
                    model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
                    max_tokens: 1024,
                    system: this.systemPrompt,
                    messages: this.conversationHistory,
                    tools: this.tools.map(t => ({
                        name: t.function.name,
                        description: t.function.description,
                        input_schema: t.function.parameters
                    }))
                });

                const assistantMsg = response.content[0];
                this.conversationHistory.push({ role: 'assistant', content: response.content });

                return {
                    response: response,
                    text: assistantMsg.type === 'text' ? assistantMsg.text : '',
                    tool_calls: response.content.filter(c => c.type === 'tool_use').map(c => ({
                        name: c.name,
                        input: c.input
                    }))
                };
            }
            
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

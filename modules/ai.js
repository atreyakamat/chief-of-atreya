require('dotenv').config();
const http = require('http');
const https = require('https');

const memory = require('./memory');

const PROVIDER_CONFIG = {
    openai: { hostname: 'api.openai.com', path: '/v1/chat/completions', keyEnv: 'OPENAI_API_KEY' },
    groq: { hostname: 'api.groq.com', path: '/openai/v1/chat/completions', keyEnv: 'GROQ_API_KEY' },
    openrouter: { hostname: 'openrouter.ai', path: '/api/v1/chat/completions', keyEnv: 'OPENROUTER_API_KEY' },
    nvidia: { hostname: 'integrate.api.nvidia.com', path: '/v1/chat/completions', keyEnv: 'NVIDIA_API_KEY' },
    qwen: { hostname: 'dashscope-intl.aliyuncs.com', path: '/compatible-mode/v1/chat/completions', keyEnv: 'QWEN_API_KEY' }
};

class AIService {
    constructor() {
        this.provider = process.env.AI_PROVIDER || 'ollama'; // Default to ollama, can be openai, groq, openrouter, nvidia, qwen
        this.conversationHistory = [];
        this.maxHistory = 20;
        
        this.baseSystemPrompt = `You are Zen, a local Multi-Agent Supervisor and personal Chief of Staff. You manage the user's entire life, work, and health.
Current Time: ${new Date().toISOString()}

Supervisor Capabilities (Better than OpenClaw):
- You don't just execute; you orchestrate. Use delegate_task to assign complex coding, research, or writing tasks to specialized sub-agents.
- Manage life and health: Use clock_in and clock_out to track work sessions.
- Create/delete reminders with set_reminder/delete_reminder tools.
- Speak responses aloud with speak_response tool.
- Get notifications with get_notifications tool.
- Review and approve draft messages for contacts (personal, company A, etc.)
- Use search_reddit to find information on Reddit.
- Use read_calendar and add_calendar_event to manage Google Calendar.
- Control computer with click_mouse, type_keyboard, and open_app.
- Control IoT devices with home_assistant_control.
- Query photographic/RAG memory with query_rag_memory.

Be concise. If a task requires heavy lifting (e.g., "build a web app" or "research a 20-page document"), delegate it!`;

        this.tools = [
            // ... existing tools ...
            {
                type: "function",
                function: {
                    name: "clock_in",
                    description: "Start a work session for time tracking and health monitoring.",
                    parameters: {
                        type: "object",
                        properties: {
                            type: { type: "string", description: "Type of session (e.g. 'work', 'deep_work', 'meeting')" }
                        }
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "clock_out",
                    description: "End the current work session.",
                    parameters: {
                        type: "object",
                        properties: {
                            notes: { type: "string", description: "Summary of what was accomplished." }
                        }
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "delegate_task",
                    description: "Delegate a complex, multi-step task to a specialized sub-agent (e.g., Coder, Researcher).",
                    parameters: {
                        type: "object",
                        properties: {
                            agent_role: { type: "string", description: "The role of the sub-agent (e.g., 'coder', 'researcher', 'copywriter')" },
                            task_description: { type: "string", description: "Detailed instructions for the sub-agent." }
                        },
                        required: ["agent_role", "task_description"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "search_reddit",
                    description: "Search Reddit for a specific query.",
                    parameters: {
                        type: "object",
                        properties: {
                            query: { type: "string", description: "The search query." }
                        },
                        required: ["query"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "read_calendar",
                    description: "Get upcoming events from the user's Google Calendar.",
                    parameters: {
                        type: "object",
                        properties: {
                            maxResults: { type: "integer", description: "Max number of events to fetch (default 10)." }
                        }
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "add_calendar_event",
                    description: "Add a new event to the user's Google Calendar.",
                    parameters: {
                        type: "object",
                        properties: {
                            summary: { type: "string", description: "Event title/summary." },
                            description: { type: "string", description: "Event description." },
                            startTime: { type: "string", description: "ISO start time." },
                            endTime: { type: "string", description: "ISO end time." }
                        },
                        required: ["summary", "startTime", "endTime"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "click_mouse",
                    description: "Click the mouse at optional coordinates.",
                    parameters: {
                        type: "object",
                        properties: {
                            x: { type: "integer" },
                            y: { type: "integer" }
                        }
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "type_keyboard",
                    description: "Type text using the keyboard.",
                    parameters: {
                        type: "object",
                        properties: {
                            text: { type: "string" },
                            enter: { type: "boolean", description: "Press enter after typing." }
                        },
                        required: ["text"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "open_app",
                    description: "Open an application by name.",
                    parameters: {
                        type: "object",
                        properties: {
                            appName: { type: "string" }
                        },
                        required: ["appName"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "home_assistant_control",
                    description: "Control smart home devices (IoT).",
                    parameters: {
                        type: "object",
                        properties: {
                            entity_id: { type: "string", description: "e.g. light.office" },
                            action: { type: "string", description: "turn_on, turn_off, etc." }
                        },
                        required: ["entity_id", "action"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "ssh_command",
                    description: "Execute a shell command on the user's remote Home Lab server via SSH.",
                    parameters: {
                        type: "object",
                        properties: {
                            command: { type: "string", description: "The shell command to run." }
                        },
                        required: ["command"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "query_rag_memory",
                    description: "Query the semantic/photographic memory for context.",
                    parameters: {
                        type: "object",
                        properties: {
                            query: { type: "string", description: "What to search for in past screenshots, emails, etc." }
                        },
                        required: ["query"]
                    }
                }
            },
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
            },
            {
                type: "function",
                function: {
                    name: "approve_draft",
                    description: "Approve a drafted message so it can be sent.",
                    parameters: {
                        type: "object",
                        properties: {
                            draftId: { type: "integer", description: "ID of the draft to approve" }
                        },
                        required: ["draftId"]
                    }
                }
            }
        ];
    }

    setProvider(provider) {
        if (['ollama', 'openai', 'groq', 'openrouter', 'nvidia', 'qwen'].includes(provider)) {
            this.provider = provider;
        }
    }

    getProvider() {
        return this.provider;
    }

    async checkConnection() {
        if (this.provider !== 'ollama') {
            const config = PROVIDER_CONFIG[this.provider];
            return config ? !!process.env[config.keyEnv] : false;
        }
        return await this.checkOllama();
    }

    async checkOllama() {
        try {
            await this.makeRequest('ollama', '/api/tags', {});
            return true;
        } catch (err) {
            return false;
        }
    }

    makeOpenAICompatibleRequest(data) {
        return new Promise((resolve, reject) => {
            const config = PROVIDER_CONFIG[this.provider];
            if (!config) return reject(new Error(`Unknown provider: ${this.provider}`));

            const postData = JSON.stringify(data);
            const apiKey = process.env[config.keyEnv];
            
            if (!apiKey) return reject(new Error(`Missing API key for provider ${this.provider} (Expected ${config.keyEnv})`));

            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'Content-Length': Buffer.byteLength(postData)
            };

            // OpenRouter specific headers
            if (this.provider === 'openrouter') {
                headers['HTTP-Referer'] = 'http://localhost:3000';
                headers['X-Title'] = 'Chief of Atreya';
            }

            const options = {
                hostname: config.hostname,
                port: 443,
                path: config.path,
                method: 'POST',
                headers: headers
            };

            const req = https.request(options, (res) => {
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

    getModelName() {
        switch(this.provider) {
            case 'openai': return process.env.OPENAI_MODEL || 'gpt-4o';
            case 'groq': return process.env.GROQ_MODEL || 'llama3-8b-8192';
            case 'openrouter': return process.env.OPENROUTER_MODEL || 'meta-llama/llama-3-8b-instruct:free';
            case 'nvidia': return process.env.NVIDIA_MODEL || 'meta/llama3-70b-instruct';
            case 'qwen': return process.env.QWEN_MODEL || 'qwen-plus';
            default: return process.env.OLLAMA_MODEL || 'llama3.2';
        }
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
Current Channel: ${context.channel || 'general'}
Active Tasks: ${JSON.stringify(context.tasks || [])}
Active Projects: ${JSON.stringify(context.projects || [])}
Pending Message Drafts: ${JSON.stringify(context.pendingDrafts || [])}`;

        this.conversationHistory.push({ role: 'user', content: text });
        if (this.conversationHistory.length > this.maxHistory) {
            this.conversationHistory = this.conversationHistory.slice(-this.maxHistory);
        }

        const model = this.getModelName();

        try {
            let response;
            if (this.provider !== 'ollama') {
                response = await this.makeOpenAICompatibleRequest({
                    model: model,
                    messages: [
                        { role: 'system', content: augmentedSystem },
                        ...this.conversationHistory
                    ],
                    tools: this.tools
                });
            } else {
                response = await this.makeRequest('ollama', '/api/chat', {
                    model: model,
                    messages: [
                        { role: 'system', content: augmentedSystem },
                        ...this.conversationHistory
                    ],
                    tools: this.tools,
                    stream: false
                });
            }
            
            const assistantMsg = (this.provider !== 'ollama' && response.choices) 
                ? response.choices[0].message 
                : response.message;

            if (assistantMsg) {
                this.conversationHistory.push(assistantMsg);
                return {
                    response: response,
                    text: assistantMsg.content || '',
                    tool_calls: assistantMsg.tool_calls || []
                };
            }
            throw new Error(`Invalid response from ${this.provider}. Response: ${JSON.stringify(response)}`);
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

        const model = this.getModelName();

        try {
            let response;
            if (this.provider !== 'ollama') {
                response = await this.makeOpenAICompatibleRequest({
                    model: model,
                    messages: [
                        { role: 'system', content: `${this.baseSystemPrompt}\n\nLong-term User Facts:\n${factsStr}` },
                        ...this.conversationHistory
                    ],
                    tools: this.tools
                });
            } else {
                response = await this.makeRequest('ollama', '/api/chat', {
                    model: model,
                    messages: [
                        { role: 'system', content: `${this.baseSystemPrompt}\n\nLong-term User Facts:\n${factsStr}` },
                        ...this.conversationHistory
                    ],
                    tools: this.tools,
                    stream: false
                });
            }

            const assistantMsg = (this.provider !== 'ollama' && response.choices) 
                ? response.choices[0].message 
                : response.message;

            if (assistantMsg) {
                this.conversationHistory.push(assistantMsg);
                return {
                    response: response,
                    text: assistantMsg.content || '',
                    tool_calls: assistantMsg.tool_calls || []
                };
            }
            throw new Error(`Invalid response from ${this.provider}. Response: ${JSON.stringify(response)}`);
        } catch (err) {
            console.error('Tool followup error:', err);
            throw err;
        }
    }

    async analyzeImage(base64Image) {
        if (this.provider === 'ollama') {
            console.log('[AI] Vision requested but using Ollama local model. Using stub vision.');
            return "Local vision not supported natively in this stub without llava.";
        }

        const model = this.getModelName();
        const visionPayload = {
            model: model,
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: "Please describe what you see in this screenshot and extract any important text." },
                        { type: "image_url", image_url: { url: `data:image/png;base64,${base64Image}` } }
                    ]
                }
            ],
            max_tokens: 500
        };

        try {
            const response = await this.makeOpenAICompatibleRequest(visionPayload);
            if (response.choices && response.choices.length > 0) {
                return response.choices[0].message.content;
            }
            throw new Error('No content returned from vision request.');
        } catch (err) {
            console.error('[AI] Vision Analysis Error:', err);
            return "Failed to analyze image.";
        }
    }

    clearHistory() {
        this.conversationHistory = [];
    }
}

const instance = new AIService();
instance.AIService = AIService;
module.exports = instance;

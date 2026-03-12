require('dotenv').config();
const { Anthropic } = require('@anthropic-ai/sdk');

class ClaudeService {
    constructor() {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey || apiKey === 'your_api_key_here') {
            console.warn('ANTHROPIC_API_KEY not set. Claude AI functions will be disabled.');
            this.client = null;
        } else {
            this.client = new Anthropic({ apiKey });
        }
        this.systemPrompt = "You are CHIEF, a local AI Chief of Staff. You monitor the user's browser tabs, notifications, and manage their reminders. You communicate concisely. Use the available tools when necessary.";
        this.conversationHistory = [];
        this.maxHistory = 20;

        // Tool definitions
        this.tools = [
            {
                name: "set_reminder",
                description: "Create a new reminder for the user.",
                input_schema: {
                    type: "object",
                    properties: {
                        text: { type: "string", description: "The content of the reminder" },
                        dueTime: { type: "string", description: "ISO string timestamp of when it is due" },
                        recurringRule: { type: "string", description: "Optional recur rule, e.g. 'daily'" }
                    },
                    required: ["text", "dueTime"]
                }
            },
            {
                name: "delete_reminder",
                description: "Delete a reminder by ID.",
                input_schema: {
                    type: "object",
                    properties: {
                        id: { type: "integer", description: "The ID of the reminder to delete" }
                    },
                    required: ["id"]
                }
            },
            {
                name: "speak_response",
                description: "Speak the response aloud using the Voice Engine.",
                input_schema: {
                    type: "object",
                    properties: {
                        text: { type: "string", description: "The text to speak aloud" }
                    },
                    required: ["text"]
                }
            }
        ];
    }

    async processCommand(text, context) {
        if (!this.client) {
            throw new Error('Claude API is not configured.');
        }

        // Build context into the system prompt
        const augmentedSystemPrompt = `${this.systemPrompt}
Current Time: ${new Date().toISOString()}
Active Tabs: ${JSON.stringify(context.tabs || [])}
Recent Notifications: ${JSON.stringify(context.notifications || [])}
Active Reminders: ${JSON.stringify(context.reminders || [])}
`;

        this.conversationHistory.push({ role: "user", content: text });
        if (this.conversationHistory.length > this.maxHistory) {
            this.conversationHistory = this.conversationHistory.slice(-this.maxHistory);
        }

        try {
            const response = await this.client.messages.create({
                model: "claude-3-7-sonnet-20250219", // Using 3-7 since 4 is not widely published, adjust to valid API model string
                max_tokens: 1024,
                system: augmentedSystemPrompt,
                messages: this.conversationHistory,
                tools: this.tools,
            });

            const assistMessage = { role: "assistant", content: response.content };
            this.conversationHistory.push(assistMessage);

            return {
                response: response,
                text: response.content.filter(c => c.type === 'text').map(c => c.text).join('\n'),
                tool_calls: response.content.filter(c => c.type === 'tool_use')
            };
        } catch (err) {
            console.error("Claude API Error:", err);
            throw err;
        }
    }
    
    // Call this function when tools from the previous step are executed, to pass results back to Claude
    async submitToolResults(toolResults) {
        if (!this.client) return null;
        
        this.conversationHistory.push({ role: "user", content: toolResults });
        
        try {
            const response = await this.client.messages.create({
                model: "claude-3-7-sonnet-20250219",
                max_tokens: 1024,
                system: this.systemPrompt,
                messages: this.conversationHistory,
                tools: this.tools,
            });

            this.conversationHistory.push({ role: "assistant", content: response.content });
            
            return {
                response: response,
                text: response.content.filter(c => c.type === 'text').map(c => c.text).join('\n'),
                tool_calls: response.content.filter(c => c.type === 'tool_use')
            };
        } catch (err) {
             console.error("Claude Tool Followup Error:", err);
             throw err;
        }
    }
}

module.exports = new ClaudeService();

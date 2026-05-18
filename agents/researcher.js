const { AIService } = require('../modules/ai');
const reddit = require('../modules/reddit');

class ResearcherAgent extends AIService {
    constructor() {
        super();
        this.baseSystemPrompt = `You are a specialized Researcher Sub-Agent. 
Your goal is to gather information, synthesize facts, and provide comprehensive summaries to the supervisor.
You have access to search tools. Keep your research factual, well-organized, and cited if possible.`;
        
        // Give researcher specific tools
        this.tools = [
            {
                type: "function",
                function: {
                    name: "search_reddit",
                    description: "Search Reddit for a specific query to gather user opinions or technical solutions.",
                    parameters: {
                        type: "object",
                        properties: {
                            query: { type: "string", description: "The search query." }
                        },
                        required: ["query"]
                    }
                }
            }
        ];
    }

    async runTask(taskDescription, context) {
        console.log(`[Researcher Agent] Received task: ${taskDescription}`);
        let response = await this.processCommand(taskDescription, context);
        
        // Simple loop to handle tool calls for the sub-agent
        if (response.tool_calls && response.tool_calls.length > 0) {
            const toolResults = [];
            for (const toolCall of response.tool_calls) {
                const name = toolCall.function?.name || toolCall.name;
                const args = toolCall.function?.arguments || toolCall.input || {};
                let resultText = "";
                
                if (name === 'search_reddit') {
                    const redditRes = await reddit.searchReddit(args.query, 5);
                    resultText = redditRes.success ? JSON.stringify(redditRes.data) : `Failed: ${redditRes.error}`;
                } else {
                    resultText = "Unknown tool.";
                }

                toolResults.push({
                    type: "tool_result",
                    tool_use_id: toolCall.id || 'unknown',
                    content: resultText
                });
            }
            response = await this.submitToolResults(toolResults, {});
        }
        
        return response.text;
    }
}

module.exports = new ResearcherAgent();

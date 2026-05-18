const { AIService } = require('../modules/ai');

class CoderAgent extends AIService {
    constructor() {
        super();
        this.baseSystemPrompt = `You are a specialized Coder Sub-Agent. 
Your only purpose is to write, debug, and analyze code based on the user's or supervisor's requests.
Be concise. Output code blocks. Do not perform generic tasks, stick strictly to software engineering.`;
        // Remove tools not relevant to a pure coder or add coder-specific tools if any
        this.tools = [];
    }

    async runTask(taskDescription, context) {
        console.log(`[Coder Agent] Received task: ${taskDescription}`);
        const response = await this.processCommand(taskDescription, context);
        return response.text;
    }
}

module.exports = new CoderAgent();

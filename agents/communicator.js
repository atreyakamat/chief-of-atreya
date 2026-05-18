const { AIService } = require('../modules/ai');

class CommunicatorAgent extends AIService {
    constructor() {
        super();
        this.baseSystemPrompt = `You are a specialized Communicator Sub-Agent. 
Your task is to draft professional, empathetic, and clear messages (emails, slack, whatsapp) based on brief instructions.
Adapt the tone to the context provided.`;
        this.tools = [];
    }

    async runTask(taskDescription, context) {
        console.log(`[Communicator Agent] Received task: ${taskDescription}`);
        const response = await this.processCommand(taskDescription, context);
        return response.text;
    }
}

module.exports = new CommunicatorAgent();

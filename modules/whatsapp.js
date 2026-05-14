const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const db = require('../db');
const contacts = require('./contacts');
const ai = require('./ai');

let client = null;
let isReady = false;

function initialize() {
    if (!process.env.ENABLE_WHATSAPP) {
        console.log('[WhatsApp] Integration disabled (set ENABLE_WHATSAPP=true to enable)');
        return;
    }

    console.log('[WhatsApp] Initializing lightweight client...');
    client = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process', 
                '--disable-gpu'
            ]
        }
    });

    client.on('qr', (qr) => {
        console.log('[WhatsApp] Scan this QR code to link Zen to your WhatsApp:');
        qrcode.generate(qr, { small: true });
    });

    client.on('ready', () => {
        console.log('[WhatsApp] Client is ready!');
        isReady = true;
    });

    client.on('message', async msg => {
        if (!isReady) return;
        
        console.log(`[WhatsApp] New message from ${msg.from}: ${msg.body}`);
        
        // 1. Check if contact exists, otherwise add to unknown
        let contact = db.prepare('SELECT * FROM contacts WHERE name = ?').get(msg.from);
        let contactId;
        if (!contact) {
            const result = contacts.addContact(msg.from, 'personal', 'Unknown WhatsApp Contact');
            contactId = result.id;
            contact = { id: contactId, name: msg.from, category: 'personal', relationship_context: 'Unknown WhatsApp Contact' };
        } else {
            contactId = contact.id;
        }

        // 2. Save to chats db
        // (Assuming account_id 1 is whatsapp for now)
        db.prepare('INSERT INTO chats (account_id, sender, message) VALUES (?, ?, ?)')
          .run(1, msg.from, msg.body);

        // 3. Draft a reply using AI
        const prompt = `You are Zen, my personal assistant. I received a WhatsApp message from ${contact.name}. 
Context about this person: ${contact.relationship_context}
Category: ${contact.category}

Message: "${msg.body}"

Please draft a brief, context-appropriate reply for me. Only return the drafted reply text, nothing else.`;

        try {
            // Using a raw call to the configured provider to get just the text
            const draftResponse = await ai.makeOpenAICompatibleRequest({
                model: ai.getModelName(),
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 150
            });
            
            let draftText = "Draft failed.";
            if (draftResponse.choices && draftResponse.choices.length > 0) {
                draftText = draftResponse.choices[0].message.content.trim();
            } else if (ai.getProvider() === 'ollama') {
                // Fallback for local ollama
                const oResponse = await ai.makeRequest('ollama', '/api/generate', {
                    model: ai.getModelName(),
                    prompt: prompt,
                    stream: false
                });
                draftText = oResponse.response.trim();
            }

            contacts.createDraft('whatsapp', contactId, msg.body, draftText);
            console.log(`[WhatsApp] Draft created for ${msg.from}`);
        } catch (e) {
            console.error('[WhatsApp] Failed to draft reply:', e);
        }
    });

    client.initialize();
}

function syncWhatsAppMessages() {
    // Handled by event listener now
    return { success: true, ready: isReady };
}

function processMessagesForDrafts() {
    // Handled immediately upon receiving message
    return { success: true };
}

module.exports = {
    initialize,
    syncWhatsAppMessages,
    processMessagesForDrafts
};

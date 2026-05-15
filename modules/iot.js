const axios = require('axios'); // We can use fetch or http, but let's use built-in https or http if possible, or assume axios/fetch is available. We'll use global fetch (Node 18+).

let initialized = false;
let haUrl = '';
let haToken = '';

function initialize() {
    haUrl = process.env.HA_URL;
    haToken = process.env.HA_TOKEN;

    if (haUrl && haToken) {
        initialized = true;
        console.log('[IoT] Home Assistant integration initialized.');
    } else {
        console.log('[IoT] Integration disabled (Missing HA_URL or HA_TOKEN).');
    }
}

async function controlDevice(entityId, action) {
    if (!initialized) return { success: false, error: 'Home Assistant not initialized' };

    const domain = entityId.split('.')[0]; // e.g., "light" or "switch"
    const endpoint = `${haUrl}/api/services/${domain}/${action}`;

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${haToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ entity_id: entityId })
        });
        
        if (response.ok) {
            return { success: true, message: `Successfully executed ${action} on ${entityId}` };
        } else {
            return { success: false, error: `Failed with status ${response.status}` };
        }
    } catch (e) {
        console.error('[IoT] Error controlling device:', e.message);
        return { success: false, error: e.message };
    }
}

module.exports = {
    initialize,
    controlDevice
};
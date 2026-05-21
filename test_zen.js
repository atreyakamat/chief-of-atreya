const http = require('http');

const options = (path, method = 'POST') => ({
    hostname: 'localhost',
    port: 3000,
    path: `/api/${path}`,
    method: method,
    headers: { 'Content-Type': 'application/json' }
});

const makeRequest = (path, data) => new Promise((resolve, reject) => {
    const req = http.request(options(path), (res) => {
        let body = '';
        res.on('data', (c) => body += c);
        res.on('end', () => resolve(JSON.parse(body)));
    });
    req.on('error', reject);
    req.write(JSON.stringify(data));
    req.end();
});

async function runTests() {
    console.log('🚀 ZEN OS - Autonomous Orchestration Stress Test');
    console.log('==============================================');

    const tests = [
        { 
            name: "App Launch & Interaction",
            prompt: "Open Notepad and type 'ZEN OS is alive and orchestrating.' then save it as zen_test.txt on my desktop."
        },
        {
            name: "Neural Context Scan",
            prompt: "Scan my current screen and tell me what the most prominent window is."
        },
        {
            name: "Complex Planning & Briefing",
            prompt: "Give me a Jarvis-style morning briefing and tell me which project needs my attention most right now."
        }
    ];

    for (const test of tests) {
        console.log(`\n[Test: ${test.name}]`);
        console.log(`Prompt: "${test.prompt}"`);
        
        try {
            const res = await makeRequest('chat', { text: test.prompt });
            console.log(`ZEN: "${res.text}"`);
        } catch (e) {
            console.error(`❌ Test failed: ${e.message}`);
        }
        
        console.log('Waiting 5s for orchestration to settle...');
        await new Promise(r => setTimeout(r, 5000));
    }

    console.log('\n==============================================');
    console.log('✅ Stress test sequence completed.');
}

runTests();

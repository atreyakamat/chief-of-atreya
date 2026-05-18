const { NodeSSH } = require('node-ssh');

const ssh = new NodeSSH();

async function executeCommand(command) {
    const host = process.env.HOMELAB_HOST;
    const username = process.env.HOMELAB_USER;
    const privateKeyPath = process.env.HOMELAB_KEY_PATH;

    if (!host || !username || !privateKeyPath) {
        return { success: false, error: 'Home Lab SSH credentials missing in .env' };
    }

    try {
        console.log(`[HomeLab] Connecting to ${username}@${host}...`);
        await ssh.connect({
            host: host,
            username: username,
            privateKeyPath: privateKeyPath
        });
        
        console.log(`[HomeLab] Executing: ${command}`);
        const result = await ssh.execCommand(command, { cwd: '/' });
        
        ssh.dispose();
        
        return { 
            success: true, 
            stdout: result.stdout, 
            stderr: result.stderr 
        };
    } catch (e) {
        console.error('[HomeLab] SSH Error:', e.message);
        return { success: false, error: e.message };
    }
}

module.exports = {
    executeCommand
};
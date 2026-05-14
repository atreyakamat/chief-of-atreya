const db = require('../db');
const { Octokit } = require('@octokit/rest');

let octokit = null;

function initialize() {
    if (process.env.GITHUB_TOKEN) {
        octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
        console.log('[GitHub] Initialized with token.');
    } else {
        console.log('[GitHub] Integration disabled (set GITHUB_TOKEN to enable).');
    }
}

function getProjects() {
    return db.prepare('SELECT * FROM projects').all();
}

function addProject(name, repoUrl, prdSummary) {
    const stmt = db.prepare('INSERT INTO projects (name, repo_url, prd_summary) VALUES (?, ?, ?)');
    const info = stmt.run(name, repoUrl, prdSummary);
    return { success: true, id: info.lastInsertRowid };
}

async function syncRepo(projectId) {
    if (!octokit) return { success: false, error: 'GitHub not authenticated' };

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (!project || !project.repo_url) return { success: false, error: 'Invalid project or missing repo URL' };

    try {
        // Parse repo url (e.g., https://github.com/owner/repo)
        const parts = project.repo_url.replace('https://github.com/', '').split('/');
        const owner = parts[0];
        const repo = parts[1];

        if (!owner || !repo) return { success: false, error: 'Malformed repo URL' };

        // Fetch README
        const readmeData = await octokit.rest.repos.getReadme({ owner, repo });
        const readmeContent = Buffer.from(readmeData.data.content, 'base64').toString('utf8');

        // Fetch Issues
        const issuesData = await octokit.rest.issues.listForRepo({ owner, repo, state: 'open', per_page: 5 });
        const issues = issuesData.data.map(i => `${i.title} (#${i.number})`).join(', ');

        // Update DB with summary
        const summary = `README Preview: ${readmeContent.substring(0, 200)}...\n\nOpen Issues: ${issues}`;
        db.prepare('UPDATE projects SET prd_summary = ? WHERE id = ?').run(summary, projectId);

        console.log(`[GitHub] Synced repo for project ${projectId}`);
        return { success: true, message: `Synced repo for project ${projectId}` };
    } catch (e) {
        console.error('[GitHub] Sync Error:', e);
        return { success: false, error: e.message };
    }
}

module.exports = {
    initialize,
    getProjects,
    addProject,
    syncRepo
};

const db = require('../db');

function getProjects() {
    return db.prepare('SELECT * FROM projects').all();
}

function addProject(name, repoUrl, prdSummary) {
    const stmt = db.prepare('INSERT INTO projects (name, repo_url, prd_summary) VALUES (?, ?, ?)');
    const info = stmt.run(name, repoUrl, prdSummary);
    return { success: true, id: info.lastInsertRowid };
}

function syncRepo(projectId) {
    // Scaffold: Fetch PRD, README, issues from GitHub using @octokit/rest
    // Update prd_summary based on AI summarization
    return { success: true, message: `Synced repo for project ${projectId}` };
}

module.exports = {
    getProjects,
    addProject,
    syncRepo
};

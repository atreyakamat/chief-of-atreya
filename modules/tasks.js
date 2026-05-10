const db = require('../db');

function getTasks(projectId = null) {
    if (projectId) {
        return db.prepare('SELECT * FROM tasks WHERE project_id = ?').all(projectId);
    }
    return db.prepare('SELECT * FROM tasks').all();
}

function addTask(projectId, title, description, dueTime) {
    const stmt = db.prepare('INSERT INTO tasks (project_id, title, description, due_time) VALUES (?, ?, ?, ?)');
    const info = stmt.run(projectId, title, description, dueTime);
    return { success: true, id: info.lastInsertRowid };
}

function updateTaskStatus(taskId, status) {
    const stmt = db.prepare('UPDATE tasks SET status = ? WHERE id = ?');
    stmt.run(status, taskId);
    return { success: true };
}

module.exports = {
    getTasks,
    addTask,
    updateTaskStatus
};

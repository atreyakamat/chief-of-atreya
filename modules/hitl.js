const db = require('../db');

function createPendingAction(actionType, payloadObj) {
    const stmt = db.prepare('INSERT INTO pending_actions (action_type, payload, status) VALUES (?, ?, ?)');
    const info = stmt.run(actionType, JSON.stringify(payloadObj || {}), 'pending');
    // Audit log
    try {
        db.prepare('INSERT INTO audit_logs (event_type, details) VALUES (?, ?)').run('pending_created', JSON.stringify({ id: info.lastInsertRowid, actionType, payload: payloadObj || {} }));
    } catch (e) {}
    return { id: info.lastInsertRowid, status: 'pending' };
}

function getPendingAction(id) {
    const stmt = db.prepare('SELECT * FROM pending_actions WHERE id = ?');
    const row = stmt.get(id);
    if (!row) return null;
    return { ...row, payload: JSON.parse(row.payload || '{}') };
}

function approveAction(id) {
    db.prepare('UPDATE pending_actions SET status = ? WHERE id = ?').run('approved', id);
    try { db.prepare('INSERT INTO audit_logs (event_type, details) VALUES (?, ?)').run('pending_approved', JSON.stringify({ id })); } catch (e) {}
}

function rejectAction(id) {
    db.prepare('UPDATE pending_actions SET status = ? WHERE id = ?').run('rejected', id);
    try { db.prepare('INSERT INTO audit_logs (event_type, details) VALUES (?, ?)').run('pending_rejected', JSON.stringify({ id })); } catch (e) {}
}

module.exports = {
    createPendingAction,
    getPendingAction,
    approveAction,
    rejectAction
};

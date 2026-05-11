const db = require('../db');

function getContacts(category = null) {
    if (category) {
        return db.prepare('SELECT * FROM contacts WHERE category = ?').all(category);
    }
    return db.prepare('SELECT * FROM contacts').all();
}

function addContact(name, category, relationshipContext) {
    const stmt = db.prepare('INSERT INTO contacts (name, category, relationship_context) VALUES (?, ?, ?)');
    const info = stmt.run(name, category, relationshipContext);
    return { success: true, id: info.lastInsertRowid };
}

function getDrafts(status = 'pending_review') {
    return db.prepare('SELECT * FROM message_drafts WHERE status = ?').all(status);
}

function createDraft(platform, contactId, originalMessage, draftReply) {
    const stmt = db.prepare('INSERT INTO message_drafts (platform, contact_id, original_message, draft_reply) VALUES (?, ?, ?, ?)');
    const info = stmt.run(platform, contactId, originalMessage, draftReply);
    return { success: true, id: info.lastInsertRowid };
}

function updateDraftStatus(draftId, status) {
    const stmt = db.prepare('UPDATE message_drafts SET status = ? WHERE id = ?');
    stmt.run(status, draftId);
    return { success: true };
}

module.exports = {
    getContacts,
    addContact,
    getDrafts,
    createDraft,
    updateDraftStatus
};

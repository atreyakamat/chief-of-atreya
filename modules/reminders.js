const db = require('../db');

class RemindersService {
    createReminder(text, dueTime, recurringRule = null) {
        if (!text || !dueTime) {
            return { success: false, error: 'Reminder text and due time are required' };
        }
        
        // Basic date validation
        const date = new Date(dueTime);
        if (isNaN(date.getTime())) {
            return { success: false, error: 'Invalid due time format' };
        }

        try {
            const stmt = db.prepare('INSERT INTO reminders (text, due_time, recurring_rule, status) VALUES (?, ?, ?, ?)');
            const info = stmt.run(text, dueTime, recurringRule, 'pending');
            return { success: true, id: info.lastInsertRowid };
        } catch (err) {
            console.error('Error creating reminder:', err);
            return { success: false, error: err.message };
        }
    }

    getActiveReminders() {
        try {
            const stmt = db.prepare("SELECT * FROM reminders WHERE status = 'pending' ORDER BY due_time ASC");
            return stmt.all();
        } catch (err) {
            console.error('Error getting reminders:', err);
            return [];
        }
    }

    updateReminderStatus(id, status) {
        try {
            const stmt = db.prepare('UPDATE reminders SET status = ? WHERE id = ?');
            const info = stmt.run(status, id);
            return { success: info.changes > 0 };
        } catch (err) {
            console.error('Error updating reminder:', err);
            return { success: false, error: err.message };
        }
    }

    deleteReminder(id) {
        try {
            const stmt = db.prepare('DELETE FROM reminders WHERE id = ?');
            const info = stmt.run(id);
            return { success: info.changes > 0 };
        } catch (err) {
            console.error('Error deleting reminder:', err);
            return { success: false, error: err.message };
        }
    }

    updateReminderTime(id, newDueTime) {
        try {
            const stmt = db.prepare('UPDATE reminders SET due_time = ? WHERE id = ?');
            const info = stmt.run(newDueTime, id);
            return { success: info.changes > 0 };
        } catch (err) {
            console.error('Error updating reminder time:', err);
            return { success: false, error: err.message };
        }
    }
}

module.exports = new RemindersService();

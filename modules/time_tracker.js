const db = require('../db');

function clockIn(sessionType = 'work') {
    // Check if already clocked in
    const active = db.prepare("SELECT * FROM time_logs WHERE end_time IS NULL ORDER BY start_time DESC LIMIT 1").get();
    if (active) {
        return { success: false, error: `Already clocked in for ${active.session_type} since ${active.start_time}` };
    }

    const info = db.prepare("INSERT INTO time_logs (session_type) VALUES (?)").run(sessionType);
    return { success: true, id: info.lastInsertRowid, type: sessionType, time: new Date().toISOString() };
}

function clockOut(notes = '') {
    const active = db.prepare("SELECT * FROM time_logs WHERE end_time IS NULL ORDER BY start_time DESC LIMIT 1").get();
    if (!active) {
        return { success: false, error: "Not currently clocked in." };
    }

    db.prepare("UPDATE time_logs SET end_time = CURRENT_TIMESTAMP, notes = ? WHERE id = ?").run(notes, active.id);
    
    // Calculate duration
    const start = new Date(active.start_time);
    const end = new Date();
    const durationMins = Math.round((end - start) / 60000);

    return { success: true, durationMinutes: durationMins, type: active.session_type };
}

function isClockedIn() {
    const active = db.prepare("SELECT * FROM time_logs WHERE end_time IS NULL ORDER BY start_time DESC LIMIT 1").get();
    return !!active;
}

function getTodayStats() {
    const logs = db.prepare("SELECT * FROM time_logs WHERE date(start_time) = date('now')").all();
    let totalMins = 0;
    logs.forEach(log => {
        const start = new Date(log.start_time);
        const end = log.end_time ? new Date(log.end_time) : new Date();
        totalMins += Math.round((end - start) / 60000);
    });
    return { success: true, totalMinutesToday: totalMins, sessions: logs.length };
}

module.exports = {
    clockIn,
    clockOut,
    isClockedIn,
    getTodayStats
};
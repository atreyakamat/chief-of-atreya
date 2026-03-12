-- Reminders Table
CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    due_time DATETIME NOT NULL,
    recurring_rule TEXT, -- e.g. "daily", "weekly" or NULL
    status TEXT DEFAULT 'pending' -- 'pending', 'completed', 'dismissed'
);

-- Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_source TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    priority TEXT DEFAULT 'normal' -- 'normal', 'urgent', 'low'
);

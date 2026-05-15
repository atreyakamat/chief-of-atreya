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

-- Projects Table (GitHub Integration / Project Management)
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    repo_url TEXT,
    prd_summary TEXT,
    status TEXT DEFAULT 'active'
);

-- Tasks Table (Motion-like task tracking)
CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    title TEXT NOT NULL,
    description TEXT,
    due_time DATETIME,
    status TEXT DEFAULT 'todo', -- 'todo', 'in_progress', 'done'
    FOREIGN KEY(project_id) REFERENCES projects(id)
);

-- Work Accounts Table (Tracking multiple work profiles)
CREATE TABLE IF NOT EXISTS work_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT NOT NULL, -- e.g., 'github', 'slack', 'gmail'
    account_name TEXT NOT NULL,
    credentials_encrypted TEXT,
    status TEXT DEFAULT 'active'
);

-- Chats Table (Sourced chats from Slack, Teams, etc.)
CREATE TABLE IF NOT EXISTS chats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER,
    sender TEXT,
    message TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(account_id) REFERENCES work_accounts(id)
);

-- Emails Table (Background email processing)
CREATE TABLE IF NOT EXISTS emails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER,
    sender TEXT,
    subject TEXT,
    body TEXT,
    parsed_reminder_id INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(account_id) REFERENCES work_accounts(id),
    FOREIGN KEY(parsed_reminder_id) REFERENCES reminders(id)
);

-- Snapshots Table (Vision/Screenshots memory)
CREATE TABLE IF NOT EXISTS snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    image_path TEXT NOT NULL,
    extracted_text TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Contacts Table (Categorization: Personal, Company A, Company B)
CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'personal', -- 'personal', 'work_company_a', 'work_company_b', etc.
    relationship_context TEXT -- Context for the AI when drafting replies
);

-- Message Drafts Table (AI generated drafts for emails, whatsapp, etc.)
CREATE TABLE IF NOT EXISTS message_drafts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT NOT NULL, -- 'whatsapp', 'email', 'slack'
    contact_id INTEGER,
    original_message TEXT,
    draft_reply TEXT,
    status TEXT DEFAULT 'pending_review', -- 'pending_review', 'approved', 'sent'
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(contact_id) REFERENCES contacts(id)
);

-- RAG Semantic Memory Table
CREATE TABLE IF NOT EXISTS rag_memory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL, -- e.g. 'snapshot:123', 'email:45'
    content TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

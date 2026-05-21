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

-- Time Tracking & Life Management
CREATE TABLE IF NOT EXISTS time_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_type TEXT DEFAULT 'work', -- 'work', 'deep_work', 'meeting'
    start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    end_time DATETIME,
    notes TEXT
);

-- Neural Link Manager Table
CREATE TABLE IF NOT EXISTS links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    title TEXT,
    summary TEXT,
    workspace_id INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(workspace_id) REFERENCES projects(id)
);

-- Spark+ Business Servicing (Leads & Partnerships)
CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'College', 'Employer', 'Startup/Partner'
    status TEXT DEFAULT 'New', -- 'New', 'Demo Scheduled', 'Onboarded', 'Inactive'
    contact_info TEXT,
    notes TEXT,
    success_criteria_met INTEGER DEFAULT 0, -- 1 if onboarded/project added
    last_interaction DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS skill_pathways (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER,
    name TEXT NOT NULL,
    requirements TEXT,
    validation_status TEXT DEFAULT 'Pending',
    FOREIGN KEY(lead_id) REFERENCES leads(id)
);

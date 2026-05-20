/* ═══════════════════════════════════════════════════════
   CHIEF — Frontend Logic (Dashboard Redesign)
   ═══════════════════════════════════════════════════════ */

const API = '';
const startTime = Date.now();
let currentProvider = 'ollama';

// State
let currentProjectId = null;
let currentProjectName = null;
let allProjects = [];

// Icons for dynamic rendering
const projectIcons = {
    'Action Items': '📥',
    'StixnVibes': '🎵',
    'Solvix Studios': '🎥',
    'Spark+ Tutoring': '📚',
    'Rotract Club of Mapuca': '🤝',
    'Pixel N Purpose': '🎨',
    'Anjali\'s Table': '🍽️',
    'College Work & Projects': '🎓'
};

// View Management
function switchView(viewId, element, projectName = null, projectId = null) {
    // Update Sidebar Active State
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    if (element) element.classList.add('active');

    // Hide all views
    document.querySelectorAll('.view-panel').forEach(el => el.classList.remove('active'));
    
    // Show target view
    document.getElementById(`view-${viewId}`).classList.add('active');

    // Update Title
    const titleEl = document.getElementById('currentViewTitle');
    if (viewId === 'overview') titleEl.textContent = 'Overview';
    if (viewId === 'system') titleEl.textContent = 'System Status';
    if (viewId === 'profiles') titleEl.textContent = 'Profiles Management';
    if (viewId === 'integrations') titleEl.textContent = 'Social Integrations';

    if (viewId === 'project' && projectName) {
        currentProjectId = projectId;
        currentProjectName = projectName;
        titleEl.textContent = projectName;
        document.querySelector('.project-subtitle').textContent = `Workspace / ${projectName}`;
        renderProjectData();
    } else {
        currentProjectId = null;
        currentProjectName = null;
    }
}

// Projects Management
async function loadProjects() {
    try {
        const res = await fetch(`${API}/api/projects`);
        allProjects = await res.json();
        
        // Ensure "Action Items" exists
        if (!allProjects.find(p => p.name === 'Action Items')) {
            await fetch(`${API}/api/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'Action Items' })
            });
            return loadProjects();
        }

        renderSidebar();
        renderAllProjectsOverview();
    } catch (e) {
        console.error('Failed to load projects:', e);
    }
}

function renderSidebar() {
    const inboxNav = document.getElementById('inboxNav');
    const workspacesNav = document.getElementById('workspacesNav');
    
    if (!inboxNav || !workspacesNav) return;

    const actionProject = allProjects.find(p => p.name === 'Action Items');
    inboxNav.innerHTML = `
        <a href="#" class="nav-item ${currentProjectId === actionProject?.id ? 'active' : ''}" onclick="switchView('project', this, 'Action Items', ${actionProject?.id})">
            <span class="nav-icon">📥</span> Action Items
        </a>
    `;

    workspacesNav.innerHTML = allProjects
        .filter(p => p.name !== 'Action Items')
        .map(p => `
            <a href="#" class="nav-item ${currentProjectId === p.id ? 'active' : ''}" onclick="switchView('project', this, '${escapeJs(p.name)}', ${p.id})">
                <span class="nav-icon">${projectIcons[p.name] || '📁'}</span> ${escapeHtml(p.name)}
            </a>
        `).join('');
}

async function createNewWorkspace() {
    const name = prompt('Enter workspace name:');
    if (!name) return;

    try {
        await fetch(`${API}/api/projects`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        loadProjects();
    } catch (e) {
        alert('Failed to create workspace');
    }
}

function handleTaskKeyPress(e) {
    if (e.key === 'Enter') addProjectTask();
}

async function addProjectTask() {
    if (!currentProjectId) return;
    const input = document.getElementById('newTaskInput');
    const text = input.value.trim();
    if (!text) return;

    try {
        await fetch(`${API}/api/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                projectId: currentProjectId,
                title: text
            })
        });
        input.value = '';
        renderProjectData();
        renderAllProjectsOverview();
    } catch (e) {
        alert('Failed to add task');
    }
}

async function toggleTask(taskId, currentStatus) {
    const newStatus = currentStatus === 'done' ? 'todo' : 'done';
    try {
        await fetch(`${API}/api/tasks/${taskId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        renderProjectData();
        renderAllProjectsOverview();
    } catch (e) {}
}

async function deleteProjectTask(taskId) {
    try {
        await fetch(`${API}/api/tasks/${taskId}`, { method: 'DELETE' });
        renderProjectData();
        renderAllProjectsOverview();
    } catch (e) {}
}

async function renderProjectData() {
    if (!currentProjectId) return;
    
    try {
        const res = await fetch(`${API}/api/tasks?projectId=${currentProjectId}`);
        const tasks = await res.json();
        
        // Render Tasks
        const taskList = document.getElementById('projectTaskList');
        taskList.innerHTML = tasks.length === 0 
            ? '<div class="text-muted" style="font-size:0.85rem">No tasks for this project yet.</div>'
            : tasks.map(t => `
            <div class="task-item ${t.status === 'done' ? 'completed' : ''}">
                <div class="task-content">
                    <input type="checkbox" class="task-checkbox" ${t.status === 'done' ? 'checked' : ''} onchange="toggleTask(${t.id}, '${t.status}')">
                    <div class="task-text">${escapeHtml(t.title)}</div>
                </div>
                <button class="delete-btn" onclick="deleteProjectTask(${t.id})">✕</button>
            </div>
        `).join('');

        // Notes (Placeholder for now as DB schema notes/notes aren't fully linked yet)
        const notesList = document.getElementById('projectNotesList');
        notesList.innerHTML = '<div class="text-muted" style="font-size:0.85rem">No AI records yet.</div>';
    } catch (e) {}
}

async function renderAllProjectsOverview() {
    const container = document.getElementById('allProjectsTasksOverview');
    if (!container) return;

    try {
        const res = await fetch(`${API}/api/tasks`);
        const allTasks = await res.json();
        
        let html = '<div style="display:flex; flex-direction:column; gap:1rem;">';
        
        for (const project of allProjects) {
            const projectTasks = allTasks.filter(t => t.project_id === project.id && t.status !== 'done');
            if (projectTasks.length > 0) {
                html += `
                    <div>
                        <h4 style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:0.5rem; text-transform:uppercase;">${escapeHtml(project.name)}</h4>
                        <div style="display:flex; flex-direction:column; gap:0.4rem;">
                            ${projectTasks.slice(0, 3).map(t => `
                                <div style="display:flex; align-items:center; gap:0.5rem; font-size:0.85rem; background:var(--bg-tertiary); padding:0.5rem; border-radius:4px; border:1px solid var(--border-default);">
                                    <span style="color:var(--accent-purple)">○</span>
                                    ${escapeHtml(t.title)}
                                </div>
                            `).join('')}
                            ${projectTasks.length > 3 ? `<div style="font-size:0.75rem; color:var(--text-muted)">+ ${projectTasks.length - 3} more tasks</div>` : ''}
                        </div>
                    </div>
                `;
            }
        }

        if (html === '<div style="display:flex; flex-direction:column; gap:1rem;">') {
            html = '<div class="text-muted" style="font-size:0.85rem; text-align:center; padding: 2rem;">No pending project tasks!</div>';
        } else {
            html += '</div>';
        }

        container.innerHTML = html;
    } catch (e) {}
}

// Action Buttons
function createNewTask() {
    if (currentProjectId) {
        document.getElementById('newTaskInput').focus();
    } else {
        alert('Please select a workspace from the sidebar first.');
    }
}

function askChiefForSummary() {
    const text = currentProjectName 
        ? `Hey CHIEF, give me a quick summary of my status on ${currentProjectName}.` 
        : `Hey CHIEF, summarize all my pending work across all projects.`;
    
    document.getElementById('chatInput').value = text;
    document.getElementById('chatForm').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
}

// Global UI Logic
function toggleSettings() {
    const modal = document.getElementById('settingsModal');
    modal.classList.toggle('hidden');
    
    // Update ingest URL based on current host
    const urlEl = document.getElementById('ingestUrl');
    if (urlEl) {
        urlEl.textContent = `${window.location.origin}/api/ingest`;
    }
}

function saveSettings() {
    toggleSettings();
    alert('Settings saved locally.');
}

// ─── CHAT & API LOGIC ───

function handleChatEnter(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        document.getElementById('chatForm').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    }
}

document.getElementById('chatForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text) return;
    
    addMessage('user', text);
    input.value = '';
    
    const thinking = document.getElementById('thinking');
    thinking.classList.remove('hidden');
    
    try {
        const res = await fetch(`${API}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        const data = await res.json();
        
        thinking.classList.add('hidden');
        
        if (data.success) {
            addMessage('assistant', data.text);
            pollAllData();

            // Very simple hardcoded AI interception to auto-add tasks based on prompt words
            const lowerText = text.toLowerCase();
            const isTaskCommand = lowerText.includes('add task') || lowerText.includes('todo') || lowerText.startsWith('action:') || lowerText.startsWith('task:');
            
            if (isTaskCommand) {
                const parts = text.split(/(?:add task|todo|action:|task:)/i);
                const taskText = (parts[1] || text).replace(/^s|:|to|for/g, '').trim();
                
                if (taskText.length > 2) {
                    const targetProjectId = currentProjectId || allProjects.find(p => p.name === 'Action Items')?.id;
                    
                    if (targetProjectId) {
                        await fetch(`${API}/api/tasks`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                projectId: targetProjectId,
                                title: taskText
                            })
                        });
                        
                        renderProjectData();
                        renderAllProjectsOverview();
                        addMessage('assistant', `(System: Auto-added task to ${currentProjectId ? currentProjectName : 'Action Items'}: "${taskText}")`);
                    }
                }
            }

        } else {
            addMessage('error', data.error);
        }
    } catch (e) {
        thinking.classList.add('hidden');
        addMessage('error', 'Failed to connect to CHIEF.');
    }
});

function addMessage(role, content) {
    const chatMessages = document.getElementById('chatMessages');
    const div = document.createElement('div');
    div.className = `chat-message ${role}`;
    div.innerHTML = `
        ${escapeHtml(content).replace(/\\n/g, '<br>')}
        <div class="msg-time">${new Date().toLocaleTimeString()}</div>
    `;
    chatMessages.appendChild(div);
    chatMessages.parentElement.scrollTop = chatMessages.parentElement.scrollHeight;
}

function clearChat() {
    document.getElementById('chatMessages').innerHTML = '';
}

function stopSpeaking() {
    fetch(`${API}/api/voice/speak`, { method: 'DELETE' });
}

function startVoice() {
    const voiceBtn = document.getElementById('voiceBtn');
    if (voiceBtn) voiceBtn.classList.add('listening');
    fetch(`${API}/api/voice/record`, { method: 'POST' });
    setTimeout(() => {
        if (voiceBtn) voiceBtn.classList.remove('listening');
    }, 3000);
}

// ─── POLLING & DATA FETCHING ───

async function fetchReminders() {
    try {
        const res = await fetch(`${API}/api/reminders`);
        const data = await res.json();
        
        const el = document.getElementById('reminderCount');
        if (el) el.textContent = data.length;
        
        const list = document.getElementById('remindersList');
        if (!list) return;
        
        if (data.length === 0) {
            list.innerHTML = '<div class="empty-state"><span class="empty-icon">📋</span><p>No reminders</p></div>';
        } else {
            list.innerHTML = data.map(r => `
                <div class="data-item">
                    <span class="item-icon">⏰</span>
                    <div class="item-content">
                        <div class="item-title">${escapeHtml(r.text)}</div>
                        <div class="item-meta">${new Date(r.due_time).toLocaleString()}</div>
                    </div>
                    <button class="delete-btn" onclick="deleteReminder(${r.id})">✕</button>
                </div>
            `).join('');
        }
    } catch (e) {}
}

async function deleteReminder(id) {
    try {
        await fetch(`${API}/api/reminders/${id}`, { method: 'DELETE' });
        fetchReminders();
    } catch (e) {}
}

async function fetchTabs() {
    try {
        const res = await fetch(`${API}/api/browser`);
        const data = await res.json();
        
        const el = document.getElementById('tabCount');
        if (el) el.textContent = data.length;
        
        const list = document.getElementById('tabsList');
        if (!list) return;
        
        if (data.length === 0) {
            list.innerHTML = '<div class="empty-state"><span class="empty-icon">🔌</span><p>No tabs open</p></div>';
        } else {
            list.innerHTML = data.map(t => `
                <div class="data-item">
                    <span class="item-icon">🌐</span>
                    <div class="item-content">
                        <div class="item-title">${escapeHtml(t.title || 'Untitled')}</div>
                        <div class="item-meta">${escapeHtml(t.url.split('/')[2] || t.url)}</div>
                    </div>
                </div>
            `).join('');
        }
    } catch (e) {}
}

async function fetchNotifications() {
    try {
        const res = await fetch(`${API}/api/notifications?limit=20`);
        const data = await res.json();
        
        const el = document.getElementById('notifCount');
        if (el) el.textContent = data.length;
        
        const list = document.getElementById('notificationsList');
        if (!list) return;
        
        if (data.length === 0) {
            list.innerHTML = '<div class="empty-state"><span class="empty-icon">🔕</span><p>No recent notifications</p></div>';
        } else {
            list.innerHTML = data.map(n => `
                <div class="data-item">
                    <span class="item-icon">${n.priority === 'urgent' ? '🔴' : '🔔'}</span>
                    <div class="item-content">
                        <div class="item-title">${escapeHtml(n.title)}</div>
                        <div class="item-meta">${n.app_source || 'System'}</div>
                    </div>
                </div>
            `).join('');
        }
    } catch (e) {}
}

async function fetchAiInsights() {
    try {
        const res = await fetch(`${API}/api/chat/history`);
        const history = await res.json();
        
        const proactive = history.filter(m => m.content.includes('[Proactive]'));
        const list = document.getElementById('aiInsightsList');
        if (!list) return;

        if (proactive.length === 0) {
            list.innerHTML = '<div class="empty-state"><span class="empty-icon">🧠</span><p>No new insights yet.</p></div>';
        } else {
            list.innerHTML = proactive.slice(-3).reverse().map(m => `
                <div class="data-item" style="border-left: 3px solid var(--accent-purple); background: rgba(192,132,252,0.05);">
                    <div class="item-content">
                        <div class="item-title" style="white-space: normal; font-size: 0.8rem;">${escapeHtml(m.content.replace('[Proactive]: ', ''))}</div>
                        <div class="item-meta">${new Date(m.timestamp).toLocaleTimeString()}</div>
                    </div>
                </div>
            `).join('');
        }
    } catch (e) {}
}

async function loadStatus() {
    try {
        const res = await fetch(`${API}/api/status`);
        const data = await res.json();
        
        document.getElementById('statUptime').textContent = formatUptime(data.uptime);
        document.getElementById('statCommands').textContent = data.commandCount || 0;
        document.getElementById('statProvider').textContent = data.provider || 'ollama';
        
    } catch (e) {}
}

async function loadSkills() {
    try {
        const res = await fetch(`${API}/api/skills`);
        const data = await res.json();
        
        const skillsList = document.getElementById('skillsList');
        if (skillsList) {
            skillsList.innerHTML = data.skills.map(s => 
                `<div style="background:var(--bg-card); border:1px solid var(--border-default); padding:1rem; border-radius:8px;">
                    <div style="font-weight:bold; color:var(--accent-blue); margin-bottom:0.3rem">${s.name}</div>
                    <div style="font-size:0.75rem; color:var(--text-secondary)">${s.description}</div>
                </div>`
            ).join('');
        }
    } catch (e) {}
}

function pollAllData() {
    fetchReminders();
    fetchTabs();
    fetchNotifications();
    fetchAiInsights();
    loadStatus();
}

// Utilities
function escapeHtml(str) {
    if (!str) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(str).replace(/[&<>"']/g, c => map[c]);
}

function escapeJs(str) {
    if (!str) return '';
    return str.replace(/'/g, "\\'");
}

function formatUptime(seconds) {
    if (!seconds) return '0m';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

async function checkHealth() {
    try {
        const res = await fetch(`${API}/api/health`);
        const data = await res.json();
        const overlay = document.getElementById('healthOverlay');
        if (data.ollama) {
            overlay.classList.add('hidden');
        } else {
            overlay.classList.remove('hidden');
        }
    } catch (e) {
        document.getElementById('healthOverlay').classList.remove('hidden');
    }
}

// Initialization
loadProjects();
checkHealth();
loadSkills();
setInterval(checkHealth, 30000);
setInterval(pollAllData, 5000);
pollAllData();

document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.code === 'Space') {
        e.preventDefault();
        startVoice();
    }
});

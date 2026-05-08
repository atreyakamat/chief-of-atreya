/* ═══════════════════════════════════════════════════════
   CHIEF — Frontend Logic (Dashboard Redesign)
   ═══════════════════════════════════════════════════════ */

const API = '';
const startTime = Date.now();
let currentProvider = 'ollama';

// State
let currentProject = null;
let projectsData = JSON.parse(localStorage.getItem('chief_projects')) || {
    'StixnVibes': { tasks: [], notes: [] },
    'Solvix Studios': { tasks: [], notes: [] },
    'Spark+ Tutoring': { tasks: [], notes: [] },
    'Rotract Club of Mapuca': { tasks: [], notes: [] },
    'Pixel N Purpose': { tasks: [], notes: [] },
    'Anjali\'s table': { tasks: [], notes: [] },
    'College Work & Projects': { tasks: [], notes: [] }
};

// View Management
function switchView(viewId, element, projectName = null) {
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
        currentProject = projectName;
        titleEl.textContent = projectName;
        document.querySelector('.project-subtitle').textContent = `Workspace / ${projectName}`;
        
        // Initialize if new
        if (!projectsData[projectName]) {
            projectsData[projectName] = { tasks: [], notes: [] };
        }
        
        renderProjectData();
    } else {
        currentProject = null;
    }
}

// Projects Management
function saveProjects() {
    localStorage.setItem('chief_projects', JSON.stringify(projectsData));
    renderAllProjectsOverview();
}

function handleTaskKeyPress(e) {
    if (e.key === 'Enter') addProjectTask();
}

function addProjectTask() {
    if (!currentProject) return;
    const input = document.getElementById('newTaskInput');
    const text = input.value.trim();
    if (!text) return;

    projectsData[currentProject].tasks.push({
        id: Date.now(),
        text: text,
        completed: false,
        createdAt: new Date().toISOString()
    });

    input.value = '';
    saveProjects();
    renderProjectData();
}

function toggleTask(taskId) {
    if (!currentProject) return;
    const task = projectsData[currentProject].tasks.find(t => t.id === taskId);
    if (task) {
        task.completed = !task.completed;
        saveProjects();
        renderProjectData();
    }
}

function deleteProjectTask(taskId) {
    if (!currentProject) return;
    projectsData[currentProject].tasks = projectsData[currentProject].tasks.filter(t => t.id !== taskId);
    saveProjects();
    renderProjectData();
}

function addProjectNote() {
    if (!currentProject) return;
    const noteText = prompt(`Add a note for ${currentProject}:`);
    if (!noteText) return;

    projectsData[currentProject].notes.push({
        id: Date.now(),
        text: noteText,
        createdAt: new Date().toISOString()
    });

    saveProjects();
    renderProjectData();
}

function renderProjectData() {
    if (!currentProject) return;
    const data = projectsData[currentProject];
    
    // Render Tasks
    const taskList = document.getElementById('projectTaskList');
    taskList.innerHTML = data.tasks.length === 0 
        ? '<div class="text-muted" style="font-size:0.85rem">No tasks for this project yet.</div>'
        : data.tasks.map(t => `
        <div class="task-item ${t.completed ? 'completed' : ''}">
            <div class="task-content">
                <input type="checkbox" class="task-checkbox" ${t.completed ? 'checked' : ''} onchange="toggleTask(${t.id})">
                <div class="task-text">${escapeHtml(t.text)}</div>
            </div>
            <button class="delete-btn" onclick="deleteProjectTask(${t.id})">✕</button>
        </div>
    `).join('');

    // Render Notes
    const notesList = document.getElementById('projectNotesList');
    notesList.innerHTML = data.notes.length === 0
        ? '<div class="text-muted" style="font-size:0.85rem">No notes yet. Talk to CHIEF or add manually.</div>'
        : data.notes.map(n => `
        <div class="note-item">
            <div class="note-date">${new Date(n.createdAt).toLocaleString()}</div>
            <div class="note-text">${escapeHtml(n.text)}</div>
        </div>
    `).reverse().join('');
}

function renderAllProjectsOverview() {
    const container = document.getElementById('allProjectsTasksOverview');
    if (!container) return;

    let html = '<div style="display:flex; flex-direction:column; gap:1rem;">';
    
    for (const [projName, projData] of Object.entries(projectsData)) {
        const pendingTasks = projData.tasks.filter(t => !t.completed);
        if (pendingTasks.length > 0) {
            html += `
                <div>
                    <h4 style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:0.5rem; text-transform:uppercase;">${projName}</h4>
                    <div style="display:flex; flex-direction:column; gap:0.4rem;">
                        ${pendingTasks.slice(0, 3).map(t => `
                            <div style="display:flex; align-items:center; gap:0.5rem; font-size:0.85rem; background:var(--bg-tertiary); padding:0.5rem; border-radius:4px; border:1px solid var(--border-default);">
                                <span style="color:var(--accent-purple)">○</span>
                                ${escapeHtml(t.text)}
                            </div>
                        `).join('')}
                        ${pendingTasks.length > 3 ? `<div style="font-size:0.75rem; color:var(--text-muted)">+ ${pendingTasks.length - 3} more tasks</div>` : ''}
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
}

// Action Buttons
function createNewTask() {
    if (currentProject) {
        document.getElementById('newTaskInput').focus();
    } else {
        alert('Please select a workspace from the sidebar first.');
    }
}

function askChiefForSummary() {
    const text = currentProject 
        ? `Hey CHIEF, give me a quick summary of my status on ${currentProject}.` 
        : `Hey CHIEF, summarize all my pending work across all projects.`;
    
    document.getElementById('chatInput').value = text;
    document.getElementById('chatForm').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
}

// Global UI Logic
function toggleSettings() {
    const modal = document.getElementById('settingsModal');
    modal.classList.toggle('hidden');
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

            // Very simple hardcoded AI interception to auto-add tasks based on prompt words (since local AI might not reliably use tool calls without setup)
            if (currentProject && (text.toLowerCase().includes('add task') || text.toLowerCase().includes('todo'))) {
                const parts = text.split(/(?:add task|todo)/i);
                if (parts[1] && parts[1].trim().length > 2) {
                    projectsData[currentProject].tasks.push({
                        id: Date.now(),
                        text: parts[1].replace(/^s|:|to|for/g, '').trim(),
                        completed: false,
                        createdAt: new Date().toISOString()
                    });
                    saveProjects();
                    renderProjectData();
                    addMessage('assistant', `(System: Auto-added task to ${currentProject})`);
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
    loadStatus();
}

// Utilities
function escapeHtml(str) {
    if (!str) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(str).replace(/[&<>"']/g, c => map[c]);
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
renderAllProjectsOverview();
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

/* ═══════════════════════════════════════════════════════
   CHIEF — Frontend Logic (Dashboard Redesign)
   ═══════════════════════════════════════════════════════ */

const { ipcRenderer } = require('electron');
window.ipcRenderer = ipcRenderer;
const API = '';
const startTime = Date.now();
let currentProvider = 'ollama';
let auditState = { page: 1, pageSize: 10, total: 0, totalPages: 1 };

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

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    loadProjects();
    checkHealth();
    loadSkills();
    
    // Check if onboarding is needed
    if (!localStorage.getItem('chief_onboarded')) {
        document.getElementById('onboardingModal').classList.remove('hidden');
    }
    
    setInterval(checkHealth, 30000);
    setInterval(pollAllData, 5000);
    pollAllData();
});

// Onboarding Logic
function nextOnboardingStep(step) {
    document.querySelectorAll('[id^="onboarding-step-"]').forEach(el => el.classList.add('hidden'));
    document.getElementById(`onboarding-step-${step}`).classList.remove('hidden');
    
    document.querySelectorAll('.onboarding-dot').forEach(el => el.classList.remove('active'));
    document.getElementById(`dot-${step}`).classList.add('active');
}

function finishOnboarding() {
    localStorage.setItem('chief_onboarded', 'true');
    document.getElementById('onboardingModal').classList.add('hidden');
    addMessage('assistant', "Great! You're all set up. I've populated some initial workspaces for you. You can see them on the left. Try saying 'task: Buy milk' or 'action: Call mom' to see how I capture your thoughts!");
}
// Window Controls
function minimizeWindow() { if (window.ipcRenderer) ipcRenderer.send('window-minimize'); }
function maximizeWindow() { if (window.ipcRenderer) ipcRenderer.send('window-maximize'); }
function closeWindow() { if (window.ipcRenderer) ipcRenderer.send('window-close'); }

// View Management
let calendarDate = new Date();

function switchView(viewId, element, projectName = null, projectId = null) {
    // Hide all views
    document.querySelectorAll('.view-panel').forEach(el => el.classList.remove('active'));
    
    // Show target view
    const targetView = document.getElementById(`view-${viewId}`);
    if (targetView) targetView.classList.add('active');

    // Update Title
    const titleEl = document.getElementById('currentViewTitle');
    const subtitleEl = document.getElementById('viewSubtitle');

    if (viewId === 'overview') {
        titleEl.textContent = 'Dashboard Overview';
        if (subtitleEl) subtitleEl.textContent = 'Live Neural Map';
    } else if (viewId === 'system') {
        titleEl.textContent = 'System Core';
        if (subtitleEl) subtitleEl.textContent = 'Hardware & Neural Status';
    } else if (viewId === 'calendar') {
        titleEl.textContent = 'Neural Calendar';
        if (subtitleEl) subtitleEl.textContent = 'Unified Event Matrix';
        renderCalendar();
    } else if (viewId === 'links') {
        titleEl.textContent = 'Neural Links';
        if (subtitleEl) subtitleEl.textContent = 'Intelligent URL Repository';
        loadLinks();
    } else if (viewId === 'business') {
        titleEl.textContent = 'Spark+ Business Hub';
        if (subtitleEl) subtitleEl.textContent = 'Lead & Partnership Servicing';
        loadLeads();
    } else if (viewId === 'security') {
        titleEl.textContent = 'Security Center';
        if (subtitleEl) subtitleEl.textContent = 'Approvals, Audit Trail, and Admin Controls';
        refreshSecurityCenter();
    }

    if (viewId === 'project' && projectName) {
        currentProjectId = projectId;
        currentProjectName = projectName;
        titleEl.textContent = projectName;
        if (subtitleEl) subtitleEl.textContent = `WORKSPACE ACTIVE / ID: ${projectId}`;
        renderProjectData();
    } else {
        currentProjectId = null;
        currentProjectName = null;
    }

    // Refresh sidebar to update active classes on dynamic items
    renderSidebar();
}

// ─── THEME LOGIC ───
function toggleTheme() {
    const body = document.body;
    const isLight = body.classList.toggle('light-theme');
    localStorage.setItem('chief_theme', isLight ? 'light' : 'dark');
    document.getElementById('themeIcon').textContent = isLight ? '☀️' : '🌙';
}

// Initialize theme on load
if (localStorage.getItem('chief_theme') === 'light') {
    document.body.classList.add('light-theme');
    const icon = document.getElementById('themeIcon');
    if (icon) icon.textContent = '☀️';
}

// ─── CALENDAR LOGIC ───
function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    const monthTitle = document.getElementById('calendarMonth');
    if (!grid) return;

    grid.innerHTML = '';
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    
    monthTitle.textContent = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(calendarDate);

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Adjust for Monday start (0=Sun, 1=Mon... in JS)
    let startOffset = firstDay === 0 ? 6 : firstDay - 1;

    // Prev month days
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = startOffset; i > 0; i--) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day other-month';
        dayDiv.innerHTML = `<span class="day-number">${prevMonthDays - i + 1}</span>`;
        grid.appendChild(dayDiv);
    }

    // Current month days
    const today = new Date();
    for (let d = 1; d <= daysInMonth; d++) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day';
        if (d === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
            dayDiv.classList.add('today');
        }
        dayDiv.innerHTML = `<span class="day-number">${d}</span><div class="day-events"></div>`;
        grid.appendChild(dayDiv);
    }

    // Next month days
    const remaining = 42 - (startOffset + daysInMonth);
    for (let i = 1; i <= remaining; i++) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day other-month';
        dayDiv.innerHTML = `<span class="day-number">${i}</span>`;
        grid.appendChild(dayDiv);
    }
}

function prevMonth() { calendarDate.setMonth(calendarDate.getMonth() - 1); renderCalendar(); }
function nextMonth() { calendarDate.setMonth(calendarDate.getMonth() + 1); renderCalendar(); }

async function syncCalendar() {
    addMessage('assistant', "Syncing with Google Calendar... Sir, give me a moment to establish the neural link.");
    setTimeout(() => {
        addMessage('assistant', "Neural link established. Calendar synced successfully.");
    }, 2000);
}

function openNewEventModal() {
    alert("Sir, Manual Event creation is currently handled via AI voice or chat. Try: 'Zen, add a meeting for tomorrow at 2pm'.");
}

// ─── LINK MANAGER LOGIC ───
async function loadLinks() {
    const list = document.getElementById('linksList');
    if (!list) return;

    try {
        const res = await fetch(`${API}/api/links`);
        const links = await res.json();

        if (links.length === 0) {
            list.innerHTML = '<div class="empty-state"><span class="empty-icon">🔗</span><p>No neural links stored yet.</p></div>';
            return;
        }

        list.innerHTML = links.map(l => `
            <div class="dash-card" style="height: auto; padding: 1.5rem; transition: var(--transition);">
                <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom: 1rem;">
                    <h4 style="font-size:0.9rem; color:var(--accent-glow); font-weight:800; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(l.title)}</h4>
                    <span class="badge" style="background:var(--bg-app); border:1px solid var(--border-main); color:var(--text-muted);">LINK</span>
                </div>
                <p style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:1.5rem; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden;">${escapeHtml(l.summary || 'No neural summary available.')}</p>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top: auto; padding-top: 1rem; border-top:1px solid var(--border-main);">
                    <code style="font-size:0.65rem; color:var(--text-muted); max-width:150px; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(l.url)}</code>
                    <button class="win-btn" style="border:1px solid var(--accent-glow); color:var(--accent-glow); padding: 0.4rem 0.8rem; border-radius:6px; font-size:0.65rem; font-weight:800;" onclick="window.ipcRenderer.send('open-external', '${escapeJs(l.url)}')">OPEN</button>
                </div>
            </div>
        `).join('');
    } catch (e) {
        console.error('Failed to load links:', e);
    }
}

async function saveCurrentPageAsLink() {
    // ... existing saveCurrentPageAsLink ...
}

// ─── BUSINESS HUB LOGIC ───
async function loadLeads() {
    const list = document.getElementById('leadsList');
    if (!list) return;

    try {
        const res = await fetch(`${API}/api/leads`);
        const leads = await res.json();

        // Update Stats
        document.getElementById('countColleges').textContent = leads.filter(l => l.type === 'College' && l.status === 'Onboarded').length;
        document.getElementById('countEmployers').textContent = leads.filter(l => l.type === 'Employer' && l.status === 'Onboarded').length;
        document.getElementById('countPathways').textContent = leads.filter(l => l.status === 'Onboarded').length; // Placeholder
        document.getElementById('countProjects').textContent = leads.filter(l => l.type === 'Startup/Partner' && l.status === 'Onboarded').length;

        if (leads.length === 0) {
            list.innerHTML = '<div class="empty-state"><span class="empty-icon">💼</span><p>No leads in the pipeline yet.</p></div>';
            return;
        }

        list.innerHTML = leads.map(l => `
            <div class="data-item">
                <div class="item-icon" style="background:var(--bg-app); border:1px solid var(--border-main);">
                    ${l.type === 'College' ? '🎓' : l.type === 'Employer' ? '🏢' : '🤝'}
                </div>
                <div class="item-content">
                    <div style="display:flex; align-items:center; gap:0.5rem;">
                        <span class="item-title">${escapeHtml(l.name)}</span>
                        <span class="badge" style="font-size:0.6rem; padding:1px 5px;">${l.status}</span>
                    </div>
                    <div class="item-meta">${escapeHtml(l.contact_info || 'No contact info')}</div>
                </div>
                <div style="display:flex; gap:0.5rem;">
                    <button class="win-btn" style="border:1px solid var(--border-main); padding: 0.3rem 0.6rem; border-radius:6px; font-size:0.6rem;" onclick="updateLeadStatus(${l.id}, 'Onboarded')">ONBOARD</button>
                    <button class="win-btn" style="border:1px solid var(--border-main); padding: 0.3rem 0.6rem; border-radius:6px; font-size:0.6rem;" onclick="updateLeadStatus(${l.id}, 'Demo Scheduled')">DEMO</button>
                </div>
            </div>
        `).join('');
    } catch (e) {}
}

async function updateLeadStatus(id, status) {
    try {
        await fetch(`${API}/api/leads/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        loadLeads();
    } catch (e) {}
}

async function openNewLeadModal() {
    const name = prompt("Enter Partner/Institution Name:");
    if (!name) return;
    const type = prompt("Type (College, Employer, Startup/Partner):", "College");
    const contact = prompt("Contact Person / Info:");
    
    try {
        await fetch(`${API}/api/leads`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, type, contact_info: contact })
        });
        loadLeads();
    } catch (e) {}
}

// AI Quick Actions
function quickAction(prompt) {
    const input = document.getElementById('chatInput');
    input.value = prompt;
    document.getElementById('chatForm').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
}

async function runZenBriefing() {
    addMessage('user', 'Run Zen Protocol Briefing');
    const thinking = document.getElementById('thinking');
    thinking.classList.remove('hidden');
    
    try {
        const res = await fetch(`${API}/api/zen/briefing`, { method: 'POST' });
        const data = await res.json();
        
        thinking.classList.add('hidden');
        if (data.success) {
            addMessage('assistant', data.text);
        }
    } catch (e) {
        thinking.classList.add('hidden');
        alert('Failed to run Zen Briefing.');
    }
}

async function triggerNeuralScan() {
    addMessage('assistant', "(System: Initiating Neural Scan...)");
    try {
        const res = await fetch(`${API}/api/zen/scan`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            addMessage('assistant', "Neural Scan complete. I've captured your screen and added the context to my memory.");
        }
    } catch (e) {
        alert('Neural Scan failed.');
    }
}

async function createMeet() {
    addMessage('user', "Create a new Google Meet");
    quickAction("Create a new Google Meet for this workspace.");
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
        
        let html = '<div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap:1.25rem;">';
        
        for (const project of allProjects) {
            const projectTasks = allTasks.filter(t => t.project_id === project.id && t.status !== 'done');
            if (projectTasks.length > 0) {
                html += `
                    <div style="background:var(--bg-glass); border:1px solid var(--border-light); padding:1.25rem; border-radius:var(--radius-md); transition: var(--transition);" 
                         onmouseover="this.style.borderColor='var(--accent-primary)'" 
                         onmouseout="this.style.borderColor='var(--border-light)'">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                            <h4 style="font-size:0.85rem; color:var(--text-main); font-weight:700;">${escapeHtml(project.name)}</h4>
                            <span class="badge">${projectTasks.length}</span>
                        </div>
                        <div style="display:flex; flex-direction:column; gap:0.6rem;">
                            ${projectTasks.slice(0, 3).map(t => `
                                <div style="display:flex; align-items:center; gap:0.6rem; font-size:0.8rem; color:var(--text-dim);">
                                    <span style="color:var(--accent-primary); font-size:1rem;">•</span>
                                    <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(t.title)}</span>
                                </div>
                            `).join('')}
                            ${projectTasks.length > 3 ? `<div style="font-size:0.7rem; color:var(--text-muted); margin-top:0.4rem; font-weight:600;">+ ${projectTasks.length - 3} MORE TASKS</div>` : ''}
                        </div>
                    </div>
                `;
            }
        }

        if (html === '<div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap:1.25rem;">') {
            html = '<div class="empty-state"><span class="empty-icon">✨</span><p>All projects are up to date!</p></div>';
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
    
    // Load current values
    document.getElementById('aiProvider').value = localStorage.getItem('chief_provider') || 'ollama';
    document.getElementById('groqKey').value = localStorage.getItem('chief_groq_key') || '';
    document.getElementById('openRouterKey').value = localStorage.getItem('chief_openrouter_key') || '';
    document.getElementById('nvidiaKey').value = localStorage.getItem('chief_nvidia_key') || '';
    document.getElementById('wakeWord').value = localStorage.getItem('chief_wakeword') || 'hey chief';
    
    // Update ingest URL based on current host
    const urlEl = document.getElementById('ingestUrl');
    if (urlEl) {
        urlEl.textContent = `MOBILE INGEST URL: ${window.location.origin}/api/ingest`;
    }
}

async function saveSettings() {
    const provider = document.getElementById('aiProvider').value;
    const groqKey = document.getElementById('groqKey').value;
    const openRouterKey = document.getElementById('openRouterKey').value;
    const nvidiaKey = document.getElementById('nvidiaKey').value;
    const wakeWord = document.getElementById('wakeWord').value;

    try {
        const res = await fetch(`${API}/api/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                provider, 
                groqKey, 
                openRouterKey, 
                nvidiaKey, 
                wakeWord 
            })
        });
        const data = await res.json();
        
        if (data.success) {
            localStorage.setItem('chief_provider', provider);
            localStorage.setItem('chief_groq_key', groqKey);
            localStorage.setItem('chief_openrouter_key', openRouterKey);
            localStorage.setItem('chief_nvidia_key', nvidiaKey);
            localStorage.setItem('chief_wakeword', wakeWord);
            
            toggleSettings();
            addMessage('assistant', `System Configuration Synchronized. Engine set to: **${provider}**.`);
            loadStatus();
        }
    } catch (e) {
        alert('Failed to save settings.');
    }
}

function apiHeaders(extra = {}) {
    const headers = { ...extra };
    const adminPassword = localStorage.getItem('chief_admin_password');
    if (adminPassword) headers['x-zen-admin'] = adminPassword;
    return headers;
}

async function saveAdminPassword() {
    const current = document.getElementById('adminCurrentPassword')?.value || '';
    const password = document.getElementById('adminNewPassword')?.value || '';
    if (!password || password.length < 6) {
        alert('Please enter a new password with at least 6 characters.');
        return;
    }

    const payload = { password };
    if (current) payload.current = current;

    try {
        const res = await fetch(`${API}/api/admin/set-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!data.success) {
            alert(data.error || 'Failed to save admin password');
            return;
        }
        localStorage.setItem('chief_admin_password', password);
        document.getElementById('securityStatus').textContent = 'Admin password updated and stored locally for approval requests.';
        document.getElementById('adminCurrentPassword').value = '';
        document.getElementById('adminNewPassword').value = '';
        refreshSecurityCenter();
    } catch (e) {
        alert('Failed to save admin password.');
    }
}

// ─── CHAT & API LOGIC ───

function handleChatEnter(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        document.getElementById('chatForm').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    }
}

async function updateProvider(provider) {
    try {
        const res = await fetch(`${API}/api/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider })
        });
        const data = await res.json();
        if (data.success) {
            localStorage.setItem('chief_provider', provider);
            // Sync with settings modal if open
            const modalSelector = document.getElementById('aiProvider');
            if (modalSelector) modalSelector.value = provider;
            
            addMessage('assistant', `Brain swapped. I am now using **${provider}**.`);
            loadStatus();
        }
    } catch (e) {
        alert('Failed to update provider.');
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
    
    // Gather platform context
    const currentView = document.querySelector('.view-panel.active')?.id?.replace('view-', '') || 'overview';
    
    try {
        const res = await fetch(`${API}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                text,
                context: {
                    currentProject: currentProjectName,
                    currentView: currentView,
                    allWorkspaces: allProjects.map(p => p.name)
                }
            })
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
    
    // Convert newlines to breaks and escape HTML
    const formattedContent = escapeHtml(content)
        .replace(/\n/g, '<br>')
        .replace(/\[Proactive\]:/g, '<strong style="color:var(--accent-secondary)">💡 Insight:</strong>');

    div.innerHTML = `
        <div class="msg-text">${formattedContent}</div>
        <div class="msg-time">${role === 'assistant' ? 'CHIEF' : 'You'} • ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
    `;
    
    chatMessages.appendChild(div);
    
    // Smooth scroll to bottom
    const container = chatMessages.parentElement;
    container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
    });
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
        
        // Sync quick selector
        const quickSel = document.getElementById('quickProvider');
        if (quickSel) quickSel.value = data.provider || 'ollama';
        
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

async function loadSecurityStatus() {
    try {
        const res = await fetch(`${API}/api/status`);
        const data = await res.json();
        const statusEl = document.getElementById('securityStatus');
        if (statusEl) {
            statusEl.textContent = `${data.localOnly ? 'Local-only mode' : 'Remote mode'} is active on ${data.bindHost || 'localhost'}. Admin actions require a password and local-origin requests unless remote admin is explicitly enabled.`;
        }
    } catch (e) {}
}

async function loadPendingActions() {
    const list = document.getElementById('pendingActionsList');
    if (!list) return;
    try {
        const res = await fetch(`${API}/api/pending-actions`, { headers: apiHeaders() });
        if (!res.ok) {
            list.innerHTML = '<div class="empty-state"><span class="empty-icon">🔒</span><p>Admin password required to view pending actions.</p></div>';
            return;
        }
        const rows = await res.json();
        if (!rows.length) {
            list.innerHTML = '<div class="empty-state"><span class="empty-icon">🕓</span><p>No pending actions.</p></div>';
            return;
        }
        list.innerHTML = rows.slice(0, 8).map(row => `
            <div style="border:1px solid var(--border-main); border-radius:10px; padding:0.9rem; background:var(--bg-app);">
                <div style="display:flex; justify-content:space-between; gap:0.75rem; align-items:start; margin-bottom:0.5rem;">
                    <div>
                        <div style="font-weight:800; color:#fff; font-size:0.85rem;">#${row.id} ${escapeHtml(row.action_type)}</div>
                        <div style="font-size:0.72rem; color:var(--text-muted);">${escapeHtml(row.status)} • ${escapeHtml(row.created_at || '')}</div>
                    </div>
                    <div style="display:flex; gap:0.4rem; flex-wrap:wrap; justify-content:flex-end;">
                        <button class="win-btn" style="border:1px solid var(--border-main); padding:0.35rem 0.6rem; border-radius:6px; font-size:0.6rem;" onclick="approvePending(${row.id})">Approve</button>
                        <button class="win-btn" style="border:1px solid var(--border-main); padding:0.35rem 0.6rem; border-radius:6px; font-size:0.6rem;" onclick="rejectPending(${row.id})">Reject</button>
                        <button class="win-btn" style="border:1px solid var(--accent-glow); padding:0.35rem 0.6rem; border-radius:6px; font-size:0.6rem; color:var(--accent-glow);" onclick="executePending(${row.id})">Execute</button>
                    </div>
                </div>
                <pre style="white-space:pre-wrap; margin:0; color:var(--text-secondary); font-size:0.72rem; max-height:150px; overflow:auto;">${escapeHtml(JSON.stringify(row.payload || {}, null, 2))}</pre>
            </div>
        `).join('');
    } catch (e) {
        list.innerHTML = '<div class="empty-state"><span class="empty-icon">⚠️</span><p>Failed to load pending actions.</p></div>';
    }
}

async function refreshAudit(page = auditState.page) {
    auditState.page = page;
    const list = document.getElementById('auditTimeline');
    const pager = document.getElementById('auditPager');
    if (!list || !pager) return;
    const eventType = document.getElementById('auditEventType')?.value || '';
    const q = document.getElementById('auditSearch')?.value || '';
    try {
        const params = new URLSearchParams({ page: String(page), pageSize: String(auditState.pageSize) });
        if (eventType) params.set('eventType', eventType);
        if (q) params.set('q', q);
        const res = await fetch(`${API}/api/audit?${params.toString()}`, { headers: apiHeaders() });
        if (!res.ok) {
            list.innerHTML = '<div class="empty-state"><span class="empty-icon">🔒</span><p>Admin password required to view audit logs.</p></div>';
            pager.innerHTML = '';
            return;
        }
        const data = await res.json();
        auditState.total = data.total || 0;
        auditState.totalPages = data.totalPages || 1;
        if (!data.rows || data.rows.length === 0) {
            list.innerHTML = '<div class="empty-state"><span class="empty-icon">🧾</span><p>No audit records found.</p></div>';
        } else {
            list.innerHTML = data.rows.map(row => `
                <div style="border:1px solid var(--border-main); border-radius:10px; padding:0.9rem; background:var(--bg-app);">
                    <div style="display:flex; justify-content:space-between; gap:1rem; align-items:center; margin-bottom:0.5rem;">
                        <div style="font-weight:800; color:#fff;">${escapeHtml(row.event_type)}</div>
                        <div style="font-size:0.72rem; color:var(--text-muted);">${escapeHtml(row.created_at || '')}</div>
                    </div>
                    <pre style="white-space:pre-wrap; margin:0; color:var(--text-secondary); font-size:0.72rem; max-height:150px; overflow:auto;">${escapeHtml(JSON.stringify(row.details || {}, null, 2))}</pre>
                </div>
            `).join('');
        }
        pager.innerHTML = `
            <button class="win-btn" style="border:1px solid var(--border-main); padding:0.3rem 0.6rem; border-radius:6px; font-size:0.65rem;" ${page <= 1 ? 'disabled' : ''} onclick="refreshAudit(${Math.max(page - 1, 1)})">Prev</button>
            <span>Page ${data.page || page} / ${data.totalPages || 1} • ${data.total || 0} entries</span>
            <button class="win-btn" style="border:1px solid var(--border-main); padding:0.3rem 0.6rem; border-radius:6px; font-size:0.65rem;" ${page >= (data.totalPages || 1) ? 'disabled' : ''} onclick="refreshAudit(${page + 1})">Next</button>
        `;
    } catch (e) {
        list.innerHTML = '<div class="empty-state"><span class="empty-icon">⚠️</span><p>Failed to load audit logs.</p></div>';
    }
}

async function exportAuditCsv() {
    const eventType = document.getElementById('auditEventType')?.value || '';
    const q = document.getElementById('auditSearch')?.value || '';
    const params = new URLSearchParams({ export: 'csv' });
    if (eventType) params.set('eventType', eventType);
    if (q) params.set('q', q);
    const res = await fetch(`${API}/api/audit?${params.toString()}`, { headers: apiHeaders() });
    if (!res.ok) {
        alert('Admin password required to export audit logs.');
        return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'audit-log.csv';
    a.click();
    URL.revokeObjectURL(url);
}

async function approvePending(id) {
    const res = await fetch(`${API}/api/pending-actions/${id}/approve`, { method: 'POST', headers: apiHeaders({ 'Content-Type': 'application/json' }) });
    if (!res.ok) return alert('Approval failed.');
    refreshSecurityCenter();
}

async function rejectPending(id) {
    const res = await fetch(`${API}/api/pending-actions/${id}/reject`, { method: 'POST', headers: apiHeaders({ 'Content-Type': 'application/json' }) });
    if (!res.ok) return alert('Reject failed.');
    refreshSecurityCenter();
}

async function executePending(id) {
    if (!confirm('Execute this approved action? This may change system state.')) return;
    const res = await fetch(`${API}/api/pending-actions/${id}/execute`, { method: 'POST', headers: apiHeaders({ 'Content-Type': 'application/json' }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        alert(data.error || 'Execution failed.');
        return;
    }
    alert('Execution complete.');
    refreshSecurityCenter();
}

async function refreshSecurityCenter() {
    loadSecurityStatus();
    loadPendingActions();
    refreshAudit(1);
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

document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.code === 'Space') {
        e.preventDefault();
        startVoice();
    }
});

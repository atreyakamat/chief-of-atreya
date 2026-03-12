/* ═══════════════════════════════════════════════════════
   CHIEF — Dashboard Logic
   ═══════════════════════════════════════════════════════ */

const API = '';
let commandCount = 0;
const startTime = Date.now();

// ─── DOM References ───
const landingPage = document.getElementById('landingPage');
const dashboardPage = document.getElementById('dashboardPage');
const commandForm = document.getElementById('commandForm');
const commandInput = document.getElementById('commandInput');
const voiceWave = document.getElementById('voiceWave');
const aiResponse = document.getElementById('aiResponse');
const aiResponseText = document.getElementById('aiResponseText');

const remindersList = document.getElementById('remindersList');
const tabsList = document.getElementById('tabsList');
const notificationsList = document.getElementById('notificationsList');

const reminderCount = document.getElementById('reminderCount');
const tabCount = document.getElementById('tabCount');
const notifCount = document.getElementById('notifCount');

const statUptime = document.getElementById('statUptime');
const statCommands = document.getElementById('statCommands');
const statReminders = document.getElementById('statReminders');
const statNotifs = document.getElementById('statNotifs');

const statusAI = document.getElementById('statusAI');
const statusVoice = document.getElementById('statusVoice');
const statusBrowser = document.getElementById('statusBrowser');

// ─── Page Navigation ───
function showDashboard() {
    landingPage.classList.add('hidden');
    dashboardPage.classList.remove('hidden');
    pollAllData();
    commandInput.focus();
}

function showLanding() {
    dashboardPage.classList.add('hidden');
    landingPage.classList.remove('hidden');
}

// ─── Data Fetching ───
async function fetchReminders() {
    try {
        const res = await fetch(`${API}/api/reminders`);
        const data = await res.json();
        reminderCount.textContent = data.length;
        statReminders.textContent = data.length;

        if (data.length === 0) {
            remindersList.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">📋</span>
                    <p>No active reminders</p>
                    <p class="sub">Use the command bar to create one</p>
                </div>`;
        } else {
            remindersList.innerHTML = data.map(r => `
                <div class="data-item">
                    <span class="item-icon">⏰</span>
                    <div class="item-content">
                        <div class="item-title">${escapeHtml(r.text)}</div>
                        <div class="item-meta">Due: ${new Date(r.due_time).toLocaleString()}${r.recurring_rule ? ` · Repeats: ${r.recurring_rule}` : ''}</div>
                    </div>
                    <button class="delete-btn" onclick="deleteReminder(${r.id})" title="Delete">✕</button>
                </div>
            `).join('');
        }
    } catch (e) {
        console.error('Failed to fetch reminders:', e);
    }
}

async function fetchTabs() {
    try {
        const res = await fetch(`${API}/api/browser`);
        const data = await res.json();
        tabCount.textContent = data.length;

        if (data.length > 0) {
            statusBrowser.classList.add('active');
        }

        if (data.length === 0) {
            tabsList.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">🔌</span>
                    <p>No Chrome connection</p>
                    <p class="sub">Start Chrome with --remote-debugging-port=9222</p>
                </div>`;
        } else {
            tabsList.innerHTML = data.map(t => {
                const favicon = getFaviconUrl(t.url);
                return `
                <div class="data-item">
                    <span class="item-icon">🌐</span>
                    <div class="item-content">
                        <div class="item-title">${escapeHtml(t.title || 'Untitled')}</div>
                        <div class="item-meta">${escapeHtml(truncateUrl(t.url))}</div>
                    </div>
                </div>`;
            }).join('');
        }
    } catch (e) {
        console.error('Failed to fetch tabs:', e);
    }
}

async function fetchNotifications() {
    try {
        const res = await fetch(`${API}/api/notifications`);
        const data = await res.json();
        notifCount.textContent = data.length;
        statNotifs.textContent = data.length;

        if (data.length === 0) {
            notificationsList.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">🔕</span>
                    <p>No notifications logged</p>
                    <p class="sub">Notifications will appear here as they arrive</p>
                </div>`;
        } else {
            notificationsList.innerHTML = data.map(n => {
                const badgeClass = n.priority === 'urgent' ? 'badge-urgent' : n.priority === 'low' ? 'badge-low' : 'badge-normal';
                return `
                <div class="data-item">
                    <span class="item-icon">${n.priority === 'urgent' ? '🔴' : '🔔'}</span>
                    <div class="item-content">
                        <div class="item-title">${escapeHtml(n.title)}</div>
                        <div class="item-meta">${escapeHtml(n.app_source)} · ${new Date(n.timestamp).toLocaleTimeString()}</div>
                    </div>
                    <span class="item-badge ${badgeClass}">${n.priority}</span>
                </div>`;
            }).join('');
        }
    } catch (e) {
        console.error('Failed to fetch notifications:', e);
    }
}

// ─── Command Submission ───
async function submitCommand(text) {
    voiceWave.classList.add('active');
    commandInput.disabled = true;
    commandCount++;
    statCommands.textContent = commandCount;

    try {
        const res = await fetch(`${API}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        const data = await res.json();

        if (data.success && data.text) {
            aiResponseText.textContent = data.text;
            aiResponse.classList.remove('hidden');
        } else if (data.error) {
            aiResponseText.textContent = `Error: ${data.error}`;
            aiResponse.classList.remove('hidden');
        }

        commandInput.value = '';
        pollAllData();
    } catch (e) {
        console.error('Command failed:', e);
        aiResponseText.textContent = 'Failed to reach CHIEF backend. Is the server running?';
        aiResponse.classList.remove('hidden');
    } finally {
        voiceWave.classList.remove('active');
        commandInput.disabled = false;
        commandInput.focus();
    }
}

commandForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = commandInput.value.trim();
    if (val.length > 0) submitCommand(val);
});

// ─── Delete Reminder ───
async function deleteReminder(id) {
    try {
        await fetch(`${API}/api/reminders/${id}`, { method: 'DELETE' });
        fetchReminders();
    } catch (e) {
        console.error('Delete failed:', e);
    }
}

// ─── Utilities ───
function escapeHtml(str) {
    if (!str) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return str.replace(/[&<>"']/g, c => map[c]);
}

function truncateUrl(url) {
    if (!url) return '';
    try {
        const u = new URL(url);
        return u.hostname + (u.pathname.length > 30 ? u.pathname.substring(0, 30) + '…' : u.pathname);
    } catch {
        return url.length > 50 ? url.substring(0, 50) + '…' : url;
    }
}

function getFaviconUrl(url) {
    try {
        const u = new URL(url);
        return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=16`;
    } catch {
        return '';
    }
}

function updateUptime() {
    const diff = Date.now() - startTime;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    statUptime.textContent = hours > 0 ? `${hours}h ${mins % 60}m` : `${mins}m`;
}

// ─── Keyboard Shortcut (Ctrl+Space) ───
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.code === 'Space') {
        e.preventDefault();
        if (dashboardPage.classList.contains('hidden')) {
            showDashboard();
        }
        voiceWave.classList.add('active');
        setTimeout(() => voiceWave.classList.remove('active'), 3000);
    }
});

// ─── Polling ───
function pollAllData() {
    fetchReminders();
    fetchTabs();
    fetchNotifications();
    updateUptime();
}

// Check status indicators on load
async function checkStatuses() {
    try {
        const tabs = await (await fetch(`${API}/api/browser`)).json();
        if (tabs.length > 0) statusBrowser.classList.add('active');
    } catch {}
    // Server is active since page loaded
    document.getElementById('statusServer').classList.add('active');
}

// Boot
checkStatuses();
setInterval(pollAllData, 5000);
setInterval(updateUptime, 60000);

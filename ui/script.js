/* CHIEF Dashboard Logic */

const API = '';
let commandCount = 0;
let chatHistory = [];
let currentProvider = 'ollama';
const startTime = Date.now();

// DOM References
const landingPage = document.getElementById('landingPage');
const dashboardPage = document.getElementById('dashboardPage');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const chatMessages = document.getElementById('chatMessages');
const voiceBtn = document.getElementById('voiceBtn');
const modelSelect = document.getElementById('modelSelect');
const channelSelect = document.getElementById('channelSelect');

// Page Navigation
function showDashboard() {
    landingPage.classList.add('hidden');
    dashboardPage.classList.remove('hidden');
    loadInitialData();
    chatInput.focus();
}

function showLanding() {
    dashboardPage.classList.add('hidden');
    landingPage.classList.remove('hidden');
}

// Data Loading
async function loadInitialData() {
    await loadModels();
    await loadSkills();
    await loadStatus();
    pollAllData();
}

async function loadModels() {
    try {
        const res = await fetch(`${API}/api/models`);
        const data = await res.json();
        
        modelSelect.innerHTML = '';
        
        if (data.ollama && data.ollama.length > 0) {
            const ollamaGroup = document.createElement('optgroup');
            ollamaGroup.label = 'Ollama (Local)';
            data.ollama.forEach(m => {
                const opt = document.createElement('option');
                opt.value = `ollama:${m}`;
                opt.textContent = m;
                if (currentProvider === 'ollama' && m === 'llama3.2') opt.selected = true;
                ollamaGroup.appendChild(opt);
            });
            modelSelect.appendChild(ollamaGroup);
        }
        
    } catch (e) {
        console.error('Failed to load models:', e);
    }
}

async function loadSkills() {
    try {
        const res = await fetch(`${API}/api/skills`);
        const data = await res.json();
        
        const skillsList = document.getElementById('skillsList');
        if (skillsList) {
            skillsList.innerHTML = data.skills.map(s => 
                `<div class="skill-tag" onclick="useSkill('${s.name}')" title="${s.description}">${s.name}</div>`
            ).join('');
        }
        
        if (channelSelect) {
            channelSelect.innerHTML = data.channels.map(c => 
                `<option value="${c.name}" ${c.name === (data.activeChannel?.name || 'general') ? 'selected' : ''}>#${c.name}</option>`
            ).join('');
        }
    } catch (e) {
        console.error('Failed to load skills:', e);
    }
}

async function loadStatus() {
    try {
        const res = await fetch(`${API}/api/status`);
        const data = await res.json();
        
        document.getElementById('statUptime').textContent = formatUptime(data.uptime);
        document.getElementById('statCommands').textContent = data.commandCount || 0;
        
        const providerEl = document.getElementById('statProvider');
        if (providerEl) providerEl.textContent = data.provider || 'ollama';
        
        currentProvider = data.provider;
        
        if (data.services?.browser === 'connected') {
            document.getElementById('statusBrowser')?.classList.add('active');
        }
        if (data.services?.voice === 'ready') {
            document.getElementById('statusVoice')?.classList.add('active');
        }
        document.getElementById('statusAI')?.classList.add('active');
    } catch (e) {
        console.error('Failed to load status:', e);
    }
}

// Model & Channel Switching
async function changeModel(value) {
    const [provider, model] = value.split(':');
    try {
        await fetch(`${API}/api/model`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider, model })
        });
        currentProvider = provider;
        const providerEl = document.getElementById('statProvider');
        if (providerEl) providerEl.textContent = provider;
    } catch (e) {
        console.error('Failed to change model:', e);
    }
}

async function changeChannel(channelName) {
    try {
        await fetch(`${API}/api/channel`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channelName })
        });
    } catch (e) {
        console.error('Failed to change channel:', e);
    }
}

// Skills
async function useSkill(skillName) {
    const input = prompt(`Enter input for ${skillName}:`);
    if (!input) return;
    
    try {
        const res = await fetch(`${API}/api/skills/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ skillName, input })
        });
        const data = await res.json();
        addMessage('assistant', data.result || data.error);
    } catch (e) {
        addMessage('error', 'Skill execution failed');
    }
}

// Chat
if (chatForm) {
    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = chatInput.value.trim();
        if (!text) return;
        
        addMessage('user', text);
        chatInput.value = '';
        
        const thinking = document.getElementById('thinking');
        if (thinking) thinking.classList.remove('hidden');
        
        try {
            const res = await fetch(`${API}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });
            const data = await res.json();
            
            if (thinking) thinking.classList.add('hidden');
            
            if (data.success) {
                addMessage('assistant', data.text);
                if (data.history) pollAllData();
                
                if (data.needs_skill_confirmation) {
                    addConfirmationButton(data.needs_skill_confirmation.skillName, data.needs_skill_confirmation.input);
                }
            } else {
                addMessage('error', data.error);
            }
        } catch (e) {
            if (thinking) thinking.classList.add('hidden');
            addMessage('error', 'Failed to connect to CHIEF');
        }
    });
}

function addConfirmationButton(skillName, input) {
    const div = document.createElement('div');
    div.className = 'chat-message assistant confirmation-msg';
    div.innerHTML = `
        <div style="margin-bottom: 0.8rem;">⚠️ CHIEF wants to run a potentially dangerous skill: <b>${skillName}</b></div>
        <div style="font-family: monospace; background: rgba(0,0,0,0.2); padding: 0.4rem; border-radius: 4px; font-size: 0.75rem; margin-bottom: 1rem;">${input}</div>
        <div style="display: flex; gap: 0.5rem;">
            <button class="btn-primary" onclick="confirmSkill(this, '${skillName}', '${input}')" style="padding: 0.4rem 0.8rem; font-size: 0.75rem;">Confirm & Run</button>
            <button class="btn-secondary" onclick="this.parentElement.parentElement.remove()" style="padding: 0.4rem 0.8rem; font-size: 0.75rem;">Cancel</button>
        </div>
    `;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function confirmSkill(btn, skillName, input) {
    const parent = btn.parentElement.parentElement;
    parent.innerHTML = `<i>Executing ${skillName}...</i>`;
    
    try {
        const res = await fetch(`${API}/api/skills/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ skillName, input, confirmed: true })
        });
        const data = await res.json();
        parent.innerHTML = `<b>${skillName} Output:</b><br>${escapeHtml(data.result || data.error)}`;
    } catch (e) {
        parent.innerHTML = `<span style="color: var(--accent-red);">Failed to execute ${skillName}</span>`;
    }
}

// Settings
function toggleSettings() {
    const modal = document.getElementById('settingsModal');
    modal.classList.toggle('hidden');
}

async function saveSettings() {
    const weatherKey = document.getElementById('weatherApiKey').value;
    const wakeWord = document.getElementById('wakeWord').value;
    const distraction = document.getElementById('distractionEnabled').checked;

    // We can save these to localStorage for persistence in the UI
    localStorage.setItem('chief_weather_key', weatherKey);
    localStorage.setItem('chief_wake_word', wakeWord);
    localStorage.setItem('chief_distraction', distraction);

    // Also send to server to update .env or session state if we implement a settings API
    // For now, let's at least show a success message
    alert('Settings saved locally. Note: Weather API key must also be in your .env file for the backend to use it.');
    toggleSettings();
}

function addMessage(role, content) {
    const div = document.createElement('div');
    div.className = `chat-message ${role}`;
    div.innerHTML = `
        ${escapeHtml(content)}
        <div class="msg-time">${new Date().toLocaleTimeString()}</div>
    `;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function clearChat() {
    chatMessages.innerHTML = '';
}

function stopSpeaking() {
    fetch(`${API}/api/voice/speak`, { method: 'DELETE' });
}

// Voice
function startVoice() {
    if (voiceBtn) {
        voiceBtn.classList.add('listening');
    }
    fetch(`${API}/api/voice/record`, { method: 'POST' });
    setTimeout(() => {
        if (voiceBtn) voiceBtn.classList.remove('listening');
    }, 3000);
}

// Legacy command form support
const commandForm = document.getElementById('commandForm');
const commandInput = document.getElementById('commandInput');
if (commandForm && commandInput) {
    commandForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = commandInput.value.trim();
        if (!text) return;
        
        commandCount++;
        try {
            const res = await fetch(`${API}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });
            const data = await res.json();
            
            const aiResponse = document.getElementById('aiResponse');
            const aiResponseText = document.getElementById('aiResponseText');
            if (aiResponse && aiResponseText) {
                aiResponseText.textContent = data.text || data.error;
                aiResponse.classList.remove('hidden');
            }
            
            commandInput.value = '';
        } catch (err) {}
    });
}

// Data Fetching
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

async function fetchTabs() {
    try {
        const res = await fetch(`${API}/api/browser`);
        const data = await res.json();
        
        const el = document.getElementById('tabCount');
        if (el) el.textContent = data.length;
        
        if (data.length > 0) {
            const statusBrowser = document.getElementById('statusBrowser');
            if (statusBrowser) statusBrowser.classList.add('active');
        }
        
        const list = document.getElementById('tabsList');
        if (!list) return;
        
        if (data.length === 0) {
            list.innerHTML = '<div class="empty-state"><span class="empty-icon">🔌</span><p>No tabs</p></div>';
        } else {
            list.innerHTML = data.map(t => `
                <div class="data-item">
                    <span class="item-icon">🌐</span>
                    <div class="item-content">
                        <div class="item-title">${escapeHtml(t.title || 'Untitled')}</div>
                        <div class="item-meta">${escapeHtml(truncateUrl(t.url))}</div>
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
            list.innerHTML = '<div class="empty-state"><span class="empty-icon">🔕</span><p>No notifications</p></div>';
        } else {
            list.innerHTML = data.map(n => `
                <div class="data-item">
                    <span class="item-icon">${n.priority === 'urgent' ? '🔴' : '🔔'}</span>
                    <div class="item-content">
                        <div class="item-title">${escapeHtml(n.title)}</div>
                        <div class="item-meta">${n.app_source || 'System'} · ${new Date(n.timestamp).toLocaleTimeString()}</div>
                    </div>
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

// Utilities
function escapeHtml(str) {
    if (!str) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return str.replace(/[&<>"']/g, c => map[c]);
}

function truncateUrl(url) {
    if (!url) return '';
    try {
        const u = new URL(url);
        return u.hostname + (u.pathname.length > 20 ? u.pathname.substring(0, 20) + '…' : u.pathname);
    } catch { return url.substring(0, 30) + '…'; }
}

function formatUptime(seconds) {
    if (!seconds) return '0m';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function pollAllData() {
    fetchReminders();
    fetchTabs();
    fetchNotifications();
    updateUptime();
}

function updateUptime() {
    const diff = Date.now() / 1000 - startTime;
    const el = document.getElementById('statUptime');
    if (el) el.textContent = formatUptime(diff);
}

// Keyboard Shortcuts
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.code === 'Space') {
        e.preventDefault();
        if (dashboardPage.classList.contains('hidden')) {
            showDashboard();
        }
        startVoice();
    }
});

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

// Init
checkHealth();
setInterval(checkHealth, 30000);
setInterval(pollAllData, 5000);
setInterval(updateUptime, 60000);

// Check server status on load
document.getElementById('statusServer')?.classList.add('active');

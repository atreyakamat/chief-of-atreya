async function fetchPending() {
  const res = await fetch('/api/pending-actions');
  const rows = await res.json();
  const container = document.getElementById('list');
    let ADMIN_PW = null;

    function showLogin() {
      const div = document.createElement('div');
      div.innerHTML = `<label>Admin Password: <input type="password" id="adminpw" /></label> <button id="loginBtn">Set</button> <button id="clearBtn">Clear</button>`;
      container.appendChild(div);
      document.getElementById('loginBtn').addEventListener('click', () => { ADMIN_PW = document.getElementById('adminpw').value; fetchPending(); });
      document.getElementById('clearBtn').addEventListener('click', () => { ADMIN_PW = null; fetchPending(); });
    }
    showLogin();
    if (!rows || rows.length === 0) { container.innerHTML += '<p>No pending actions.</p>'; return; }
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>ID</th><th>Type</th><th>Payload</th><th>Status</th><th>When</th><th>Actions</th></tr>';
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  for (const r of rows) {
    const tr = document.createElement('tr');
    const payload = typeof r.payload === 'string' ? r.payload : JSON.stringify(r.payload, null, 2);
    tr.innerHTML = `
      <td>${r.id}</td>
      <td>${r.action_type}</td>
      <td><pre>${payload}</pre></td>
      <td>${r.status}</td>
      <td>${r.created_at}</td>
      <td></td>
    `;
    const actionsTd = tr.querySelector('td:last-child');
    const approveBtn = document.createElement('button'); approveBtn.textContent = 'Approve';
    approveBtn.addEventListener('click', () => approve(r.id));
    const execBtn = document.createElement('button'); execBtn.textContent = 'Execute';
    execBtn.addEventListener('click', () => execute(r.id));
    const rejectBtn = document.createElement('button'); rejectBtn.textContent = 'Reject';
    rejectBtn.addEventListener('click', () => rejectAction(r.id));
    actionsTd.appendChild(approveBtn);
    actionsTd.appendChild(execBtn);
    actionsTd.appendChild(rejectBtn);
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  container.innerHTML = '';
  container.appendChild(table);
}

async function approve(id) {
    await fetch(`/api/pending-actions/${id}/approve`, { method: 'POST', headers: ADMIN_PW ? { 'x-zen-admin': ADMIN_PW } : {} });
  await fetchPending();
}
async function rejectAction(id) {
    await fetch(`/api/pending-actions/${id}/reject`, { method: 'POST', headers: ADMIN_PW ? { 'x-zen-admin': ADMIN_PW } : {} });
  await fetchPending();
}
async function execute(id) {
  if (!confirm('Execute approved action? This may perform system-level changes.')) return;
    const res = await fetch(`/api/pending-actions/${id}/execute`, { method: 'POST', headers: ADMIN_PW ? { 'x-zen-admin': ADMIN_PW } : {} });
  const data = await res.json();
  if (!data.success) {
    alert('Execution failed: ' + (data.error || JSON.stringify(data)));
  } else {
    alert('Execution result: ' + JSON.stringify(data.result || data));
  }
  await fetchPending();
}

fetchPending();
setInterval(fetchPending, 5000);

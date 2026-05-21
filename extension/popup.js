document.getElementById('sendBtn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const status = document.getElementById('status');
  
  status.textContent = "Syncing with Zen...";
  
  try {
    const res = await fetch('http://localhost:3000/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: tab.url,
        title: tab.title
      })
    });
    
    if (res.ok) {
      status.textContent = "✅ Link synchronized.";
    } else {
      status.textContent = "❌ Zen OS unreachable.";
    }
  } catch (e) {
    status.textContent = "❌ Failed to connect.";
  }
});

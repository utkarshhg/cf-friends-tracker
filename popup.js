// CF Friends Tracker — Popup Script

const $ = id => document.getElementById(id);

// ── Show toast message ─────────────────────────────────────
function showMessage(text, type = 'info') {
  const msg = $('message');
  msg.textContent = text;
  msg.className = `popup-message ${type}`;
  msg.style.display = 'block';
  setTimeout(() => { msg.style.display = 'none'; }, 3000);
}

// ── Load saved settings ────────────────────────────────────
async function loadSettings() {
  const data = await chrome.storage.local.get(['cfHandle', 'apiKey', 'apiSecret']);
  if (data.cfHandle) $('cfHandle').value = data.cfHandle;
  if (data.apiKey) $('apiKey').value = data.apiKey;
  if (data.apiSecret) $('apiSecret').value = data.apiSecret;

  // Update status
  if (data.apiKey && data.apiSecret) {
    $('status-dot').classList.add('connected');
    $('status-text').textContent = 'Credentials saved';
  }
}

// ── Save settings ──────────────────────────────────────────
$('settings-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const cfHandle = $('cfHandle').value.trim();
  const apiKey = $('apiKey').value.trim();
  const apiSecret = $('apiSecret').value.trim();

  if (!apiKey || !apiSecret) {
    showMessage('API Key and Secret are required', 'error');
    return;
  }

  await chrome.storage.local.set({ cfHandle, apiKey, apiSecret });
  $('status-dot').classList.add('connected');
  $('status-text').textContent = 'Credentials saved';
  showMessage('Settings saved successfully!', 'success');
});

// ── Test connection ────────────────────────────────────────
$('testBtn').addEventListener('click', async () => {
  $('testBtn').disabled = true;
  $('testBtn').innerHTML = '<span class="btn-icon">⏳</span> Testing...';

  try {
    const response = await chrome.runtime.sendMessage({ type: 'TEST_CONNECTION' });
    if (response.success) {
      $('status-dot').classList.add('connected');
      $('status-text').textContent = `Connected · ${response.friendCount} friends`;
      showMessage(`Connected! Found ${response.friendCount} friends.`, 'success');
    } else {
      $('status-dot').classList.remove('connected');
      $('status-text').textContent = 'Connection failed';
      showMessage(`Error: ${response.error}`, 'error');
    }
  } catch (err) {
    showMessage(`Error: ${err.message}`, 'error');
  }

  $('testBtn').disabled = false;
  $('testBtn').innerHTML = '<span class="btn-icon">🔌</span> Test Connection';
});

// ── Toggle secret visibility ───────────────────────────────
$('toggleSecret').addEventListener('click', () => {
  const input = $('apiSecret');
  input.type = input.type === 'password' ? 'text' : 'password';
});

// ── Clear cache ────────────────────────────────────────────
$('clearCacheBtn').addEventListener('click', async () => {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'CLEAR_CACHE' });
    if (response.success) {
      showMessage('Cache cleared!', 'success');
    }
  } catch (err) {
    showMessage('Failed to clear cache', 'error');
  }
});

// ── Initialize ─────────────────────────────────────────────
loadSettings();

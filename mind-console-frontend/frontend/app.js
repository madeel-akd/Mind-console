// Point this at your deployed Railway backend URL once you have it.
const API_BASE = 'http://localhost:3000/api';

let token = localStorage.getItem('mc_token') || null;

const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');

function showApp() {
  loginScreen.classList.add('hidden');
  appScreen.classList.remove('hidden');
  loadNow();
}

function showLogin() {
  appScreen.classList.add('hidden');
  loginScreen.classList.remove('hidden');
}

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });

  if (res.status === 401) {
    token = null;
    localStorage.removeItem('mc_token');
    showLogin();
    throw new Error('Session expired');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Request failed');
  }

  if (res.status === 204) return null;
  return res.json();
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.textContent = '';
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;

  try {
    const data = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    token = data.token;
    localStorage.setItem('mc_token', token);
    showApp();
  } catch (err) {
    loginError.textContent = err.message;
  }
});

document.getElementById('logout-btn').addEventListener('click', () => {
  token = null;
  localStorage.removeItem('mc_token');
  showLogin();
});

// ---------- Tabs ----------
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`${btn.dataset.tab}-tab`).classList.add('active');
    if (btn.dataset.tab === 'history') loadHistory();
  });
});

// ---------- Capture ----------
const captureForm = document.getElementById('capture-form');
const captureInput = document.getElementById('capture-input');

captureInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    captureForm.requestSubmit();
  }
});

captureForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const content = captureInput.value.trim();
  if (!content) return;

  const priority = document.getElementById('capture-priority').value;
  const deadline = document.getElementById('capture-deadline').value || null;

  await api('/items', {
    method: 'POST',
    body: JSON.stringify({ content, priority, deadline })
  });

  captureInput.value = '';
  document.getElementById('capture-priority').value = 'none';
  document.getElementById('capture-deadline').value = '';
  loadNow();
});

// ---------- Rendering ----------
const template = document.getElementById('item-template');

function formatDeadline(deadline) {
  if (!deadline) return { text: '', overdue: false };
  const d = new Date(deadline);
  const overdue = d < new Date() && d.toDateString() !== new Date().toDateString();
  return { text: d.toDateString(), overdue };
}

function nextStatus(current) {
  if (current === 'active') return 'in_progress';
  if (current === 'in_progress') return 'done';
  return 'active';
}

function advanceLabel(current) {
  if (current === 'active') return 'Start';
  if (current === 'in_progress') return 'Done';
  return 'Reopen';
}

function renderItem(item, container) {
  const node = template.content.cloneNode(true);
  const card = node.querySelector('.item-card');

  card.classList.add(`priority-${item.priority}`, `status-${item.status}`);
  card.dataset.id = item._id;

  node.querySelector('.item-content').textContent = item.content;

  const priorityBadge = node.querySelector('.priority-badge');
  priorityBadge.textContent = item.priority;
  priorityBadge.classList.add(item.priority);

  const { text, overdue } = formatDeadline(item.deadline);
  const deadlineBadge = node.querySelector('.deadline-badge');
  deadlineBadge.textContent = text ? `due ${text}` : '';
  if (overdue) deadlineBadge.classList.add('overdue');

  const notesWrap = node.querySelector('.progress-notes');
  (item.progressNotes || []).forEach((n) => {
    const p = document.createElement('p');
    p.className = 'progress-note';
    p.textContent = n.text;
    notesWrap.appendChild(p);
  });

  const prioritySelect = node.querySelector('.priority-select');
  prioritySelect.value = item.priority;
  prioritySelect.addEventListener('change', async () => {
    await api(`/items/${item._id}`, {
      method: 'PATCH',
      body: JSON.stringify({ priority: prioritySelect.value })
    });
    loadNow();
  });

  const advanceBtn = node.querySelector('.advance-btn');
  advanceBtn.textContent = advanceLabel(item.status);
  advanceBtn.addEventListener('click', async () => {
    await api(`/items/${item._id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: nextStatus(item.status) })
    });
    loadNow();
  });

  const progressToggle = node.querySelector('.progress-toggle-btn');
  const progressForm = node.querySelector('.progress-form');
  progressToggle.addEventListener('click', () => {
    progressForm.classList.toggle('hidden');
    if (!progressForm.classList.contains('hidden')) {
      progressForm.querySelector('.progress-input').focus();
    }
  });

  progressForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = progressForm.querySelector('.progress-input');
    if (!input.value.trim()) return;
    await api(`/items/${item._id}/progress`, {
      method: 'POST',
      body: JSON.stringify({ text: input.value.trim() })
    });
    loadNow();
  });

  const deleteBtn = node.querySelector('.delete-btn');
  deleteBtn.addEventListener('click', async () => {
    card.classList.add('removing');
    setTimeout(async () => {
      await api(`/items/${item._id}`, { method: 'DELETE' });
      loadNow();
      loadHistory();
    }, 180);
  });

  container.appendChild(node);
}

async function loadNow() {
  const items = await api('/items');
  const list = document.getElementById('now-list');
  const empty = document.getElementById('now-empty');
  list.innerHTML = '';
  empty.classList.toggle('hidden', items.length > 0);
  items.forEach((item) => renderItem(item, list));
}

async function loadHistory() {
  const items = await api('/items/history');
  const list = document.getElementById('history-list');
  const empty = document.getElementById('history-empty');
  list.innerHTML = '';
  empty.classList.toggle('hidden', items.length > 0);
  items.forEach((item) => renderItem(item, list));
}

// ---------- AI Summary ----------
document.getElementById('summary-btn').addEventListener('click', async () => {
  const btn = document.getElementById('summary-btn');
  const output = document.getElementById('summary-output');
  btn.disabled = true;
  output.classList.add('loading');
  output.textContent = 'Reading through everything...';

  try {
    const data = await api('/summary', { method: 'POST' });
    output.classList.remove('loading');
    output.textContent = data.summary;
  } catch (err) {
    output.classList.remove('loading');
    output.textContent = `Couldn't get a summary: ${err.message}`;
  } finally {
    btn.disabled = false;
  }
});

// ---------- Boot ----------
if (token) {
  showApp();
} else {
  showLogin();
}

// ============================
// admin.js — FINAL STABLE VERSION
// ============================

const API = '';

// ============================
// 🔐 AUTH
// ============================

function getAdminToken() {
  return localStorage.getItem('adminToken') || '';
}

// Validate token with backend
async function validateToken(token) {
  try {
    const res = await fetch('/queue', {
      headers: { 'x-admin-token': token }
    });
    return res.status !== 401;
  } catch {
    return false;
  }
}

// Block page completely
function blockAccess() {
  document.body.innerHTML = `
    <div style="text-align:center; margin-top:120px;">
      <h1 style="color:red;">🚫 Access Denied</h1>
      <p>Wrong admin password</p>
    </div>
  `;
}

// MAIN LOGIN FLOW
async function checkAdminLogin() {
  let token = getAdminToken();

  // If token exists → verify
  if (token) {
    const valid = await validateToken(token);
    if (valid) return true;

    // remove invalid token
    localStorage.removeItem('adminToken');
  }

  // Ask password
  const entered = prompt('🔐 Enter Admin Password:');

  if (!entered) {
    blockAccess();
    return false;
  }

  const valid = await validateToken(entered);

  if (!valid) {
    alert('❌ Wrong Password!');
    blockAccess();
    return false;
  }

  // Save correct password
  localStorage.setItem('adminToken', entered);
  return true;
}

// ============================
// 🔐 FETCH HELPER
// ============================

async function adminFetch(path, options = {}) {
  return fetch(API + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': getAdminToken(),
      ...(options.headers || {}),
    },
  });
}

// ============================
// 🔔 UI HELPERS
// ============================

function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = `toast show ${type}`;
  setTimeout(() => { t.className = 'toast'; }, 3000);
}

// ============================
// 📊 QUEUE
// ============================

async function loadAdminQueue() {
  const res = await adminFetch('/queue');

  if (res.status === 401) return blockAccess();

  const data = await res.json();
  const list = document.getElementById('adminQueueList');

  if (!data.queue || data.queue.length === 0) {
    document.getElementById('statTotal').textContent = 0;
    list.innerHTML = '<div class="empty-state">✅ Queue is clear!</div>';
    document.getElementById('nowServing').style.display = 'none';
    updateAIInsights(0);
    return;
  }

  document.getElementById('statTotal').textContent = data.queue.length;

  list.innerHTML = data.queue.map((user, i) => {
    const joinedAt = new Date(user.joinedAt);
    const waitMins = Math.floor((Date.now() - joinedAt) / 60000);

    return `
      <div class="admin-queue-item">
        <div class="aqi-pos">${i + 1}</div>
        <div>
          <div class="aqi-name">${user.name}</div>
          <div class="aqi-meta">📱 ${user.phone} · Waited ${waitMins}m</div>
        </div>
        <span class="aqi-badge">${serviceLabel(user.service)}</span>
      </div>
    `;
  }).join('');

  updateStats(data.queue);
  updateAIInsights(data.queue.length);
}

// ============================
// 📈 ANALYTICS
// ============================

async function loadAnalytics() {
  const res = await adminFetch('/analytics');

  if (res.status === 401) return blockAccess();

  const data = await res.json();

  document.getElementById('statServed').textContent = data.todayCount ?? 0;

  if (data.avgServiceMins != null) {
    window._realAvgMins = data.avgServiceMins;
  }

  if (data.hourly) {
    drawChart(data.hourly);
  }
}

// ============================
// ▶️ ACTIONS
// ============================

async function callNext() {
  const res = await adminFetch('/queue/next', { method: 'POST' });

  if (res.status === 401) return blockAccess();

  const data = await res.json();

  if (data.user) {
    document.getElementById('nowServing').style.display = 'block';
    document.getElementById('nsName').textContent = data.user.name;
    document.getElementById('nsToken').textContent =
      `Token #${data.user.token} · ${serviceLabel(data.user.service)}`;

    showToast(`📢 Calling: ${data.user.name}`, 'success');

    setTimeout(() => {
      loadAdminQueue();
      loadAnalytics();
    }, 400);

  } else {
    showToast('Queue is empty!', 'error');
  }
}

async function clearQueue() {
  if (!confirm('Clear the entire queue?')) return;

  const res = await adminFetch('/queue/clear', { method: 'POST' });

  if (res.status === 401) return blockAccess();

  document.getElementById('nowServing').style.display = 'none';
  showToast('🗑 Queue cleared.');

  loadAdminQueue();
}

// ============================
// 📷 QR
// ============================

function generateQR() {
  const url = encodeURIComponent(window.location.origin + '/');
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${url}`;

  document.getElementById('qrDisplay').innerHTML =
    `<img src="${qrUrl}" width="120">`;
}

// ============================
// 📊 STATS + AI
// ============================

function updateStats(queue) {
  const totalWait = queue.reduce((sum, u) =>
    sum + Math.floor((Date.now() - new Date(u.joinedAt)) / 60000), 0);

  const avg = queue.length ? Math.floor(totalWait / queue.length) : 0;
  document.getElementById('statAvg').textContent = `${avg}m`;
}

function updateAIInsights(queueLen) {
  const container = document.getElementById('aiInsights');
  if (!container) return;

  container.innerHTML = `<div class="ai-item">
    ${queueLen === 0 ? '✅ No users in queue' : `📊 ${queueLen} users waiting`}
  </div>`;
}

// ============================
// 📊 CHART
// ============================

function drawChart(hourly) {
  const canvas = document.getElementById('activityChart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// ============================
// 🔧 HELPERS
// ============================

function serviceLabel(s) {
  return {
    general: 'General',
    consultation: 'Consult',
    billing: 'Billing',
    emergency: 'Emergency'
  }[s] || s;
}

// ============================
// 🚀 INIT (FINAL FIX)
// ============================

window.addEventListener('load', async () => {

  // 🔥 Hide UI completely before auth
  document.body.style.display = 'none';

  const ok = await checkAdminLogin();

  if (!ok) return;

  // ✅ Show UI only after correct login
  document.body.style.display = 'block';

  loadAdminQueue();
  loadAnalytics();

  setInterval(() => {
    loadAdminQueue();
    loadAnalytics();
  }, 5000);
});

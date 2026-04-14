// ============================
// admin.js — QuickQ Admin (FINAL FIXED)
// ============================

const API = '';

// ============================
// 🔐 AUTH SECTION
// ============================

function getAdminToken() {
  return localStorage.getItem('adminToken') || '';
}

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

// ✅ Proper login check (NO UI LOAD BEFORE AUTH)
async function checkAdminLogin() {
  let token = getAdminToken();

  // If no token → ask password
  if (!token) {
    const entered = prompt('Enter admin password:');

    if (!entered) {
      blockAccess();
      return false;
    }

    try {
      const res = await fetch('/queue', {
        headers: { 'x-admin-token': entered }
      });

      if (res.status === 401) {
        alert('❌ Wrong password!');
        blockAccess();
        return false;
      }

      localStorage.setItem('adminToken', entered);
      return true;

    } catch (err) {
      blockAccess();
      return false;
    }
  }

  // If token exists → verify it
  try {
    const res = await fetch('/queue', {
      headers: { 'x-admin-token': token }
    });

    if (res.status === 401) {
      localStorage.removeItem('adminToken');
      return checkAdminLogin(); // ask again
    }

    return true;

  } catch (err) {
    blockAccess();
    return false;
  }
}

// ❌ Block UI completely
function blockAccess() {
  document.body.innerHTML = `
    <div style="text-align:center; margin-top:100px;">
      <h1 style="color:red;">🚫 Access Denied</h1>
      <p>You are not authorized to view this page.</p>
    </div>
  `;
}

// Logout
function logout() {
  localStorage.removeItem('adminToken');
  location.reload();
}

// ============================
// 🔔 UI HELPERS
// ============================

function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = `toast show ${type}`;
  setTimeout(() => { t.className = 'toast'; }, 3500);
}

// ============================
// 📊 QUEUE FUNCTIONS
// ============================

async function loadAdminQueue() {
  try {
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
      const isPriority = user.service === 'emergency';
      const joinedAt = new Date(user.joinedAt);
      const waitMins = Math.floor((Date.now() - joinedAt) / 60000);

      return `
        <div class="admin-queue-item ${isPriority ? 'priority-item' : ''}">
          <div class="aqi-pos">${i + 1}</div>
          <div>
            <div class="aqi-name">${user.name}</div>
            <div class="aqi-meta">📱 ${user.phone} · Waited ${waitMins}m</div>
          </div>
          <span class="aqi-badge badge-${user.service}">
            ${serviceLabel(user.service)}
          </span>
        </div>
      `;
    }).join('');

    updateStats(data.queue);
    updateAIInsights(data.queue.length);

  } catch (err) {
    showToast('❌ Error loading queue', 'error');
  }
}

// ============================
// 📈 ANALYTICS
// ============================

async function loadAnalytics() {
  try {
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

  } catch (err) {}
}

// ============================
// ▶️ ACTIONS
// ============================

async function callNext() {
  try {
    const res = await adminFetch('/queue/next', { method: 'POST' });
    const data = await res.json();

    if (res.status === 401) return blockAccess();

    if (res.ok && data.user) {
      const banner = document.getElementById('nowServing');
      banner.style.display = 'block';

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

  } catch (err) {
    showToast('❌ Server not reachable.', 'error');
  }
}

async function clearQueue() {
  if (!confirm('Clear the entire queue?')) return;

  try {
    const res = await adminFetch('/queue/clear', { method: 'POST' });

    if (res.status === 401) return blockAccess();

    document.getElementById('nowServing').style.display = 'none';
    showToast('🗑 Queue cleared.');

    loadAdminQueue();

  } catch (err) {
    showToast('❌ Server error', 'error');
  }
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

  let msg = queueLen === 0
    ? '✅ No users in queue'
    : `📊 ${queueLen} users waiting`;

  container.innerHTML = `<div class="ai-item">${msg}</div>`;
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
// 🚀 INIT (CRITICAL FIX)
// ============================

window.addEventListener('load', async () => {

  // Hide UI first
  document.body.style.display = 'none';

  const ok = await checkAdminLogin();

  if (!ok) return; // STOP if not authorized

  // Show UI only after success
  document.body.style.display = 'block';

  loadAdminQueue();
  loadAnalytics();

  setInterval(() => {
    loadAdminQueue();
    loadAnalytics();
  }, 5000);
});

// ============================
// admin.js — QuickQ Admin
// ============================

const API = '';  // Relative URLs — works on localhost AND after deployment

// Read admin token from localStorage (set once on login)
function getAdminToken() {
  return localStorage.getItem('adminToken') || '';
}

// Admin fetch helper — attaches auth header automatically
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

// ---- Simple Admin Login ----
async function checkAdminLogin() {
  let token = localStorage.getItem('adminToken');

  if (!token) {
    const entered = prompt('Enter admin password:');
    if (!entered) {
      document.body.innerHTML = '<h2 style="text-align:center;color:red;">Access Denied</h2>';
      return;
    }

    // Test password with backend
    const res = await fetch('/queue', {
      headers: {
        'x-admin-token': entered
      }
    });

    if (res.status === 401) {
      alert('❌ Wrong password!');
      document.body.innerHTML = '<h2 style="text-align:center;color:red;">Access Denied</h2>';
      return;
    }

    // Save only if correct
    localStorage.setItem('adminToken', entered);
  }
}

// ---- Toast Notification ----
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast show ${type}`;
  setTimeout(() => { t.className = 'toast'; }, 3500);
}

// ---- Load Admin Queue ----
async function loadAdminQueue() {
  try {
    const res  = await fetch(`${API}/queue`);
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
      const joinedAt   = new Date(user.joinedAt);
      const waitMins   = Math.floor((Date.now() - joinedAt) / 60000);
      return `
        <div class="admin-queue-item ${isPriority ? 'priority-item' : ''}">
          <div class="aqi-pos">${i + 1}</div>
          <div>
            <div class="aqi-name">${user.name}</div>
            <div class="aqi-meta">📱 ${user.phone} · Waited ${waitMins}m</div>
          </div>
          <span class="aqi-badge badge-${user.service}">${serviceLabel(user.service)}</span>
        </div>
      `;
    }).join('');

    updateStats(data.queue);
    updateAIInsights(data.queue.length);
  } catch (_) {}
}

// ---- Load Analytics (served count + chart) ----
async function loadAnalytics() {
  try {
    const res  = await fetch(`${API}/analytics`);
    const data = await res.json();

    document.getElementById('statServed').textContent = data.todayCount ?? 0;

    if (data.avgServiceMins != null) {
      // Update AI insight with real avg
      window._realAvgMins = data.avgServiceMins;
    }

    if (data.hourly) {
      drawChart(data.hourly);
    }
  } catch (_) {}
}

// ---- Call Next ----
async function callNext() {
  try {
    const res  = await adminFetch('/queue/next', { method: 'POST' });
    const data = await res.json();

    if (res.status === 401) {
      showToast('❌ Wrong admin password. Reload to re-enter.', 'error');
      localStorage.removeItem('adminToken');
      return;
    }

    if (res.ok && data.user) {
      const banner = document.getElementById('nowServing');
      banner.style.display = 'block';
      document.getElementById('nsName').textContent  = data.user.name;
      document.getElementById('nsToken').textContent = `Token #${data.user.token} · ${serviceLabel(data.user.service)}`;

      showToast(`📢 Calling: ${data.user.name}`, 'success');
      setTimeout(() => { loadAdminQueue(); loadAnalytics(); }, 400);
    } else {
      showToast('Queue is empty!', 'error');
    }
  } catch (_) {
    showToast('❌ Server not reachable.', 'error');
  }
}

// ---- Clear Queue ----
async function clearQueue() {
  if (!confirm('Clear the entire queue? This cannot be undone.')) return;
  try {
    const res = await adminFetch('/queue/clear', { method: 'POST' });
    if (res.status === 401) {
      showToast('❌ Wrong admin password. Reload to re-enter.', 'error');
      localStorage.removeItem('adminToken');
      return;
    }
    document.getElementById('nowServing').style.display = 'none';
    showToast('🗑 Queue cleared.', '');
    loadAdminQueue();
  } catch (_) {
    showToast('❌ Server not reachable.', 'error');
  }
}

// ---- Generate QR Code ----
function generateQR() {
  const url   = encodeURIComponent(window.location.origin + '/');
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${url}&bgcolor=0d1426&color=00d4ff&margin=10`;
  document.getElementById('qrDisplay').innerHTML = `<img src="${qrUrl}" width="120" height="120" alt="QR Code" />`;
  showToast('📷 QR Code generated!', 'success');
}

// ---- Update Stats ----
function updateStats(queue) {
  const totalWait = queue.reduce((sum, u) => {
    return sum + Math.floor((Date.now() - new Date(u.joinedAt)) / 60000);
  }, 0);
  const avg = queue.length ? Math.floor(totalWait / queue.length) : 0;
  document.getElementById('statAvg').textContent = `${avg}m`;
}

// ---- AI Insights ----
function updateAIInsights(queueLen) {
  const hour   = new Date().getHours();
  const isPeak = (hour >= 10 && hour <= 12) || (hour >= 17 && hour <= 19);
  const insights = [];

  if (queueLen === 0) {
    insights.push('✅ No users in queue. Ready for next customer.');
  } else if (queueLen >= 10) {
    insights.push(`🚨 High load: ${queueLen} users waiting. Consider opening another counter.`);
  } else {
    insights.push(`📊 Queue at normal load: ${queueLen} users.`);
  }

  if (isPeak) {
    insights.push('⏰ Currently peak hours (10–12 AM or 5–7 PM). Expect more joins soon.');
  } else {
    const nextPeak = hour < 10 ? '10 AM' : hour < 17 ? '5 PM' : 'tomorrow 10 AM';
    insights.push(`📅 Next peak expected around ${nextPeak}.`);
  }

  // Use real avg if available, otherwise omit random guess
  if (window._realAvgMins != null) {
    insights.push(`🤖 Real avg service time today: ~${window._realAvgMins} mins/person`);
  }

  const container = document.getElementById('aiInsights');
  container.innerHTML = insights.map(msg => `
    <div class="ai-item">
      <span class="ai-dot"></span>
      <span>${msg}</span>
    </div>
  `).join('');

  const peakHour = isPeak ? 'NOW' : (hour < 10 ? '10 AM' : hour < 17 ? '5 PM' : '10 AM');
  document.getElementById('statPeak').textContent = peakHour;
}

// ---- Draw Chart (real data from /analytics) ----
function drawChart(hourly) {
  const canvas = document.getElementById('activityChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // Show 8 AM – 8 PM
  const slots  = [8,10,12,14,16,18,20];
  const labels = ['8AM','10AM','12PM','2PM','4PM','6PM','8PM'];
  const values = slots.map(h => (hourly[h] || 0) + (hourly[h+1] || 0)); // 2-hr buckets
  const max    = Math.max(...values, 1);

  const w     = canvas.width;
  const h     = canvas.height;
  const barW  = Math.floor(w / labels.length) - 8;
  const padB  = 30;
  const padT  = 10;
  const chartH = h - padB - padT;

  ctx.clearRect(0, 0, w, h);

  labels.forEach((label, i) => {
    const x    = i * (barW + 8) + 4;
    const barH = (values[i] / max) * chartH;
    const y    = padT + chartH - barH;

    const grad = ctx.createLinearGradient(0, y, 0, y + barH);
    grad.addColorStop(0, 'rgba(0,212,255,0.8)');
    grad.addColorStop(1, 'rgba(0,212,255,0.2)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, y, barW, barH, 4);
    ctx.fill();

    ctx.fillStyle = '#64748b';
    ctx.font = '10px DM Sans';
    ctx.textAlign = 'center';
    ctx.fillText(label, x + barW / 2, h - 6);

    if (values[i] > 0) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 10px JetBrains Mono';
      ctx.fillText(values[i], x + barW / 2, y - 4);
    }
  });
}

// ---- Helpers ----
function serviceLabel(s) {
  const map = {
    general:      'General',
    consultation: 'Consult',
    billing:      'Billing',
    emergency:    'Emergency'
  };
  return map[s] || s;
}

// ---- Init ----
window.addEventListener('load', () => {
  checkAdminLogin();
  loadAdminQueue();
  loadAnalytics();
  drawChart(Array(24).fill(0)); // placeholder until analytics loads
});

setInterval(() => {
  loadAdminQueue();
  loadAnalytics();
}, 5000);

// ============================
// script.js — QuickQ Frontend
// ============================

const API = 'http://localhost:3000';

// ---- Toast Notification ----
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast show ${type}`;
  setTimeout(() => { t.className = 'toast'; }, 3500);
}

// ---- AI Waiting Time Prediction ----
function predictWait(position, avgTime = 5) {
  // Simple linear regression model: wait = position × avgServiceMinutes
  const base = position * avgTime;
  const variation = Math.floor(Math.random() * 3) - 1; // ±1 min variation
  return Math.max(1, base + variation);
}

// ---- AI Message Generator ----
function getAIInsight(position, waitMins) {
  const hour = new Date().getHours();
  const isPeak = (hour >= 10 && hour <= 12) || (hour >= 17 && hour <= 19);

  if (position === 1) return "🎉 You're next! Please approach the counter.";
  if (position <= 3) return `⚡ Almost your turn! Be ready in ~${waitMins} mins.`;
  if (isPeak) return `📊 Peak hours now. Expect slight delays. Est. ${waitMins} mins.`;
  return `🤖 Based on current speed, your wait is ~${waitMins} mins.`;
}

// ---- Join Queue ----
async function joinQueue() {
  const name = document.getElementById('userName').value.trim();
  const phone = document.getElementById('userPhone').value.trim();
  const service = document.getElementById('serviceType').value;

  if (!name || !phone) {
    showToast('⚠️ Please fill in your name and phone.', 'error');
    return;
  }

  if (!/^\+?\d{7,13}$/.test(phone.replace(/\s/g, ''))) {
    showToast('⚠️ Enter a valid mobile number.', 'error');
    return;
  }

  const btn = document.querySelector('.btn-primary');
  btn.innerHTML = '<span>Joining...</span>';
  btn.disabled = true;

  try {
    const res = await fetch(`${API}/queue/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, service })
    });

    const data = await res.json();

    if (res.ok) {
      localStorage.setItem('queueToken', data.token);
      localStorage.setItem('queuePhone', phone);
      showStatusCard(data);
      showToast('✅ You joined the queue!', 'success');
      loadQueueBoard();
    } else {
      showToast(data.error || 'Failed to join queue.', 'error');
    }
  } catch (err) {
    showToast('❌ Cannot connect to server. Is it running?', 'error');
  }

  btn.innerHTML = '<span>Join Queue Now</span><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
  btn.disabled = false;
}

// ---- Show Status Card ----
function showStatusCard(data) {
  const card = document.getElementById('statusCard');
  card.style.display = 'flex';

  document.getElementById('positionNumber').textContent = data.position;
  document.getElementById('totalQueue').textContent = data.total;
  document.getElementById('tokenNum').textContent = `#${data.token}`;

  const wait = predictWait(data.position);
  document.getElementById('waitTime').textContent = `${wait}m`;
  document.getElementById('aiMessage').textContent = getAIInsight(data.position, wait);
}

// ---- Leave Queue ----
async function leaveQueue() {
  const token = localStorage.getItem('queueToken');
  if (!token) return;

  try {
    await fetch(`${API}/queue/leave`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
  } catch (_) {}

  localStorage.removeItem('queueToken');
  localStorage.removeItem('queuePhone');
  document.getElementById('statusCard').style.display = 'none';
  showToast('You left the queue.', '');
  loadQueueBoard();
}

// ---- Load Queue Board ----
async function loadQueueBoard() {
  const board = document.getElementById('queueBoard');
  try {
    const res = await fetch(`${API}/queue`);
    const data = await res.json();
    const myToken = localStorage.getItem('queueToken');

    if (!data.queue || data.queue.length === 0) {
      board.innerHTML = '<div class="empty-state">🎉 Queue is empty!</div>';
      return;
    }

    board.innerHTML = data.queue.map((user, i) => {
      const isMe = user.token === myToken;
      const isPriority = user.service === 'emergency';
      let cls = isMe ? 'current' : '';
      if (isPriority) cls = 'priority';

      return `
        <div class="queue-item ${cls}">
          <span class="queue-pos">${i + 1}</span>
          <span class="queue-name">${isMe ? '⭐ You' : maskName(user.name)}</span>
          <span class="queue-service">${serviceLabel(user.service)}</span>
        </div>
      `;
    }).join('');
  } catch (_) {
    board.innerHTML = '<div class="empty-state">⚠️ Server offline</div>';
  }
}

// ---- Helpers ----
function maskName(name) {
  if (!name || name.length <= 2) return name;
  return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1];
}

function serviceLabel(s) {
  const map = { general: '⚪ General', consultation: '🔵 Consult', billing: '🟣 Billing', emergency: '🔴 Emergency' };
  return map[s] || s;
}

// ---- Auto-refresh & restore ----
window.addEventListener('load', () => {
  loadQueueBoard();

  // Restore status card if rejoining
  const token = localStorage.getItem('queueToken');
  if (token) {
    fetch(`${API}/queue/status/${token}`)
      .then(r => r.json())
      .then(data => { if (data && data.position) showStatusCard(data); })
      .catch(() => {});
  }
});

// Auto-refresh every 8 seconds
setInterval(async () => {
  loadQueueBoard();

  const token = localStorage.getItem('queueToken');
  if (!token) return;

  try {
    const res = await fetch(`${API}/queue/status/${token}`);
    const data = await res.json();
    if (data && data.position) {
      showStatusCard(data);
      if (data.position === 1) {
        showToast('🔔 You are NEXT! Please approach the counter.', 'success');
      } else if (data.position <= 3) {
        showToast(`⏰ Only ${data.position - 1} person(s) ahead of you!`, '');
      }
    } else {
      // Removed from queue
      if (document.getElementById('statusCard').style.display !== 'none') {
        localStorage.removeItem('queueToken');
        document.getElementById('statusCard').style.display = 'none';
        showToast('✅ You were served! Thank you.', 'success');
      }
    }
  } catch (_) {}
}, 8000);

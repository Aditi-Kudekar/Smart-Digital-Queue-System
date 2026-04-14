<script>
(async function () {

  async function validate(password) {
    try {
      const res = await fetch('/queue', {
        headers: { 'x-admin-token': password }
      });
      return res.status !== 401;
    } catch {
      return false;
    }
  }

  let token = localStorage.getItem('adminToken');

  if (!token) {
    const entered = prompt('🔐 Enter Admin Password:');

    if (!entered) {
      document.body.innerHTML = '<h1 style="text-align:center;margin-top:100px;color:red;">🚫 Access Denied</h1>';
      return;
    }

    const ok = await validate(entered);

    if (!ok) {
      alert('❌ Wrong Password!');
      document.body.innerHTML = '<h1 style="text-align:center;margin-top:100px;color:red;">🚫 Access Denied</h1>';
      return;
    }

    localStorage.setItem('adminToken', entered);
  }

})();
</script>

// ============================
// admin.js — CLEAN VERSION
// ============================

const API = '';

// Load app after login success
function loadApp() {
  loadAdminQueue();

  setInterval(() => {
    loadAdminQueue();
  }, 5000);
}

// Fetch helper
async function adminFetch(path, options = {}) {
  return fetch(API + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': localStorage.getItem('adminToken') || '',
      ...(options.headers || {}),
    },
  });
}

// Load queue
async function loadAdminQueue() {
  try {
    const res = await adminFetch('/queue');
    const data = await res.json();

    const list = document.getElementById('adminQueueList');

    if (!data.queue || data.queue.length === 0) {
      list.innerHTML = '<p>No users in queue</p>';
      return;
    }

    list.innerHTML = data.queue.map((user, i) => `
      <div>
        ${i + 1}. ${user.name} (${user.phone})
      </div>
    `).join('');

  } catch (err) {
    console.log(err);
  }
}

// Call next
async function callNext() {
  await adminFetch('/queue/next', { method: 'POST' });
  loadAdminQueue();
}

// Clear queue
async function clearQueue() {
  await adminFetch('/queue/clear', { method: 'POST' });
  loadAdminQueue();
}

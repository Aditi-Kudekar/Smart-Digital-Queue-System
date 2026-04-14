// ============================
// server.js — QuickQ Backend
// ============================

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const crypto = require('crypto');

const app = express();

// ============================
// 1. MIDDLEWARE
// ============================
const allowedOrigin = process.env.FRONTEND_ORIGIN || '*';
app.use(cors({ origin: allowedOrigin }));
app.use(express.json());
app.use(express.static('.'));  // Serve frontend files

// ============================
// 2. MONGODB CONNECTION
// ============================
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('❌ MONGO_URI not set in .env file');
  process.exit(1);
}

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  });

// ============================
// 3. SCHEMA & MODEL
// ============================
const queueSchema = new mongoose.Schema({
  token:    { type: String, required: true, unique: true },
  name:     { type: String, required: true, maxlength: 80 },
  phone:    { type: String, required: true, maxlength: 20 },
  service:  { type: String, default: 'general', enum: ['general', 'consultation', 'billing', 'emergency'] },
  status:   { type: String, default: 'waiting' }, // waiting | done
  joinedAt: { type: Date, default: Date.now },
  servedAt: { type: Date },
});

const servedSchema = new mongoose.Schema({
  name:       String,
  phone:      String,
  service:    String,
  token:      String,
  joinedAt:   Date,
  servedAt:   { type: Date, default: Date.now },
});

const Queue  = mongoose.model('Queue', queueSchema);
const Served = mongoose.model('Served', servedSchema);

// ============================
// 4. ADMIN AUTH MIDDLEWARE
// ============================
function adminAuth(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ============================
// 5. ROUTES
// ============================

// GET /queue — fetch all waiting users
app.get('/queue', async (req, res) => {
  try {
    const queue = await Queue.find({ status: 'waiting' }).sort({ joinedAt: 1 });
    res.json({ queue });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /queue/join — user joins queue
app.post('/queue/join', async (req, res) => {
  let { name, phone, service } = req.body;

  if (!name || !phone) return res.status(400).json({ error: 'Name and phone required.' });

  // Sanitize
  name  = String(name).trim().slice(0, 80);
  phone = String(phone).trim().replace(/\s/g, '').slice(0, 20);
  service = ['general','consultation','billing','emergency'].includes(service) ? service : 'general';

  // Prevent duplicate join
  const existing = await Queue.findOne({ phone, status: 'waiting' });
  if (existing) {
    const position = await Queue.countDocuments({ status: 'waiting', joinedAt: { $lte: existing.joinedAt } });
    const total    = await Queue.countDocuments({ status: 'waiting' });
    return res.json({ token: existing.token, position, total, message: 'Already in queue' });
  }

  const token    = crypto.randomBytes(3).toString('hex').toUpperCase();
  const joinedAt = service === 'emergency' ? new Date(Date.now() - 9999999) : new Date();

  const user = new Queue({ token, name, phone, service, joinedAt });
  await user.save();

  const total    = await Queue.countDocuments({ status: 'waiting' });
  const position = await Queue.countDocuments({ status: 'waiting', joinedAt: { $lte: joinedAt } });

  res.json({ token, position, total });
});

// GET /queue/status/:token — get user's current position
app.get('/queue/status/:token', async (req, res) => {
  try {
    const user = await Queue.findOne({ token: req.params.token, status: 'waiting' });
    if (!user) return res.json({ removed: true });

    const position = await Queue.countDocuments({ status: 'waiting', joinedAt: { $lte: user.joinedAt } });
    const total    = await Queue.countDocuments({ status: 'waiting' });

    res.json({ token: user.token, position, total, name: user.name, service: user.service });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /queue/next — admin calls next user (protected)
app.post('/queue/next', adminAuth, async (req, res) => {
  try {
    const next = await Queue.findOne({ status: 'waiting' }).sort({ joinedAt: 1 });
    if (!next) return res.status(404).json({ error: 'Queue is empty' });

    next.status   = 'done';
    next.servedAt = new Date();
    await next.save();

    await Served.create({
      name:     next.name,
      phone:    next.phone,
      service:  next.service,
      token:    next.token,
      joinedAt: next.joinedAt,
      servedAt: next.servedAt,
    });

    res.json({ user: next });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /queue/leave — user leaves queue
app.post('/queue/leave', async (req, res) => {
  const { token } = req.body;
  try {
    await Queue.deleteOne({ token, status: 'waiting' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /queue/clear — admin clears all (protected)
app.post('/queue/clear', adminAuth, async (req, res) => {
  try {
    await Queue.deleteMany({ status: 'waiting' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /analytics — served history, stats, and hourly breakdown
app.get('/analytics', async (req, res) => {
  try {
    const total      = await Served.countDocuments();
    const today      = new Date(); today.setHours(0, 0, 0, 0);
    const todayCount = await Served.countDocuments({ servedAt: { $gte: today } });
    const recent     = await Served.find().sort({ servedAt: -1 }).limit(20);

    // Real avg service time (ms → minutes)
    const timed = await Served.find({ joinedAt: { $exists: true }, servedAt: { $exists: true } }).lean();
    const avgServiceMins = timed.length
      ? Math.round(timed.reduce((s, u) => s + (u.servedAt - u.joinedAt), 0) / timed.length / 60000)
      : null;

    // Hourly breakdown for today
    const hourly = Array(24).fill(0);
    recent.forEach(u => {
      if (u.servedAt >= today) hourly[new Date(u.servedAt).getHours()]++;
    });

    res.json({ total, todayCount, recent, avgServiceMins, hourly });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================
// 6. START SERVER
// ============================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 QuickQ Server running at http://localhost:${PORT}`);
  console.log(`📱 User Page:  http://localhost:${PORT}/index.html`);
  console.log(`🔧 Admin Page: http://localhost:${PORT}/admin.html\n`);
});

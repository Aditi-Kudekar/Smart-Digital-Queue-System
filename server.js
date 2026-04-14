// ============================
// server.js — QuickQ Backend (UPDATED)
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
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || '*',
  methods: ['GET', 'POST'],
}));

app.use(express.json());

// ✅ Serve frontend from "public" folder
app.use(express.static('public'));

// ============================
// 2. MONGODB CONNECTION
// ============================
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('❌ MONGO_URI not set in .env');
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
  token: { type: String, required: true, unique: true },
  name: { type: String, required: true, maxlength: 80 },
  phone: { type: String, required: true, maxlength: 20 },
  service: { type: String, default: 'general', enum: ['general', 'consultation', 'billing', 'emergency'] },
  status: { type: String, default: 'waiting' },
  joinedAt: { type: Date, default: Date.now },
  servedAt: { type: Date },
});

const servedSchema = new mongoose.Schema({
  name: String,
  phone: String,
  service: String,
  token: String,
  joinedAt: Date,
  servedAt: { type: Date, default: Date.now },
});

const Queue = mongoose.model('Queue', queueSchema);
const Served = mongoose.model('Served', servedSchema);

// ============================
// 4. ADMIN AUTH
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

app.get('/queue', async (req, res) => {
  const queue = await Queue.find({ status: 'waiting' }).sort({ joinedAt: 1 });
  res.json({ queue });
});

app.post('/queue/join', async (req, res) => {
  let { name, phone, service } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ error: 'Name and phone required.' });
  }

  name = name.trim().slice(0, 80);
  phone = phone.replace(/\s/g, '').slice(0, 20);

  const existing = await Queue.findOne({ phone, status: 'waiting' });

  if (existing) {
    const position = await Queue.countDocuments({
      status: 'waiting',
      joinedAt: { $lte: existing.joinedAt },
    });

    const total = await Queue.countDocuments({ status: 'waiting' });

    return res.json({ token: existing.token, position, total });
  }

  // ✅ Improved token
  const token = crypto.randomBytes(4).toString('hex').toUpperCase();

  const joinedAt = service === 'emergency'
    ? new Date(Date.now() - 9999999)
    : new Date();

  const user = new Queue({ token, name, phone, service, joinedAt });
  await user.save();

  const total = await Queue.countDocuments({ status: 'waiting' });
  const position = await Queue.countDocuments({
    status: 'waiting',
    joinedAt: { $lte: joinedAt },
  });

  res.json({ token, position, total });
});

app.get('/queue/status/:token', async (req, res) => {
  const user = await Queue.findOne({ token: req.params.token, status: 'waiting' });

  if (!user) return res.json({ removed: true });

  const position = await Queue.countDocuments({
    status: 'waiting',
    joinedAt: { $lte: user.joinedAt },
  });

  const total = await Queue.countDocuments({ status: 'waiting' });

  res.json({ token: user.token, position, total });
});

app.post('/queue/next', adminAuth, async (req, res) => {
  const next = await Queue.findOne({ status: 'waiting' }).sort({ joinedAt: 1 });

  if (!next) return res.status(404).json({ error: 'Queue empty' });

  next.status = 'done';
  next.servedAt = new Date();
  await next.save();

  await Served.create(next);

  res.json({ user: next });
});

app.post('/queue/leave', async (req, res) => {
  await Queue.deleteOne({ token: req.body.token, status: 'waiting' });
  res.json({ success: true });
});

app.post('/queue/clear', adminAuth, async (req, res) => {
  await Queue.deleteMany({ status: 'waiting' });
  res.json({ success: true });
});

app.get('/analytics', async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayCount = await Served.countDocuments({ servedAt: { $gte: today } });

  res.json({ todayCount });
});

// ============================
// 6. START SERVER
// ============================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

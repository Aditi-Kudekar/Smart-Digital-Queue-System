// ============================
// server.js — QuickQ Backend (FIXED)
// ============================

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const crypto = require('crypto');

const app = express();

// MIDDLEWARE
// ============================
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || '*',
  methods: ['GET', 'POST'],
}));

app.use(express.json());
app.use(express.static('public'));

// ============================
// MONGODB
// ============================
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.error('❌ MongoDB error:', err.message);
    process.exit(1);
  });

// ============================
// MODELS
// ============================
const queueSchema = new mongoose.Schema({
  token: String,
  name: String,
  phone: String,
  service: String,
  status: { type: String, default: 'waiting' },
  joinedAt: { type: Date, default: Date.now },
  servedAt: Date,
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
// ADMIN AUTH
// ============================
function adminAuth(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ✅ NEW ROUTE (IMPORTANT FIX)
app.get('/admin/validate', adminAuth, (req, res) => {
  res.json({ success: true });
});

// ============================
// ROUTES
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

  const token = crypto.randomBytes(4).toString('hex').toUpperCase();
  const user = new Queue({ token, name, phone, service });

  await user.save();

  const total = await Queue.countDocuments({ status: 'waiting' });
  const position = await Queue.countDocuments({
    status: 'waiting',
    joinedAt: { $lte: user.joinedAt },
  });

  res.json({ token, position, total });
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

app.post('/queue/clear', adminAuth, async (req, res) => {
  await Queue.deleteMany({ status: 'waiting' });
  res.json({ success: true });
});

// ============================
// START
// ============================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

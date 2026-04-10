// ============================
// server.js — QuickQ Backend
// ============================

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('.'));  // Serve frontend files

// ============================
// 1. MONGODB CONNECTION
// ============================
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/quickq';

mongoose.connect(mongodb+srv://aditikudekar14_db:<db_password>@cluster0.l4yimaf.mongodb.net/?appName=Cluster0)
  .then(() => console.log('✅ MongoDB connected:', MONGO_URI))
  .catch(err => {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  });

// ============================
// 2. SCHEMA & MODEL
// ============================
const queueSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  phone: { type: String, required: true },
  service: { type: String, default: 'general' },
  status: { type: String, default: 'waiting' }, // waiting | serving | done
  joinedAt: { type: Date, default: Date.now },
  servedAt: { type: Date },
});

const servedSchema = new mongoose.Schema({
  name: String,
  phone: String,
  service: String,
  token: String,
  servedAt: { type: Date, default: Date.now },
});

const Queue = mongoose.model('Queue', queueSchema);
const Served = mongoose.model('Served', servedSchema);

// ============================
// 3. ROUTES
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
  const { name, phone, service } = req.body;
  if (!name || !phone) return res.status(400).json({ error: 'Name and phone required.' });

  // Prevent duplicate join
  const existing = await Queue.findOne({ phone, status: 'waiting' });
  if (existing) {
    const position = await Queue.countDocuments({
      status: 'waiting',
      joinedAt: { $lte: existing.joinedAt }
    });
    const total = await Queue.countDocuments({ status: 'waiting' });
    return res.json({ token: existing.token, position, total, message: 'Already in queue' });
  }

  const token = crypto.randomBytes(3).toString('hex').toUpperCase(); // e.g. A3F9C2

  // Priority: emergency goes to front (earlier joinedAt)
  const joinedAt = service === 'emergency' ? new Date(Date.now() - 9999999) : new Date();

  const user = new Queue({ token, name, phone, service, joinedAt });
  await user.save();

  const total = await Queue.countDocuments({ status: 'waiting' });
  const position = await Queue.countDocuments({
    status: 'waiting',
    joinedAt: { $lte: joinedAt }
  });

  res.json({ token, position, total });
});

// GET /queue/status/:token — get user's current position
app.get('/queue/status/:token', async (req, res) => {
  try {
    const user = await Queue.findOne({ token: req.params.token, status: 'waiting' });
    if (!user) return res.json({ removed: true });

    const position = await Queue.countDocuments({
      status: 'waiting',
      joinedAt: { $lte: user.joinedAt }
    });
    const total = await Queue.countDocuments({ status: 'waiting' });

    res.json({ token: user.token, position, total, name: user.name, service: user.service });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /queue/next — admin calls next user
app.post('/queue/next', async (req, res) => {
  try {
    const next = await Queue.findOne({ status: 'waiting' }).sort({ joinedAt: 1 });
    if (!next) return res.status(404).json({ error: 'Queue is empty' });

    next.status = 'done';
    next.servedAt = new Date();
    await next.save();

    // Save to Served history
    await Served.create({
      name: next.name,
      phone: next.phone,
      service: next.service,
      token: next.token
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

// POST /queue/clear — admin clears all
app.post('/queue/clear', async (req, res) => {
  try {
    await Queue.deleteMany({ status: 'waiting' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /analytics — served history & stats
app.get('/analytics', async (req, res) => {
  try {
    const total = await Served.countDocuments();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = await Served.countDocuments({ servedAt: { $gte: today } });
    const recent = await Served.find().sort({ servedAt: -1 }).limit(20);
    res.json({ total, todayCount, recent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================
// 4. START SERVER
// ============================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 QuickQ Server running at http://localhost:${PORT}`);
  console.log(`📱 User Page:  http://localhost:${PORT}/index.html`);
  console.log(`🔧 Admin Page: http://localhost:${PORT}/admin.html`);
  console.log(`📦 MongoDB:    ${MONGO_URI}\n`);
});

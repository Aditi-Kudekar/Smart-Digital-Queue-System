# 🚀 QuickQ — AI-Powered Smart Queue System

A complete, hackathon-ready Digital Queue System with AI waiting time prediction, live queue board, admin dashboard, QR code entry, and analytics.

---

## 📁 Project Structure

```
queue-system/
├── index.html      ← User page (join queue, live position)
├── admin.html      ← Admin dashboard (manage queue, analytics)
├── style.css       ← Complete dark-theme UI styles
├── script.js       ← User-side frontend logic + AI prediction
├── admin.js        ← Admin panel logic + charts
├── server.js       ← Node.js + Express + MongoDB backend
├── package.json    ← Dependencies
└── README.md       ← This file
```

---

## ⚙️ SETUP — Step by Step

### STEP 1 — Install Node.js
Download and install from: https://nodejs.org (LTS version)

Verify:
```bash
node -v    # should show v18+ or v20+
npm -v     # should show 9+
```

---

### STEP 2 — Install MongoDB

**Option A: Local MongoDB (Recommended for dev)**

Download from: https://www.mongodb.com/try/download/community

Install and run MongoDB:
```bash
# On Windows (after install):
mongod

# On Mac (using Homebrew):
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community

# On Linux (Ubuntu):
sudo systemctl start mongod
```

Verify MongoDB is running:
```bash
mongosh
# You should see a prompt like: test>
```

**Option B: MongoDB Atlas (Cloud — Free)**
1. Go to https://www.mongodb.com/cloud/atlas/register
2. Create a free cluster
3. Click "Connect" → "Connect your application"
4. Copy the connection string, e.g.:
   `mongodb+srv://username:password@cluster.mongodb.net/quickq`
5. Set it as environment variable (see Step 4)

---

### STEP 3 — Install Project Dependencies

Open terminal in the `queue-system` folder:
```bash
cd queue-system
npm install
```

This installs: `express`, `mongoose`, `cors`, `nodemon`

---

### STEP 4 — Configure Database Connection

The default connection is:
```
mongodb://127.0.0.1:27017/quickq
```

This works if MongoDB is running locally. No config needed!

**If using MongoDB Atlas**, set the environment variable:
```bash
# Windows (Command Prompt):
set MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/quickq

# Mac/Linux:
export MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/quickq
```

---

### STEP 5 — Run the Project

```bash
node server.js
```

Or for auto-restart on file changes (development):
```bash
npx nodemon server.js
```

You'll see:
```
✅ MongoDB connected: mongodb://127.0.0.1:27017/quickq

🚀 QuickQ Server running at http://localhost:3000
📱 User Page:  http://localhost:3000/index.html
🔧 Admin Page: http://localhost:3000/admin.html
```

---

## 🌐 OPEN IN BROWSER

| Page        | URL                                   |
|-------------|---------------------------------------|
| User Page   | http://localhost:3000/index.html      |
| Admin Panel | http://localhost:3000/admin.html      |
| Queue API   | http://localhost:3000/queue           |
| Analytics   | http://localhost:3000/analytics       |

---

## 🗄️ VIEW DATABASE

### Option 1: MongoDB Shell (Terminal)
```bash
mongosh
use quickq
db.queues.find().pretty()      # See current queue
db.serveds.find().pretty()     # See served history
```

### Option 2: MongoDB Compass (GUI — Recommended ⭐)
1. Download: https://www.mongodb.com/try/download/compass
2. Open Compass
3. Connect to: `mongodb://localhost:27017`
4. Open database: `quickq`
5. Collections:
   - `queues` → current + past queue entries
   - `serveds` → history of served users

### Option 3: View via API
Open in browser or Postman:
```
http://localhost:3000/queue          ← Current queue
http://localhost:3000/analytics      ← Served history & stats
```

---

## 🔌 API REFERENCE

| Method | Endpoint              | Description                  |
|--------|-----------------------|------------------------------|
| GET    | /queue                | Get all waiting users         |
| POST   | /queue/join           | Join the queue                |
| GET    | /queue/status/:token  | Get user's position by token  |
| POST   | /queue/next           | Admin: call next user         |
| POST   | /queue/leave          | User leaves queue             |
| POST   | /queue/clear          | Admin: clear entire queue     |
| GET    | /analytics            | Get served stats & history    |

### Example: Join Queue
```bash
curl -X POST http://localhost:3000/queue/join \
  -H "Content-Type: application/json" \
  -d '{"name":"Ravi Kumar","phone":"9876543210","service":"general"}'
```

Response:
```json
{
  "token": "A3F9C2",
  "position": 3,
  "total": 7
}
```

---

## 🤖 AI FEATURES

| Feature                  | How It Works                                          |
|--------------------------|-------------------------------------------------------|
| Wait Time Prediction     | `position × avgServiceTime ± variation`               |
| Smart Notifications      | Auto-alert at position 1 and 3                        |
| Priority Queue           | Emergency service gets front-of-queue position        |
| Crowd Prediction         | Detects peak hours (10-12am, 5-7pm) and shows alerts  |
| No-show Detection        | Tracks time since join; admin can see long waits       |

---

## 🧪 TEST FLOW

1. Open http://localhost:3000/index.html
2. Enter name, phone, select service → click "Join Queue Now"
3. You'll see your queue position (e.g. #3) and AI wait estimate
4. Open http://localhost:3000/admin.html in another tab
5. See the user in admin queue list
6. Click "📢 Call Next" → user moves forward
7. Watch the position update automatically every 8 seconds

---

## 🐛 TROUBLESHOOTING

**"Cannot connect to server"**
→ Make sure `node server.js` is running

**"MongoDB connection failed"**
→ Make sure `mongod` is running locally, or check your Atlas URI

**Port 3000 already in use**
```bash
# Find and kill process on port 3000:
# Windows:
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Mac/Linux:
lsof -ti:3000 | xargs kill
```

**npm install fails**
→ Delete `node_modules` folder and `package-lock.json`, then run `npm install` again

---

## 🏆 HACKATHON TIPS

- Demo the live queue update in real-time across two browser tabs
- Show the AI wait time prediction changing as queue grows
- Use Emergency service type to demonstrate priority queueing
- Show the MongoDB Compass GUI to impress judges with live data
- Mention scalability: can support multiple locations with minimal changes

---

## 📦 TECH STACK

| Layer    | Technology          |
|----------|---------------------|
| Frontend | HTML5, CSS3, Vanilla JS |
| Backend  | Node.js + Express   |
| Database | MongoDB + Mongoose  |
| AI       | Custom prediction algorithm |
| QR Code  | QR Server API       |

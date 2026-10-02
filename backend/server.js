const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const taskRoutes = require('./routes/tasks');
const wearRoutes = require('./routes/wear');

const app = express();
const PORT = process.env.PORT || 3847;

// Middleware
app.use(cors());
app.use(express.json());

// Serve frontend static files
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// API routes
app.use('/api/tasks', taskRoutes);
app.use('/api/wear', wearRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// SPA fallback — serve index.html for non-API routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🔌 Shutting down...');
  db.closeDb();
  process.exit(0);
});

process.on('SIGTERM', () => {
  db.closeDb();
  process.exit(0);
});

// Initialize DB and start server
db.getDb();
app.listen(PORT, () => {
  console.log(`\n  ⚡ Task Manager API running at http://localhost:${PORT}`);
  console.log(`  📋 Frontend at http://localhost:${PORT}`);
  console.log(`  💾 Database at ${path.join(__dirname, '..', 'data', 'tasks.db')}\n`);
});

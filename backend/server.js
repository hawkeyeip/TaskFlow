const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const taskRoutes = require('./routes/tasks');
const wearRoutes = require('./routes/wear');
const subtaskRoutes = require('./routes/subtasks');
const timeRoutes = require('./routes/time');
const attachmentRoutes = require('./routes/attachments');
const analyticsRoutes = require('./routes/analytics');
const exportRoutes = require('./routes/export');
const userRoutes = require('./routes/users');
const columnRoutes = require('./routes/columns');
const { router: webhookRoutes } = require('./routes/webhooks');

const app = express();
const PORT = process.env.PORT || 3847;

// Middleware
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Auth & Context Middleware (Supports X-API-Key and Bearer tokens)
app.use((req, res, next) => {
  const apiKey = req.headers['x-api-key'] || (req.headers.authorization && req.headers.authorization.replace('Bearer ', ''));
  if (apiKey) {
    const user = db.getUserByApiKey(apiKey);
    if (user) req.user = user;
  }
  next();
});

// Serve local file uploads
app.use('/uploads', express.static(path.join(__dirname, '..', 'data', 'uploads')));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// API Routes
app.use('/api/tasks', taskRoutes);
app.use('/api/wear', wearRoutes);
app.use('/api', subtaskRoutes);
app.use('/api', timeRoutes);
app.use('/api', attachmentRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/users', userRoutes);
app.use('/api/columns', columnRoutes);
app.use('/api/webhooks', webhookRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    features: [
      'multi-user', 'recurrence', 'subtasks', 'time-tracking',
      'attachments', 'custom-columns', 'eisenhower-matrix',
      'analytics', 'data-backup', 'webhooks', 'icalendar-feed', 'wear-os'
    ]
  });
});

// SPA fallback — serve index.html for non-API routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🔌 Shutting down TaskFlow...');
  db.closeDb();
  process.exit(0);
});

process.on('SIGTERM', () => {
  db.closeDb();
  process.exit(0);
});

// Initialize DB and start server
db.getDb();

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n  ⚡ TaskFlow Enterprise API running at http://localhost:${PORT}`);
    console.log(`  📋 Web Application at http://localhost:${PORT}`);
    console.log(`  💾 SQLite Database at ${path.join(__dirname, '..', 'data', 'tasks.db')}`);
    console.log(`  📁 Uploads Directory at ${path.join(__dirname, '..', 'data', 'uploads')}\n`);
  });
}

module.exports = app;

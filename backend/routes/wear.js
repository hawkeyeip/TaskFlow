/**
 * Wear OS Companion Routes — Lightweight, battery-optimized API endpoints
 * for Google Wear OS smartwatches (Tiles, Complications, and Wrist App).
 */

const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * GET /api/wear/tasks
 * Lightweight task collection formatted for small screens and low bandwidth
 */
router.get('/tasks', (req, res) => {
  try {
    const rawTasks = db.getAllTasks({ sort: 'priority', order: 'asc' });
    const nowStr = new Date().toISOString().split('T')[0];

    // Priority sort: pending duties first, then done duties
    const wearTasks = rawTasks.map(t => {
      let tags = [];
      try {
        tags = typeof t.tags === 'string' ? JSON.parse(t.tags) : (t.tags || []);
      } catch (e) {
        tags = [];
      }

      const isOverdue = !!(t.due_date && t.due_date < nowStr && t.status !== 'done');

      return {
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        completed: t.status === 'done',
        due_date: t.due_date,
        is_overdue: isOverdue,
        tags
      };
    });

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      tasks: wearTasks
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/wear/tasks/:id/toggle
 * 1-tap duty checkoff directly from smartwatch screen
 */
router.post('/tasks/:id/toggle', (req, res) => {
  try {
    const existing = db.getTaskById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    const nextStatus = existing.status === 'done' ? 'todo' : 'done';
    const updated = db.updateTask(existing.id, { status: nextStatus });
    const stats = db.getStats();

    res.json({
      success: true,
      task: {
        id: updated.id,
        title: updated.title,
        status: updated.status,
        completed: updated.status === 'done',
        priority: updated.priority
      },
      stats: {
        todo: stats.todo,
        in_progress: stats.in_progress,
        done: stats.done
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/wear/tasks/quick-add
 * Fast voice-to-text or wrist-dictation task capture
 */
router.post('/tasks/quick-add', (req, res) => {
  try {
    const { title, priority = 'medium' } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Task title is required' });
    }

    const created = db.createTask({
      title: title.trim(),
      description: 'Captured via Google Wear OS wrist input',
      priority: ['critical', 'high', 'medium', 'low'].includes(priority) ? priority : 'medium',
      status: 'todo',
      tags: ['wear-os', 'quick-capture']
    });

    res.status(201).json({
      success: true,
      task: created
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/wear/tile
 * Dedicated payload for Wear OS TileService (swipe-over glance)
 */
router.get('/tile', (req, res) => {
  try {
    const stats = db.getStats();
    const tasks = db.getAllTasks({ sort: 'priority', order: 'asc' })
      .filter(t => t.status !== 'done')
      .slice(0, 3);

    res.json({
      success: true,
      tileTitle: 'TaskFlow Duties',
      pendingCount: (stats.todo || 0) + (stats.in_progress || 0),
      overdueCount: stats.overdue || 0,
      criticalCount: stats.critical || 0,
      tasks: tasks.map(t => ({
        id: t.id,
        title: t.title,
        priority: t.priority,
        status: t.status
      })),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/wear/complication
 * Watch Face Complication data (short text, title, value)
 */
router.get('/complication', (req, res) => {
  try {
    const stats = db.getStats();
    const pending = (stats.todo || 0) + (stats.in_progress || 0);

    res.json({
      type: 'SHORT_TEXT',
      text: `${pending}`,
      title: 'Tasks',
      contentDescription: `${pending} pending tasks in TaskFlow`,
      overdue: stats.overdue || 0,
      hasCritical: (stats.critical || 0) > 0
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

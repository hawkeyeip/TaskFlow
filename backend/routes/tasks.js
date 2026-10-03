const express = require('express');
const router = express.Router();
const db = require('../db');
const { dispatchWebhook } = require('./webhooks');

function parseTask(t) {
  if (!t) return null;
  return {
    ...t,
    tags: typeof t.tags === 'string' ? JSON.parse(t.tags || '[]') : (t.tags || []),
    custom_fields: typeof t.custom_fields === 'string' ? JSON.parse(t.custom_fields || '{}') : (t.custom_fields || {})
  };
}

// GET /api/tasks — List all tasks with optional filters
router.get('/', (req, res) => {
  try {
    const { status, priority, assignee_id, quadrant, search, sort, order } = req.query;
    const tasks = db.getAllTasks({ status, priority, assignee_id, quadrant, search, sort, order });
    const parsed = tasks.map(parseTask);
    res.json({ success: true, data: parsed });
  } catch (err) {
    console.error('GET /api/tasks error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/tasks/stats — Dashboard statistics
router.get('/stats', (req, res) => {
  try {
    const stats = db.getStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    console.error('GET /api/tasks/stats error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/tasks/shared/:token — Public share view for a single task
router.get('/shared/:token', (req, res) => {
  try {
    const task = db.getTaskByShareToken(req.params.token);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Shared task not found or link expired' });
    }
    res.json({ success: true, data: parseTask(task) });
  } catch (err) {
    console.error('GET /api/tasks/shared/:token error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/tasks/:id — Single task with subtasks & attachments
router.get('/:id', (req, res) => {
  try {
    const task = db.getTaskById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }
    res.json({ success: true, data: parseTask(task) });
  } catch (err) {
    console.error('GET /api/tasks/:id error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/tasks — Create task
router.post('/', (req, res) => {
  try {
    const {
      title,
      description,
      status,
      priority,
      tags,
      due_date,
      recurrence_rule,
      eisenhower_quadrant,
      estimated_minutes,
      custom_fields,
      assignee_id
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }

    const task = db.createTask({
      title: title.trim(),
      description: description?.trim() || '',
      status: status || 'todo',
      priority: priority || 'medium',
      tags: tags || [],
      due_date: due_date || null,
      recurrence_rule: recurrence_rule || 'none',
      eisenhower_quadrant: eisenhower_quadrant || 'schedule',
      estimated_minutes: estimated_minutes || 0,
      custom_fields: custom_fields || {},
      assignee_id: assignee_id || null
    });

    const parsed = parseTask(task);
    dispatchWebhook('task.created', parsed);

    res.status(201).json({ success: true, data: parsed });
  } catch (err) {
    console.error('POST /api/tasks error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/tasks/:id — Update task
router.patch('/:id', (req, res) => {
  try {
    const prev = db.getTaskById(req.params.id);
    if (!prev) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    const task = db.updateTask(req.params.id, req.body);
    const parsed = parseTask(task);

    if (prev.status !== 'done' && parsed.status === 'done') {
      dispatchWebhook('task.completed', parsed);
    } else {
      dispatchWebhook('task.updated', parsed);
    }

    res.json({ success: true, data: parsed });
  } catch (err) {
    console.error('PATCH /api/tasks/:id error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/tasks/:id/share — Generate or retrieve share link token
router.post('/:id/share', (req, res) => {
  try {
    const task = db.getTaskById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }
    const token = task.share_token;
    res.json({
      success: true,
      data: {
        share_token: token,
        share_url: `/share/${token}`,
        full_url: `${req.protocol}://${req.get('host')}/share/${token}`
      }
    });
  } catch (err) {
    console.error('POST /api/tasks/:id/share error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/tasks/:id — Delete task
router.delete('/:id', (req, res) => {
  try {
    const task = db.deleteTask(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }
    dispatchWebhook('task.deleted', { id: req.params.id, title: task.title });
    res.json({ success: true, data: { id: req.params.id } });
  } catch (err) {
    console.error('DELETE /api/tasks/:id error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/tasks/reorder — Batch reorder
router.post('/reorder', (req, res) => {
  try {
    const { orders } = req.body;
    if (!Array.isArray(orders)) {
      return res.status(400).json({ success: false, error: 'orders must be an array of { id, position }' });
    }
    db.reorderTasks(orders);
    res.json({ success: true });
  } catch (err) {
    console.error('POST /api/tasks/reorder error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

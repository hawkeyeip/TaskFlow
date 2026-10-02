const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/tasks — List all tasks with optional filters
router.get('/', (req, res) => {
  try {
    const { status, priority, search, sort, order } = req.query;
    const tasks = db.getAllTasks({ status, priority, search, sort, order });

    // Parse tags JSON for each task
    const parsed = tasks.map(t => ({
      ...t,
      tags: JSON.parse(t.tags || '[]')
    }));

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

// GET /api/tasks/:id — Single task
router.get('/:id', (req, res) => {
  try {
    const task = db.getTaskById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }
    task.tags = JSON.parse(task.tags || '[]');
    res.json({ success: true, data: task });
  } catch (err) {
    console.error('GET /api/tasks/:id error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/tasks — Create task
router.post('/', (req, res) => {
  try {
    const { title, description, status, priority, tags, due_date } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }

    const task = db.createTask({
      title: title.trim(),
      description: description?.trim() || '',
      status,
      priority,
      tags: tags || [],
      due_date: due_date || null
    });

    task.tags = JSON.parse(task.tags || '[]');
    res.status(201).json({ success: true, data: task });
  } catch (err) {
    console.error('POST /api/tasks error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/tasks/:id — Update task
router.patch('/:id', (req, res) => {
  try {
    const task = db.updateTask(req.params.id, req.body);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }
    task.tags = JSON.parse(task.tags || '[]');
    res.json({ success: true, data: task });
  } catch (err) {
    console.error('PATCH /api/tasks/:id error:', err);
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

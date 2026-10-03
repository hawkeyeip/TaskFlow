const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/tasks/:id/subtasks
router.get('/tasks/:id/subtasks', (req, res) => {
  try {
    const subtasks = db.getSubtasksByTaskId(req.params.id);
    res.json({ success: true, data: subtasks });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/tasks/:id/subtasks
router.post('/tasks/:id/subtasks', (req, res) => {
  try {
    const { title, position } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }
    const subtask = db.createSubtask({
      taskId: req.params.id,
      title: title.trim(),
      position: position !== undefined ? position : 0
    });
    res.status(201).json({ success: true, data: subtask });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/subtasks/:id
router.patch('/subtasks/:id', (req, res) => {
  try {
    const subtask = db.updateSubtask(req.params.id, req.body);
    if (!subtask) {
      return res.status(404).json({ success: false, error: 'Subtask not found' });
    }
    res.json({ success: true, data: subtask });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/subtasks/:id
router.delete('/subtasks/:id', (req, res) => {
  try {
    const deleted = db.deleteSubtask(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Subtask not found' });
    }
    res.json({ success: true, data: { id: req.params.id } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

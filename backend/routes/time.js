const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/tasks/:id/time-logs
router.get('/tasks/:id/time-logs', (req, res) => {
  try {
    const logs = db.getTimeLogsByTaskId(req.params.id);
    res.json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/tasks/:id/time-logs — Log time spent (stopwatch or manual entry)
router.post('/tasks/:id/time-logs', (req, res) => {
  try {
    const { duration_minutes, user_id, notes } = req.body;
    const mins = parseInt(duration_minutes, 10);
    if (isNaN(mins) || mins <= 0) {
      return res.status(400).json({ success: false, error: 'duration_minutes must be a positive integer' });
    }

    const log = db.createTimeLog({
      taskId: req.params.id,
      userId: user_id || null,
      durationMinutes: mins,
      notes: notes || ''
    });

    const updatedTask = db.getTaskById(req.params.id);
    res.status(201).json({ success: true, data: { log, task: updatedTask } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/time-logs/:id
router.delete('/time-logs/:id', (req, res) => {
  try {
    const deleted = db.deleteTimeLog(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Time log not found' });
    }
    res.json({ success: true, data: { id: req.params.id } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

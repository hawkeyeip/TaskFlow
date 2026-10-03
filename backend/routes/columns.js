const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/columns
router.get('/', (req, res) => {
  try {
    const columns = db.getAllColumns();
    res.json({ success: true, data: columns });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/columns — Add custom status column (e.g. "testing", "blocked", "backlog")
router.post('/', (req, res) => {
  try {
    const { key, title, position, color, wip_limit } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }
    const cleanKey = (key || title).toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const col = db.createColumn({
      key: cleanKey,
      title: title.trim(),
      position,
      color,
      wipLimit: wip_limit
    });
    res.status(201).json({ success: true, data: col });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/columns/:id
router.patch('/:id', (req, res) => {
  try {
    const col = db.updateColumn(req.params.id, req.body);
    if (!col) {
      return res.status(404).json({ success: false, error: 'Column not found' });
    }
    res.json({ success: true, data: col });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/columns/:id
router.delete('/:id', (req, res) => {
  try {
    const deleted = db.deleteColumn(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Column not found' });
    }
    res.json({ success: true, data: { id: req.params.id } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

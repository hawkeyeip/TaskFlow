const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/analytics/report
router.get('/report', (req, res) => {
  try {
    const days = parseInt(req.query.days || 30, 10);
    const data = db.getAnalyticsSummary(days);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/export/backup — Complete JSON snapshot of entire database
router.get('/backup', (req, res) => {
  try {
    const backup = db.exportDatabaseBackup();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="taskflow-backup-${Date.now()}.json"`);
    res.json(backup);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/export/restore — Restore database from uploaded JSON
router.post('/restore', (req, res) => {
  try {
    const backupData = req.body;
    const result = db.restoreDatabaseBackup(backupData);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// GET /api/export/csv — CSV export of all tasks
router.get('/csv', (req, res) => {
  try {
    const tasks = db.getAllTasks({ status: 'all' });
    const headers = ['ID', 'Title', 'Status', 'Priority', 'Quadrant', 'Assignee', 'Due Date', 'Estimated Mins', 'Actual Mins', 'Recurrence', 'Created At', 'Completed At'];

    const rows = tasks.map(t => [
      `"${t.id}"`,
      `"${(t.title || '').replace(/"/g, '""')}"`,
      `"${t.status}"`,
      `"${t.priority}"`,
      `"${t.eisenhower_quadrant || 'schedule'}"`,
      `"${(t.assignee_name || '').replace(/"/g, '""')}"`,
      `"${t.due_date || ''}"`,
      t.estimated_minutes || 0,
      t.actual_minutes || 0,
      `"${t.recurrence_rule || 'none'}"`,
      `"${t.created_at}"`,
      `"${t.completed_at || ''}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="taskflow-tasks-${Date.now()}.csv"`);
    res.send(csvContent);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/export/calendar.ics — RFC 5545 iCalendar feed
router.get('/calendar.ics', (req, res) => {
  try {
    const tasks = db.getAllTasks({ status: 'all' });
    const activeTasks = tasks.filter(t => t.due_date && t.status !== 'archived');

    let ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//TaskFlow//Task Calendar Feed//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:TaskFlow Tasks',
      'X-WR-TIMEZONE:UTC'
    ];

    for (const t of activeTasks) {
      const due = t.due_date.replace(/-/g, '');
      const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      const cleanTitle = (t.title || '').replace(/[,;]/g, ' ');
      const cleanDesc = (t.description || '').replace(/[,;\n]/g, ' ');

      ics.push('BEGIN:VEVENT');
      ics.push(`UID:taskflow-${t.id}@taskflow.dev`);
      ics.push(`DTSTAMP:${stamp}`);
      ics.push(`DTSTART;VALUE=DATE:${due}`);
      ics.push(`DTEND;VALUE=DATE:${due}`);
      ics.push(`SUMMARY:${cleanTitle} [${t.priority.toUpperCase()}]`);
      ics.push(`DESCRIPTION:${cleanDesc} (Status: ${t.status})`);
      ics.push(`STATUS:${t.status === 'done' ? 'COMPLETED' : 'CONFIRMED'}`);
      ics.push('END:VEVENT');
    }

    ics.push('END:VCALENDAR');

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="taskflow.ics"');
    res.send(ics.join('\r\n'));
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

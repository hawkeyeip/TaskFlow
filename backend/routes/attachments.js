const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'data', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'doc-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB limit
});

// GET /api/tasks/:id/attachments
router.get('/tasks/:id/attachments', (req, res) => {
  try {
    const attachments = db.getAttachmentsByTaskId(req.params.id);
    res.json({ success: true, data: attachments });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/tasks/:id/attachments — Upload file
router.post('/tasks/:id/attachments', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const taskId = req.params.id;
    const task = db.getTaskById(taskId);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    const attachment = db.createAttachment({
      taskId,
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      filePath: req.file.path,
      url: fileUrl
    });

    res.status(201).json({ success: true, data: attachment });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/tasks/:id/links — Attach external web link (Docs, Figma, PR)
router.post('/tasks/:id/links', (req, res) => {
  try {
    const { url, title } = req.body;
    if (!url) {
      return res.status(400).json({ success: false, error: 'URL is required' });
    }

    const taskId = req.params.id;
    const task = db.getTaskById(taskId);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    const attachment = db.createAttachment({
      taskId,
      filename: title || url,
      originalName: title || url,
      mimeType: 'text/uri-list',
      sizeBytes: 0,
      filePath: '',
      url
    });

    res.status(201).json({ success: true, data: attachment });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/attachments/:id/download — Download or serve attachment
router.get('/attachments/:id/download', (req, res) => {
  try {
    const attachment = db.getAttachmentById(req.params.id);
    if (!attachment) {
      return res.status(404).json({ success: false, error: 'Attachment not found' });
    }

    if (attachment.filePath && fs.existsSync(attachment.filePath)) {
      res.download(attachment.filePath, attachment.original_name);
    } else if (attachment.url) {
      res.redirect(attachment.url);
    } else {
      res.status(404).json({ success: false, error: 'File content not found' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/attachments/:id
router.delete('/attachments/:id', (req, res) => {
  try {
    const attachment = db.getAttachmentById(req.params.id);
    if (!attachment) {
      return res.status(404).json({ success: false, error: 'Attachment not found' });
    }

    if (attachment.filePath && fs.existsSync(attachment.filePath)) {
      try {
        fs.unlinkSync(attachment.filePath);
      } catch (e) {
        // Continue DB deletion even if disk file already deleted
      }
    }

    db.deleteAttachment(req.params.id);
    res.json({ success: true, data: { id: req.params.id } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

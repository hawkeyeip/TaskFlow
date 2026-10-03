const express = require('express');
const router = express.Router();
const http = require('http');
const https = require('https');
const db = require('../db');

// Outbound Webhook Dispatcher
async function dispatchWebhook(event, payload) {
  try {
    const webhooks = db.getAllWebhooks().filter(w => w.active === 1);
    if (!webhooks.length) return;

    for (const wh of webhooks) {
      if (wh.event !== 'all' && wh.event !== event) continue;

      const data = JSON.stringify({
        event,
        timestamp: new Date().toISOString(),
        taskflow_version: '2.0.0',
        data: payload,
        // Slack / Discord markdown compatible payload
        text: `⚡ *TaskFlow Notification* [${event}]\n*Task:* ${payload.title || payload.id || 'Task event'}\n*Status:* ${payload.status || 'Updated'}`
      });

      try {
        const parsedUrl = new URL(wh.url);
        const transport = parsedUrl.protocol === 'https:' ? https : http;

        const req = transport.request(parsedUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data),
            'User-Agent': 'TaskFlow-Webhook-Dispatcher/2.0'
          },
          timeout: 4000
        });

        req.on('error', (e) => {
          console.warn(`Webhook dispatch error to ${wh.url}:`, e.message);
        });

        req.write(data);
        req.end();
      } catch (err) {
        console.warn(`Webhook failed to parse URL ${wh.url}:`, err.message);
      }
    }
  } catch (err) {
    console.error('Webhook dispatch overall error:', err);
  }
}

// GET /api/webhooks
router.get('/', (req, res) => {
  try {
    const list = db.getAllWebhooks();
    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/webhooks
router.post('/', (req, res) => {
  try {
    const { url, event, secret } = req.body;
    if (!url || !url.startsWith('http')) {
      return res.status(400).json({ success: false, error: 'A valid HTTP(S) URL is required' });
    }
    const wh = db.createWebhook({ url, event: event || 'all', secret: secret || '' });
    res.status(201).json({ success: true, data: wh });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/webhooks/:id
router.delete('/:id', (req, res) => {
  try {
    const deleted = db.deleteWebhook(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Webhook not found' });
    }
    res.json({ success: true, data: { id: req.params.id } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/webhooks/:id/test — Send test payload
router.post('/:id/test', async (req, res) => {
  try {
    const webhooks = db.getAllWebhooks();
    const wh = webhooks.find(w => w.id === req.params.id);
    if (!wh) {
      return res.status(404).json({ success: false, error: 'Webhook not found' });
    }

    await dispatchWebhook('taskflow.test', {
      message: 'Ping from TaskFlow Webhook Integration System',
      server_time: new Date().toISOString()
    });

    res.json({ success: true, message: `Test ping dispatched to ${wh.url}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = {
  router,
  dispatchWebhook
};

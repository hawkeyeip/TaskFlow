/**
 * TaskFlow API Client — Unified communication layer with Express backend
 */
const API = (() => {
  const BASE = '/api';

  async function request(url, options = {}) {
    const headers = { ...options.headers };
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(url, {
      ...options,
      headers
    });

    const data = await res.json();
    if (!data.success && data.error) {
      throw new Error(data.error || 'Request failed');
    }
    return data.data !== undefined ? data.data : data;
  }

  return {
    // --- Tasks ---
    async getTasks({ status, priority, assignee_id, quadrant, search, sort, order } = {}) {
      const params = new URLSearchParams();
      if (status && status !== 'all') params.set('status', status);
      if (priority && priority !== 'all') params.set('priority', priority);
      if (assignee_id && assignee_id !== 'all') params.set('assignee_id', assignee_id);
      if (quadrant && quadrant !== 'all') params.set('quadrant', quadrant);
      if (search) params.set('search', search);
      if (sort) params.set('sort', sort);
      if (order) params.set('order', order);
      const qs = params.toString();
      return request(`${BASE}/tasks${qs ? '?' + qs : ''}`);
    },

    async getStats() {
      return request(`${BASE}/tasks/stats`);
    },

    async getTask(id) {
      return request(`${BASE}/tasks/${id}`);
    },

    async createTask(task) {
      return request(`${BASE}/tasks`, {
        method: 'POST',
        body: JSON.stringify(task)
      });
    },

    async updateTask(id, updates) {
      return request(`${BASE}/tasks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates)
      });
    },

    async deleteTask(id) {
      return request(`${BASE}/tasks/${id}`, {
        method: 'DELETE'
      });
    },

    async reorderTasks(orders) {
      return request(`${BASE}/tasks/reorder`, {
        method: 'POST',
        body: JSON.stringify({ orders })
      });
    },

    async shareTask(id) {
      return request(`${BASE}/tasks/${id}/share`, {
        method: 'POST'
      });
    },

    async getSharedTask(token) {
      return request(`${BASE}/tasks/shared/${token}`);
    },

    // --- Subtasks ---
    async getSubtasks(taskId) {
      return request(`${BASE}/tasks/${taskId}/subtasks`);
    },

    async createSubtask(taskId, title) {
      return request(`${BASE}/tasks/${taskId}/subtasks`, {
        method: 'POST',
        body: JSON.stringify({ title })
      });
    },

    async updateSubtask(subtaskId, updates) {
      return request(`${BASE}/subtasks/${subtaskId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates)
      });
    },

    async deleteSubtask(subtaskId) {
      return request(`${BASE}/subtasks/${subtaskId}`, {
        method: 'DELETE'
      });
    },

    // --- Time Tracking ---
    async getTimeLogs(taskId) {
      return request(`${BASE}/tasks/${taskId}/time-logs`);
    },

    async createTimeLog(taskId, duration_minutes, user_id, notes) {
      return request(`${BASE}/tasks/${taskId}/time-logs`, {
        method: 'POST',
        body: JSON.stringify({ duration_minutes, user_id, notes })
      });
    },

    async deleteTimeLog(logId) {
      return request(`${BASE}/time-logs/${logId}`, {
        method: 'DELETE'
      });
    },

    // --- File Attachments ---
    async getAttachments(taskId) {
      return request(`${BASE}/tasks/${taskId}/attachments`);
    },

    async uploadAttachment(taskId, file) {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${BASE}/tasks/${taskId}/attachments`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Upload failed');
      return data.data;
    },

    async attachLink(taskId, url, title) {
      return request(`${BASE}/tasks/${taskId}/links`, {
        method: 'POST',
        body: JSON.stringify({ url, title })
      });
    },

    async deleteAttachment(attachmentId) {
      return request(`${BASE}/attachments/${attachmentId}`, {
        method: 'DELETE'
      });
    },

    // --- Users & Collaboration ---
    async getUsers() {
      return request(`${BASE}/users`);
    },

    async createUser(user) {
      return request(`${BASE}/users`, {
        method: 'POST',
        body: JSON.stringify(user)
      });
    },

    // --- Columns & Workflow Customization ---
    async getColumns() {
      return request(`${BASE}/columns`);
    },

    async createColumn(col) {
      return request(`${BASE}/columns`, {
        method: 'POST',
        body: JSON.stringify(col)
      });
    },

    async updateColumn(id, updates) {
      return request(`${BASE}/columns/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates)
      });
    },

    async deleteColumn(id) {
      return request(`${BASE}/columns/${id}`, {
        method: 'DELETE'
      });
    },

    // --- Analytics & Reports ---
    async getAnalytics(days = 30) {
      return request(`${BASE}/analytics/report?days=${days}`);
    },

    // --- Data Backup & Restore ---
    async restoreBackup(backupData) {
      return request(`${BASE}/export/restore`, {
        method: 'POST',
        body: JSON.stringify(backupData)
      });
    },

    // --- Webhooks ---
    async getWebhooks() {
      return request(`${BASE}/webhooks`);
    },

    async createWebhook(wh) {
      return request(`${BASE}/webhooks`, {
        method: 'POST',
        body: JSON.stringify(wh)
      });
    },

    async deleteWebhook(id) {
      return request(`${BASE}/webhooks/${id}`, {
        method: 'DELETE'
      });
    },

    async testWebhook(id) {
      return request(`${BASE}/webhooks/${id}/test`, {
        method: 'POST'
      });
    },

    // --- Wear OS Gateway ---
    async getWearTasks() {
      const res = await fetch(`${BASE}/wear/tasks`);
      return res.json();
    },

    async toggleWearTask(id) {
      const res = await fetch(`${BASE}/wear/tasks/${id}/toggle`, { method: 'POST' });
      return res.json();
    },

    async quickAddWearTask(title) {
      const res = await fetch(`${BASE}/wear/tasks/quick-add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title })
      });
      return res.json();
    },

    async getWearTile() {
      const res = await fetch(`${BASE}/wear/tile`);
      return res.json();
    }
  };
})();

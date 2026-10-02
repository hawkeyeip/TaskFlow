/**
 * API Client — communicates with the Express backend
 */
const API = (() => {
  const BASE = '/api/tasks';

  async function request(url, options = {}) {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Request failed');
    }
    return data.data;
  }

  return {
    /** Fetch all tasks with optional filters */
    async getTasks({ status, priority, search, sort, order } = {}) {
      const params = new URLSearchParams();
      if (status && status !== 'all') params.set('status', status);
      if (priority && priority !== 'all') params.set('priority', priority);
      if (search) params.set('search', search);
      if (sort) params.set('sort', sort);
      if (order) params.set('order', order);
      const qs = params.toString();
      return request(`${BASE}${qs ? '?' + qs : ''}`);
    },

    /** Fetch dashboard stats */
    async getStats() {
      return request(`${BASE}/stats`);
    },

    /** Get a single task */
    async getTask(id) {
      return request(`${BASE}/${id}`);
    },

    /** Create a new task */
    async createTask(task) {
      return request(BASE, {
        method: 'POST',
        body: JSON.stringify(task)
      });
    },

    /** Update a task */
    async updateTask(id, updates) {
      return request(`${BASE}/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates)
      });
    },

    /** Delete a task */
    async deleteTask(id) {
      return request(`${BASE}/${id}`, {
        method: 'DELETE'
      });
    },

    /** Batch reorder tasks */
    async reorderTasks(orders) {
      return request(`${BASE}/reorder`, {
        method: 'POST',
        body: JSON.stringify({ orders })
      });
    },

    // Wear OS Gateway Client Methods
    async getWearTasks() {
      const res = await fetch('/api/wear/tasks');
      return res.json();
    },

    async toggleWearTask(id) {
      const res = await fetch(`/api/wear/tasks/${id}/toggle`, { method: 'POST' });
      return res.json();
    },

    async quickAddWearTask(title) {
      const res = await fetch('/api/wear/tasks/quick-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title })
      });
      return res.json();
    },

    async getWearTile() {
      const res = await fetch('/api/wear/tile');
      return res.json();
    }
  };
})();

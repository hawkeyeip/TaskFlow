const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, '..', 'data', 'tasks.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initialize();
  }
  return db;
}

function initialize() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo', 'in_progress', 'done', 'archived')),
      priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('critical', 'high', 'medium', 'low')),
      tags TEXT DEFAULT '[]',
      due_date TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      position INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
    CREATE INDEX IF NOT EXISTS idx_tasks_position ON tasks(position);
    CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
  `);
}

// --- CRUD Operations ---

function getAllTasks({ status, priority, search, sort, order } = {}) {
  let query = 'SELECT * FROM tasks WHERE 1=1';
  const params = {};

  if (status && status !== 'all') {
    query += ' AND status = @status';
    params.status = status;
  }

  if (priority && priority !== 'all') {
    query += ' AND priority = @priority';
    params.priority = priority;
  }

  if (search) {
    query += ' AND (title LIKE @search OR description LIKE @search OR tags LIKE @search)';
    params.search = `%${search}%`;
  }

  // Exclude archived by default unless explicitly requested
  if (!status || status === 'all') {
    query += " AND status != 'archived'";
  }

  const sortColumn = ['title', 'priority', 'due_date', 'created_at', 'updated_at', 'position'].includes(sort) ? sort : 'position';
  const sortOrder = order === 'desc' ? 'DESC' : 'ASC';

  // Custom priority ordering
  if (sortColumn === 'priority') {
    query += ` ORDER BY CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END ${sortOrder}, position ASC`;
  } else {
    query += ` ORDER BY ${sortColumn} ${sortOrder}`;
  }

  return getDb().prepare(query).all(params);
}

function getTaskById(id) {
  return getDb().prepare('SELECT * FROM tasks WHERE id = ?').get(id);
}

function createTask({ title, description = '', status = 'todo', priority = 'medium', tags = [], due_date = null }) {
  const id = uuidv4();
  const now = new Date().toISOString();

  // Get max position for status column
  const maxPos = getDb().prepare('SELECT COALESCE(MAX(position), -1) as max_pos FROM tasks WHERE status = ?').get(status);
  const position = (maxPos?.max_pos ?? -1) + 1;

  getDb().prepare(`
    INSERT INTO tasks (id, title, description, status, priority, tags, due_date, created_at, updated_at, position)
    VALUES (@id, @title, @description, @status, @priority, @tags, @due_date, @created_at, @updated_at, @position)
  `).run({
    id,
    title,
    description,
    status,
    priority,
    tags: JSON.stringify(tags),
    due_date,
    created_at: now,
    updated_at: now,
    position
  });

  return getTaskById(id);
}

function updateTask(id, updates) {
  const existing = getTaskById(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const merged = {
    title: updates.title ?? existing.title,
    description: updates.description ?? existing.description,
    status: updates.status ?? existing.status,
    priority: updates.priority ?? existing.priority,
    tags: updates.tags ? JSON.stringify(updates.tags) : existing.tags,
    due_date: updates.due_date !== undefined ? updates.due_date : existing.due_date,
    position: updates.position ?? existing.position,
    updated_at: now,
    completed_at: existing.completed_at
  };

  // Track completion timestamp
  if (merged.status === 'done' && existing.status !== 'done') {
    merged.completed_at = now;
  } else if (merged.status !== 'done') {
    merged.completed_at = null;
  }

  getDb().prepare(`
    UPDATE tasks SET
      title = @title,
      description = @description,
      status = @status,
      priority = @priority,
      tags = @tags,
      due_date = @due_date,
      position = @position,
      updated_at = @updated_at,
      completed_at = @completed_at
    WHERE id = @id
  `).run({ ...merged, id });

  return getTaskById(id);
}

function deleteTask(id) {
  const existing = getTaskById(id);
  if (!existing) return null;
  getDb().prepare('DELETE FROM tasks WHERE id = ?').run(id);
  return existing;
}

function reorderTasks(taskOrders) {
  const stmt = getDb().prepare('UPDATE tasks SET position = @position, updated_at = @updated_at WHERE id = @id');
  const now = new Date().toISOString();

  const updateMany = getDb().transaction((orders) => {
    for (const { id, position } of orders) {
      stmt.run({ id, position, updated_at: now });
    }
  });

  updateMany(taskOrders);
}

function getStats() {
  const stats = getDb().prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'todo' THEN 1 ELSE 0 END) as todo,
      SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
      SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done,
      SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) as archived,
      SUM(CASE WHEN priority = 'critical' THEN 1 ELSE 0 END) as critical,
      SUM(CASE WHEN priority = 'high' THEN 1 ELSE 0 END) as high,
      SUM(CASE WHEN priority = 'medium' THEN 1 ELSE 0 END) as medium,
      SUM(CASE WHEN priority = 'low' THEN 1 ELSE 0 END) as low,
      SUM(CASE WHEN due_date IS NOT NULL AND due_date < datetime('now') AND status != 'done' AND status != 'archived' THEN 1 ELSE 0 END) as overdue
    FROM tasks
  `).get();

  return stats;
}

function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = {
  getDb,
  getAllTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  reorderTasks,
  getStats,
  closeDb
};

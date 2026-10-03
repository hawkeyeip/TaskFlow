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
  // 1. Core tasks table (backward compatible baseline)
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'todo',
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

  // Migrate tasks table for Enterprise & 9-Area Features
  const taskColumns = db.prepare('PRAGMA table_info(tasks)').all().map(c => c.name);

  if (!taskColumns.includes('recurrence_rule')) {
    db.exec("ALTER TABLE tasks ADD COLUMN recurrence_rule TEXT DEFAULT 'none'");
  }
  if (!taskColumns.includes('eisenhower_quadrant')) {
    db.exec("ALTER TABLE tasks ADD COLUMN eisenhower_quadrant TEXT DEFAULT 'schedule'");
  }
  if (!taskColumns.includes('estimated_minutes')) {
    db.exec("ALTER TABLE tasks ADD COLUMN estimated_minutes INTEGER DEFAULT 0");
  }
  if (!taskColumns.includes('actual_minutes')) {
    db.exec("ALTER TABLE tasks ADD COLUMN actual_minutes INTEGER DEFAULT 0");
  }
  if (!taskColumns.includes('custom_fields')) {
    db.exec("ALTER TABLE tasks ADD COLUMN custom_fields TEXT DEFAULT '{}'");
  }
  if (!taskColumns.includes('assignee_id')) {
    db.exec("ALTER TABLE tasks ADD COLUMN assignee_id TEXT");
  }
  if (!taskColumns.includes('share_token')) {
    db.exec("ALTER TABLE tasks ADD COLUMN share_token TEXT");
  }
  if (!taskColumns.includes('parent_id')) {
    db.exec("ALTER TABLE tasks ADD COLUMN parent_id TEXT");
  }

  // 2. Users table (Multi-user Collaboration & Auth)
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      role TEXT DEFAULT 'member',
      avatar TEXT DEFAULT '👤',
      api_key TEXT UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Seed default users if empty
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount === 0) {
    const seedUsers = [
      { id: 'user-1', name: 'Brandon Heisey', email: 'brandon@taskflow.dev', role: 'admin', avatar: '⚡', api_key: 'tk_live_brandon123' },
      { id: 'user-2', name: 'Alex Rivera', email: 'alex@taskflow.dev', role: 'member', avatar: '🎨', api_key: 'tk_live_alex456' },
      { id: 'user-3', name: 'Sam Taylor', email: 'sam@taskflow.dev', role: 'member', avatar: '💻', api_key: 'tk_live_sam789' },
      { id: 'user-4', name: 'Jordan Lee', email: 'jordan@taskflow.dev', role: 'member', avatar: '🚀', api_key: 'tk_live_jordan321' }
    ];
    const insertUser = db.prepare('INSERT INTO users (id, name, email, role, avatar, api_key) VALUES (@id, @name, @email, @role, @avatar, @api_key)');
    for (const u of seedUsers) {
      insertUser.run(u);
    }
  }

  // 3. Subtasks table (Hierarchical breakdowns)
  db.exec(`
    CREATE TABLE IF NOT EXISTS subtasks (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_subtasks_task_id ON subtasks(task_id);
  `);

  // 4. Time Logs table (Time tracking & productivity stats)
  db.exec(`
    CREATE TABLE IF NOT EXISTS time_logs (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      user_id TEXT,
      duration_minutes INTEGER NOT NULL,
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_time_logs_task_id ON time_logs(task_id);
  `);

  // 5. Attachments table (Document & File Uploads)
  db.exec(`
    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT,
      size_bytes INTEGER,
      file_path TEXT,
      url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_attachments_task_id ON attachments(task_id);
  `);

  // 6. Dynamic Columns table (Custom Workflows)
  db.exec(`
    CREATE TABLE IF NOT EXISTS columns (
      id TEXT PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      position INTEGER NOT NULL,
      color TEXT,
      wip_limit INTEGER DEFAULT 0
    );
  `);

  // Seed default columns if empty
  const colCount = db.prepare('SELECT COUNT(*) as count FROM columns').get().count;
  if (colCount === 0) {
    const seedColumns = [
      { id: 'col-1', key: 'todo', title: 'To Do', position: 0, color: 'var(--neon-purple)', wip_limit: 0 },
      { id: 'col-2', key: 'in_progress', title: 'In Progress', position: 1, color: 'var(--neon-cyan)', wip_limit: 5 },
      { id: 'col-3', key: 'review', title: 'Review / QA', position: 2, color: 'var(--neon-amber)', wip_limit: 3 },
      { id: 'col-4', key: 'done', title: 'Done', position: 3, color: 'var(--neon-green)', wip_limit: 0 }
    ];
    const insertCol = db.prepare('INSERT INTO columns (id, key, title, position, color, wip_limit) VALUES (@id, @key, @title, @position, @color, @wip_limit)');
    for (const c of seedColumns) {
      insertCol.run(c);
    }
  }

  // 7. Webhooks table (Integration Capabilities)
  db.exec(`
    CREATE TABLE IF NOT EXISTS webhooks (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      event TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      secret TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

// --- CRUD Operations for Tasks ---

function getAllTasks({ status, priority, assignee_id, quadrant, search, sort, order } = {}) {
  let query = `
    SELECT
      t.*,
      u.name as assignee_name,
      u.avatar as assignee_avatar,
      (SELECT COUNT(*) FROM subtasks WHERE task_id = t.id) as subtask_count,
      (SELECT COUNT(*) FROM subtasks WHERE task_id = t.id AND completed = 1) as subtask_completed,
      (SELECT COALESCE(SUM(duration_minutes), 0) FROM time_logs WHERE task_id = t.id) as logged_minutes,
      (SELECT COUNT(*) FROM attachments WHERE task_id = t.id) as attachment_count
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
    WHERE 1=1
  `;
  const params = {};

  if (status && status !== 'all') {
    query += ' AND t.status = @status';
    params.status = status;
  }

  if (priority && priority !== 'all') {
    query += ' AND t.priority = @priority';
    params.priority = priority;
  }

  if (assignee_id && assignee_id !== 'all') {
    query += ' AND t.assignee_id = @assignee_id';
    params.assignee_id = assignee_id;
  }

  if (quadrant && quadrant !== 'all') {
    query += ' AND t.eisenhower_quadrant = @quadrant';
    params.quadrant = quadrant;
  }

  if (search) {
    query += ' AND (t.title LIKE @search OR t.description LIKE @search OR t.tags LIKE @search OR t.custom_fields LIKE @search)';
    params.search = `%${search}%`;
  }

  // Exclude archived by default unless explicitly requested
  if (!status || status === 'all') {
    query += " AND t.status != 'archived'";
  }

  const sortColumn = ['title', 'priority', 'due_date', 'created_at', 'updated_at', 'position', 'estimated_minutes'].includes(sort) ? sort : 'position';
  const sortOrder = order === 'desc' ? 'DESC' : 'ASC';

  if (sortColumn === 'priority') {
    query += ` ORDER BY CASE t.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END ${sortOrder}, t.position ASC`;
  } else {
    query += ` ORDER BY t.${sortColumn} ${sortOrder}`;
  }

  return getDb().prepare(query).all(params);
}

function getTaskById(id) {
  const task = getDb().prepare(`
    SELECT
      t.*,
      u.name as assignee_name,
      u.avatar as assignee_avatar,
      (SELECT COUNT(*) FROM subtasks WHERE task_id = t.id) as subtask_count,
      (SELECT COUNT(*) FROM subtasks WHERE task_id = t.id AND completed = 1) as subtask_completed,
      (SELECT COALESCE(SUM(duration_minutes), 0) FROM time_logs WHERE task_id = t.id) as logged_minutes,
      (SELECT COUNT(*) FROM attachments WHERE task_id = t.id) as attachment_count
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
    WHERE t.id = ?
  `).get(id);

  if (!task) return null;

  task.subtasks = getSubtasksByTaskId(id);
  task.attachments = getAttachmentsByTaskId(id);
  task.time_logs = getTimeLogsByTaskId(id);
  return task;
}

function getTaskByShareToken(token) {
  const task = getDb().prepare(`
    SELECT
      t.*,
      u.name as assignee_name,
      u.avatar as assignee_avatar
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
    WHERE t.share_token = ?
  `).get(token);

  if (!task) return null;
  task.subtasks = getSubtasksByTaskId(task.id);
  task.attachments = getAttachmentsByTaskId(task.id);
  return task;
}

function createTask({
  title,
  description = '',
  status = 'todo',
  priority = 'medium',
  tags = [],
  due_date = null,
  recurrence_rule = 'none',
  eisenhower_quadrant = 'schedule',
  estimated_minutes = 0,
  custom_fields = {},
  assignee_id = null
}) {
  const id = uuidv4();
  const now = new Date().toISOString();
  const share_token = uuidv4().replace(/-/g, '').slice(0, 16);

  const maxPos = getDb().prepare('SELECT COALESCE(MAX(position), -1) as max_pos FROM tasks WHERE status = ?').get(status);
  const position = (maxPos?.max_pos ?? -1) + 1;

  getDb().prepare(`
    INSERT INTO tasks (
      id, title, description, status, priority, tags, due_date,
      created_at, updated_at, position, recurrence_rule,
      eisenhower_quadrant, estimated_minutes, actual_minutes,
      custom_fields, assignee_id, share_token
    )
    VALUES (
      @id, @title, @description, @status, @priority, @tags, @due_date,
      @created_at, @updated_at, @position, @recurrence_rule,
      @eisenhower_quadrant, @estimated_minutes, 0,
      @custom_fields, @assignee_id, @share_token
    )
  `).run({
    id,
    title,
    description,
    status,
    priority,
    tags: typeof tags === 'string' ? tags : JSON.stringify(tags || []),
    due_date,
    created_at: now,
    updated_at: now,
    position,
    recurrence_rule: recurrence_rule || 'none',
    eisenhower_quadrant: eisenhower_quadrant || 'schedule',
    estimated_minutes: parseInt(estimated_minutes || 0, 10),
    custom_fields: typeof custom_fields === 'string' ? custom_fields : JSON.stringify(custom_fields || {}),
    assignee_id: assignee_id || null,
    share_token
  });

  return getTaskById(id);
}

function updateTask(id, updates) {
  const existing = getTaskById(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const merged = {
    title: updates.title !== undefined ? updates.title : existing.title,
    description: updates.description !== undefined ? updates.description : existing.description,
    status: updates.status !== undefined ? updates.status : existing.status,
    priority: updates.priority !== undefined ? updates.priority : existing.priority,
    tags: updates.tags !== undefined ? (typeof updates.tags === 'string' ? updates.tags : JSON.stringify(updates.tags)) : existing.tags,
    due_date: updates.due_date !== undefined ? updates.due_date : existing.due_date,
    position: updates.position !== undefined ? updates.position : existing.position,
    recurrence_rule: updates.recurrence_rule !== undefined ? updates.recurrence_rule : (existing.recurrence_rule || 'none'),
    eisenhower_quadrant: updates.eisenhower_quadrant !== undefined ? updates.eisenhower_quadrant : (existing.eisenhower_quadrant || 'schedule'),
    estimated_minutes: updates.estimated_minutes !== undefined ? parseInt(updates.estimated_minutes, 10) : (existing.estimated_minutes || 0),
    actual_minutes: updates.actual_minutes !== undefined ? parseInt(updates.actual_minutes, 10) : (existing.actual_minutes || 0),
    custom_fields: updates.custom_fields !== undefined ? (typeof updates.custom_fields === 'string' ? updates.custom_fields : JSON.stringify(updates.custom_fields)) : (existing.custom_fields || '{}'),
    assignee_id: updates.assignee_id !== undefined ? updates.assignee_id : existing.assignee_id,
    share_token: existing.share_token || uuidv4().replace(/-/g, '').slice(0, 16),
    updated_at: now,
    completed_at: existing.completed_at
  };

  const isCompletingNow = merged.status === 'done' && existing.status !== 'done';
  if (isCompletingNow) {
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
      recurrence_rule = @recurrence_rule,
      eisenhower_quadrant = @eisenhower_quadrant,
      estimated_minutes = @estimated_minutes,
      actual_minutes = @actual_minutes,
      custom_fields = @custom_fields,
      assignee_id = @assignee_id,
      share_token = @share_token,
      updated_at = @updated_at,
      completed_at = @completed_at
    WHERE id = @id
  `).run({ ...merged, id });

  // Handle Recurring Tasks Automation
  if (isCompletingNow && merged.recurrence_rule && merged.recurrence_rule !== 'none') {
    spawnNextRecurringTask(id);
  }

  return getTaskById(id);
}

function spawnNextRecurringTask(originalTaskId) {
  const original = getTaskById(originalTaskId);
  if (!original) return null;

  let nextDue = null;
  const baseDate = original.due_date ? new Date(original.due_date + 'T00:00:00') : new Date();

  switch (original.recurrence_rule) {
    case 'daily':
      baseDate.setDate(baseDate.getDate() + 1);
      nextDue = baseDate.toISOString().split('T')[0];
      break;
    case 'weekly':
      baseDate.setDate(baseDate.getDate() + 7);
      nextDue = baseDate.toISOString().split('T')[0];
      break;
    case 'biweekly':
      baseDate.setDate(baseDate.getDate() + 14);
      nextDue = baseDate.toISOString().split('T')[0];
      break;
    case 'monthly':
      baseDate.setMonth(baseDate.getMonth() + 1);
      nextDue = baseDate.toISOString().split('T')[0];
      break;
    default:
      break;
  }

  const nextTask = createTask({
    title: original.title,
    description: original.description,
    status: 'todo',
    priority: original.priority,
    tags: JSON.parse(original.tags || '[]'),
    due_date: nextDue,
    recurrence_rule: original.recurrence_rule,
    eisenhower_quadrant: original.eisenhower_quadrant,
    estimated_minutes: original.estimated_minutes,
    custom_fields: JSON.parse(original.custom_fields || '{}'),
    assignee_id: original.assignee_id
  });

  // Duplicate subtasks in uncompleted state
  const existingSubtasks = getSubtasksByTaskId(originalTaskId);
  for (const st of existingSubtasks) {
    createSubtask({
      taskId: nextTask.id,
      title: st.title,
      position: st.position
    });
  }

  return nextTask;
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

// --- Subtasks CRUD ---

function getSubtasksByTaskId(taskId) {
  return getDb().prepare('SELECT * FROM subtasks WHERE task_id = ? ORDER BY position ASC, created_at ASC').all(taskId);
}

function createSubtask({ taskId, title, position = 0 }) {
  const id = uuidv4();
  const now = new Date().toISOString();
  getDb().prepare(`
    INSERT INTO subtasks (id, task_id, title, completed, position, created_at)
    VALUES (?, ?, ?, 0, ?, ?)
  `).run(id, taskId, title.trim(), position, now);
  return getDb().prepare('SELECT * FROM subtasks WHERE id = ?').get(id);
}

function updateSubtask(id, updates) {
  const existing = getDb().prepare('SELECT * FROM subtasks WHERE id = ?').get(id);
  if (!existing) return null;

  const title = updates.title !== undefined ? updates.title : existing.title;
  const completed = updates.completed !== undefined ? (updates.completed ? 1 : 0) : existing.completed;
  const position = updates.position !== undefined ? updates.position : existing.position;

  getDb().prepare('UPDATE subtasks SET title = ?, completed = ?, position = ? WHERE id = ?')
    .run(title, completed, position, id);

  return getDb().prepare('SELECT * FROM subtasks WHERE id = ?').get(id);
}

function deleteSubtask(id) {
  const existing = getDb().prepare('SELECT * FROM subtasks WHERE id = ?').get(id);
  if (!existing) return null;
  getDb().prepare('DELETE FROM subtasks WHERE id = ?').run(id);
  return existing;
}

// --- Time Logs CRUD ---

function getTimeLogsByTaskId(taskId) {
  return getDb().prepare(`
    SELECT tl.*, u.name as user_name, u.avatar as user_avatar
    FROM time_logs tl
    LEFT JOIN users u ON tl.user_id = u.id
    WHERE tl.task_id = ?
    ORDER BY tl.created_at DESC
  `).all(taskId);
}

function createTimeLog({ taskId, userId, durationMinutes, notes = '' }) {
  const id = uuidv4();
  const now = new Date().toISOString();
  const mins = parseInt(durationMinutes, 10) || 0;

  getDb().prepare(`
    INSERT INTO time_logs (id, task_id, user_id, duration_minutes, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, taskId, userId || null, mins, notes, now);

  // Update actual_minutes on task
  getDb().prepare(`
    UPDATE tasks
    SET actual_minutes = (SELECT COALESCE(SUM(duration_minutes), 0) FROM time_logs WHERE task_id = ?),
        updated_at = ?
    WHERE id = ?
  `).run(taskId, now, taskId);

  return getDb().prepare('SELECT * FROM time_logs WHERE id = ?').get(id);
}

function deleteTimeLog(id) {
  const existing = getDb().prepare('SELECT * FROM time_logs WHERE id = ?').get(id);
  if (!existing) return null;
  const taskId = existing.task_id;
  getDb().prepare('DELETE FROM time_logs WHERE id = ?').run(id);

  // Recalculate actual_minutes
  const now = new Date().toISOString();
  getDb().prepare(`
    UPDATE tasks
    SET actual_minutes = (SELECT COALESCE(SUM(duration_minutes), 0) FROM time_logs WHERE task_id = ?),
        updated_at = ?
    WHERE id = ?
  `).run(taskId, now, taskId);

  return existing;
}

// --- Attachments CRUD ---

function getAttachmentsByTaskId(taskId) {
  return getDb().prepare('SELECT * FROM attachments WHERE task_id = ? ORDER BY created_at DESC').all(taskId);
}

function getAttachmentById(id) {
  return getDb().prepare('SELECT * FROM attachments WHERE id = ?').get(id);
}

function createAttachment({ taskId, filename, originalName, mimeType, sizeBytes, filePath, url }) {
  const id = uuidv4();
  const now = new Date().toISOString();
  getDb().prepare(`
    INSERT INTO attachments (id, task_id, filename, original_name, mime_type, size_bytes, file_path, url, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, taskId, filename, originalName, mimeType, sizeBytes, filePath, url, now);
  return getAttachmentById(id);
}

function deleteAttachment(id) {
  const existing = getAttachmentById(id);
  if (!existing) return null;
  getDb().prepare('DELETE FROM attachments WHERE id = ?').run(id);
  return existing;
}

// --- Users & Collaboration ---

function getAllUsers() {
  return getDb().prepare('SELECT id, name, email, role, avatar, api_key, created_at FROM users ORDER BY name ASC').all();
}

function getUserById(id) {
  return getDb().prepare('SELECT id, name, email, role, avatar, api_key, created_at FROM users WHERE id = ?').get(id);
}

function getUserByApiKey(apiKey) {
  return getDb().prepare('SELECT id, name, email, role, avatar, api_key, created_at FROM users WHERE api_key = ?').get(apiKey);
}

function createUser({ name, email, role = 'member', avatar = '👤' }) {
  const id = uuidv4();
  const apiKey = 'tk_live_' + uuidv4().replace(/-/g, '').slice(0, 18);
  const now = new Date().toISOString();
  getDb().prepare(`
    INSERT INTO users (id, name, email, role, avatar, api_key, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, name.trim(), email.trim().toLowerCase(), role, avatar, apiKey, now);
  return getUserById(id);
}

// --- Dynamic Columns & Custom Workflows ---

function getAllColumns() {
  return getDb().prepare('SELECT * FROM columns ORDER BY position ASC').all();
}

function createColumn({ key, title, position, color, wipLimit = 0 }) {
  const id = uuidv4();
  const cleanKey = key.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  const maxPos = getDb().prepare('SELECT COALESCE(MAX(position), -1) as max_pos FROM columns').get();
  const pos = position !== undefined ? position : (maxPos.max_pos + 1);

  getDb().prepare(`
    INSERT INTO columns (id, key, title, position, color, wip_limit)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, cleanKey, title.trim(), pos, color || 'var(--neon-cyan)', wipLimit || 0);

  return getDb().prepare('SELECT * FROM columns WHERE id = ?').get(id);
}

function updateColumn(id, updates) {
  const existing = getDb().prepare('SELECT * FROM columns WHERE id = ?').get(id);
  if (!existing) return null;

  const title = updates.title !== undefined ? updates.title : existing.title;
  const color = updates.color !== undefined ? updates.color : existing.color;
  const wip_limit = updates.wip_limit !== undefined ? updates.wip_limit : existing.wip_limit;
  const position = updates.position !== undefined ? updates.position : existing.position;

  getDb().prepare('UPDATE columns SET title = ?, color = ?, wip_limit = ?, position = ? WHERE id = ?')
    .run(title, color, wip_limit, position, id);

  return getDb().prepare('SELECT * FROM columns WHERE id = ?').get(id);
}

function deleteColumn(id) {
  const existing = getDb().prepare('SELECT * FROM columns WHERE id = ?').get(id);
  if (!existing) return null;
  getDb().prepare('DELETE FROM columns WHERE id = ?').run(id);
  return existing;
}

// --- Webhooks & Integrations ---

function getAllWebhooks() {
  return getDb().prepare('SELECT * FROM webhooks ORDER BY created_at DESC').all();
}

function createWebhook({ url, event = 'all', secret = '' }) {
  const id = uuidv4();
  const now = new Date().toISOString();
  getDb().prepare(`
    INSERT INTO webhooks (id, url, event, active, secret, created_at)
    VALUES (?, ?, ?, 1, ?, ?)
  `).run(id, url.trim(), event, secret, now);
  return getDb().prepare('SELECT * FROM webhooks WHERE id = ?').get(id);
}

function deleteWebhook(id) {
  const existing = getDb().prepare('SELECT * FROM webhooks WHERE id = ?').get(id);
  if (!existing) return null;
  getDb().prepare('DELETE FROM webhooks WHERE id = ?').run(id);
  return existing;
}

// --- Analytics & Reporting ---

function getAnalyticsSummary(days = 30) {
  const dbInst = getDb();

  // Basic counts
  const totals = dbInst.prepare(`
    SELECT
      COUNT(*) as total_tasks,
      SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as completed_tasks,
      SUM(CASE WHEN status != 'done' AND status != 'archived' THEN 1 ELSE 0 END) as active_tasks,
      SUM(CASE WHEN due_date IS NOT NULL AND due_date < datetime('now') AND status != 'done' AND status != 'archived' THEN 1 ELSE 0 END) as overdue_tasks,
      COALESCE(SUM(estimated_minutes), 0) as total_estimated_mins,
      COALESCE(SUM(actual_minutes), 0) as total_actual_mins
    FROM tasks
  `).get();

  // Tasks completed per day in the last N days
  const velocity = dbInst.prepare(`
    SELECT
      date(completed_at) as day,
      COUNT(*) as count
    FROM tasks
    WHERE completed_at IS NOT NULL
      AND completed_at >= datetime('now', '-' || ? || ' days')
    GROUP BY date(completed_at)
    ORDER BY day ASC
  `).all(days);

  // Priority breakdown
  const priorityDist = dbInst.prepare(`
    SELECT priority, COUNT(*) as count
    FROM tasks
    WHERE status != 'archived'
    GROUP BY priority
  `).all();

  // Status breakdown
  const statusDist = dbInst.prepare(`
    SELECT status, COUNT(*) as count
    FROM tasks
    GROUP BY status
  `).all();

  // Eisenhower Matrix breakdown
  const quadrantDist = dbInst.prepare(`
    SELECT COALESCE(eisenhower_quadrant, 'schedule') as quadrant, COUNT(*) as count
    FROM tasks
    WHERE status != 'done' AND status != 'archived'
    GROUP BY eisenhower_quadrant
  `).all();

  // Lead time (average hours from creation to completion)
  const leadTimeRow = dbInst.prepare(`
    SELECT
      AVG((julianday(completed_at) - julianday(created_at)) * 24) as avg_cycle_hours
    FROM tasks
    WHERE completed_at IS NOT NULL
  `).get();

  return {
    totals: {
      ...totals,
      completion_rate: totals.total_tasks > 0 ? Math.round((totals.completed_tasks / totals.total_tasks) * 100) : 0,
      avg_cycle_hours: leadTimeRow?.avg_cycle_hours ? Math.round(leadTimeRow.avg_cycle_hours * 10) / 10 : 0
    },
    velocity,
    priorityDist,
    statusDist,
    quadrantDist
  };
}

// --- Data Backup & Restore ---

function exportDatabaseBackup() {
  const dbInst = getDb();
  return {
    version: '2.0.0',
    exported_at: new Date().toISOString(),
    tasks: dbInst.prepare('SELECT * FROM tasks').all(),
    subtasks: dbInst.prepare('SELECT * FROM subtasks').all(),
    time_logs: dbInst.prepare('SELECT * FROM time_logs').all(),
    attachments: dbInst.prepare('SELECT * FROM attachments').all(),
    columns: dbInst.prepare('SELECT * FROM columns').all(),
    users: dbInst.prepare('SELECT * FROM users').all(),
    webhooks: dbInst.prepare('SELECT * FROM webhooks').all()
  };
}

function restoreDatabaseBackup(data) {
  const dbInst = getDb();
  if (!data || !data.tasks || !Array.isArray(data.tasks)) {
    throw new Error('Invalid backup payload: missing tasks array');
  }

  const runRestore = dbInst.transaction(() => {
    // Clear current data
    dbInst.exec('DELETE FROM subtasks');
    dbInst.exec('DELETE FROM time_logs');
    dbInst.exec('DELETE FROM attachments');
    dbInst.exec('DELETE FROM tasks');
    if (data.columns) dbInst.exec('DELETE FROM columns');
    if (data.users) dbInst.exec('DELETE FROM users');
    if (data.webhooks) dbInst.exec('DELETE FROM webhooks');

    // Restore Users
    if (Array.isArray(data.users)) {
      const insUser = dbInst.prepare('INSERT OR REPLACE INTO users (id, name, email, role, avatar, api_key, created_at) VALUES (@id, @name, @email, @role, @avatar, @api_key, @created_at)');
      for (const u of data.users) insUser.run(u);
    }

    // Restore Columns
    if (Array.isArray(data.columns)) {
      const insCol = dbInst.prepare('INSERT OR REPLACE INTO columns (id, key, title, position, color, wip_limit) VALUES (@id, @key, @title, @position, @color, @wip_limit)');
      for (const c of data.columns) insCol.run(c);
    }

    // Restore Tasks
    const insTask = dbInst.prepare(`
      INSERT OR REPLACE INTO tasks (
        id, title, description, status, priority, tags, due_date, created_at, updated_at, position, completed_at,
        recurrence_rule, eisenhower_quadrant, estimated_minutes, actual_minutes, custom_fields, assignee_id, share_token
      )
      VALUES (
        @id, @title, @description, @status, @priority, @tags, @due_date, @created_at, @updated_at, @position, @completed_at,
        @recurrence_rule, @eisenhower_quadrant, @estimated_minutes, @actual_minutes, @custom_fields, @assignee_id, @share_token
      )
    `);
    for (const t of data.tasks) {
      insTask.run({
        id: t.id,
        title: t.title,
        description: t.description || '',
        status: t.status || 'todo',
        priority: t.priority || 'medium',
        tags: t.tags || '[]',
        due_date: t.due_date || null,
        created_at: t.created_at || new Date().toISOString(),
        updated_at: t.updated_at || new Date().toISOString(),
        position: t.position || 0,
        completed_at: t.completed_at || null,
        recurrence_rule: t.recurrence_rule || 'none',
        eisenhower_quadrant: t.eisenhower_quadrant || 'schedule',
        estimated_minutes: t.estimated_minutes || 0,
        actual_minutes: t.actual_minutes || 0,
        custom_fields: t.custom_fields || '{}',
        assignee_id: t.assignee_id || null,
        share_token: t.share_token || null
      });
    }

    // Restore Subtasks
    if (Array.isArray(data.subtasks)) {
      const insSub = dbInst.prepare('INSERT OR REPLACE INTO subtasks (id, task_id, title, completed, position, created_at) VALUES (@id, @task_id, @title, @completed, @position, @created_at)');
      for (const st of data.subtasks) insSub.run(st);
    }

    // Restore Time Logs
    if (Array.isArray(data.time_logs)) {
      const insLog = dbInst.prepare('INSERT OR REPLACE INTO time_logs (id, task_id, user_id, duration_minutes, notes, created_at) VALUES (@id, @task_id, @user_id, @duration_minutes, @notes, @created_at)');
      for (const tl of data.time_logs) insLog.run(tl);
    }

    // Restore Attachments
    if (Array.isArray(data.attachments)) {
      const insAtt = dbInst.prepare('INSERT OR REPLACE INTO attachments (id, task_id, filename, original_name, mime_type, size_bytes, file_path, url, created_at) VALUES (@id, @task_id, @filename, @original_name, @mime_type, @size_bytes, @file_path, @url, @created_at)');
      for (const a of data.attachments) insAtt.run(a);
    }

    // Restore Webhooks
    if (Array.isArray(data.webhooks)) {
      const insWh = dbInst.prepare('INSERT OR REPLACE INTO webhooks (id, url, event, active, secret, created_at) VALUES (@id, @url, @event, @active, @secret, @created_at)');
      for (const w of data.webhooks) insWh.run(w);
    }
  });

  runRestore();
  return { success: true, restored_at: new Date().toISOString() };
}

// --- Legacy & Dashboard Stats ---

function getStats() {
  const stats = getDb().prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'todo' THEN 1 ELSE 0 END) as todo,
      SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
      SUM(CASE WHEN status = 'review' THEN 1 ELSE 0 END) as review,
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
  getTaskByShareToken,
  createTask,
  updateTask,
  deleteTask,
  reorderTasks,
  spawnNextRecurringTask,
  getSubtasksByTaskId,
  createSubtask,
  updateSubtask,
  deleteSubtask,
  getTimeLogsByTaskId,
  createTimeLog,
  deleteTimeLog,
  getAttachmentsByTaskId,
  getAttachmentById,
  createAttachment,
  deleteAttachment,
  getAllUsers,
  getUserById,
  getUserByApiKey,
  createUser,
  getAllColumns,
  createColumn,
  updateColumn,
  deleteColumn,
  getAllWebhooks,
  createWebhook,
  deleteWebhook,
  getAnalyticsSummary,
  exportDatabaseBackup,
  restoreDatabaseBackup,
  getStats,
  closeDb
};

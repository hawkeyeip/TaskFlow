/**
 * UI Components — Pure rendering functions for TaskFlow Enterprise
 */
const Components = (() => {

  const QUADRANT_CONFIG = {
    do_first: { label: 'Do First', icon: '🔥', class: 'quadrant-q1' },
    schedule: { label: 'Schedule', icon: '📅', class: 'quadrant-q2' },
    delegate: { label: 'Delegate', icon: '👥', class: 'quadrant-q3' },
    eliminate: { label: 'Eliminate', icon: '🗑️', class: 'quadrant-q4' }
  };

  /**
   * Render a single task card for Kanban Board
   */
  function taskCard(task, isSelected = false, isTimerActive = false) {
    const el = document.createElement('div');
    el.className = `task-card priority-${task.priority} status-${task.status} ${isSelected ? 'selected' : ''}`;
    el.dataset.id = task.id;
    el.draggable = true;

    const tags = Array.isArray(task.tags) ? task.tags : [];
    const dueDateHTML = task.due_date ? formatDueDate(task.due_date) : '';
    const tagsHTML = tags.map(t => `<span class="task-tag">${escapeHtml(t)}</span>`).join('');

    // Assignee
    const assigneeHTML = task.assignee_name
      ? `<span class="task-assignee-pill" title="Assigned to ${escapeHtml(task.assignee_name)}">${task.assignee_avatar || '👤'} <span class="assignee-text">${escapeHtml(task.assignee_name)}</span></span>`
      : '';

    // Quadrant
    const quad = QUADRANT_CONFIG[task.eisenhower_quadrant] || QUADRANT_CONFIG.schedule;
    const quadrantHTML = `<span class="task-quadrant-badge ${quad.class}" title="Eisenhower: ${quad.label}">${quad.icon} ${quad.label}</span>`;

    // Recurrence
    const recurrenceHTML = (task.recurrence_rule && task.recurrence_rule !== 'none')
      ? `<span class="task-recurrence-badge" title="Recurring: ${task.recurrence_rule}">🔁 ${task.recurrence_rule}</span>`
      : '';

    // Subtasks Progress
    let subtaskHTML = '';
    const totalSub = task.subtask_count || 0;
    const completedSub = task.subtask_completed || 0;
    if (totalSub > 0) {
      const pct = Math.round((completedSub / totalSub) * 100);
      subtaskHTML = `
        <div class="task-subtask-progress" title="${completedSub} of ${totalSub} subtasks completed">
          <div class="subtask-info">
            <span>✓ ${completedSub}/${totalSub}</span>
            <span>${pct}%</span>
          </div>
          <div class="subtask-bar-track">
            <div class="subtask-bar-fill" style="width: ${pct}%"></div>
          </div>
        </div>
      `;
    }

    // Time Tracking
    const est = task.estimated_minutes || 0;
    const act = (task.actual_minutes || 0) + (task.logged_minutes || 0);
    let timeHTML = '';
    if (est > 0 || act > 0) {
      timeHTML = `
        <div class="task-time-badge" title="Time: ${act}m logged / ${est}m estimated">
          ⏱️ ${act}m${est > 0 ? ` / ${est}m` : ''}
        </div>
      `;
    }

    // Attachments badge
    const attCount = task.attachment_count || 0;
    const attachmentHTML = attCount > 0
      ? `<span class="task-attachment-badge" title="${attCount} attachment(s)">📎 ${attCount}</span>`
      : '';

    // Custom Fields
    let customFieldsHTML = '';
    let cf = {};
    try {
      cf = typeof task.custom_fields === 'string' ? JSON.parse(task.custom_fields || '{}') : (task.custom_fields || {});
    } catch (e) {}

    const cfEntries = Object.entries(cf);
    if (cfEntries.length > 0) {
      customFieldsHTML = '<div class="task-custom-fields">' +
        cfEntries.slice(0, 3).map(([k, v]) => `<span class="cf-pill"><strong>${escapeHtml(k)}:</strong> ${escapeHtml(String(v))}</span>`).join('') +
        '</div>';
    }

    el.innerHTML = `
      <div class="task-card-header">
        <div class="task-card-badges">
          <span class="task-priority-badge ${task.priority}">${task.priority}</span>
          ${recurrenceHTML}
        </div>
        <div class="task-card-actions">
          <button class="btn btn-ghost btn-icon btn-timer ${isTimerActive ? 'active' : ''}" data-id="${task.id}" title="${isTimerActive ? 'Pause Stopwatch' : 'Start Stopwatch'}">${isTimerActive ? '⏸️' : '⏱️'}</button>
          <button class="btn btn-ghost btn-icon btn-share" data-id="${task.id}" title="Share Task" aria-label="Share task">🔗</button>
          <button class="btn btn-ghost btn-icon btn-edit" data-id="${task.id}" title="Edit task" aria-label="Edit task">✏️</button>
          <button class="btn btn-ghost btn-icon btn-delete" data-id="${task.id}" title="Delete task" aria-label="Delete task">🗑</button>
        </div>
      </div>

      <div class="task-title">${escapeHtml(task.title)}</div>
      ${task.description ? `<p class="task-description">${escapeHtml(task.description)}</p>` : ''}

      ${subtaskHTML}
      ${customFieldsHTML}

      <div class="task-meta">
        ${assigneeHTML}
        ${quadrantHTML}
        ${timeHTML}
        ${attachmentHTML}
        ${tagsHTML}
        ${dueDateHTML}
      </div>
    `;

    return el;
  }

  /**
   * Render compact card for Eisenhower Matrix view
   */
  function matrixCard(task) {
    const el = document.createElement('div');
    el.className = `matrix-card priority-${task.priority}`;
    el.dataset.id = task.id;
    el.draggable = true;

    const dueDate = task.due_date ? `<span class="matrix-due">📅 ${task.due_date}</span>` : '';
    const assignee = task.assignee_name ? `<span class="matrix-assignee">${task.assignee_avatar || '👤'}</span>` : '';

    el.innerHTML = `
      <div class="matrix-card-top">
        <span class="matrix-title">${escapeHtml(task.title)}</span>
        <div class="matrix-actions">
          <button class="btn btn-ghost btn-icon btn-edit" data-id="${task.id}" title="Edit">✏️</button>
        </div>
      </div>
      <div class="matrix-card-bottom">
        <span class="task-priority-badge ${task.priority}">${task.priority}</span>
        ${assignee}
        ${dueDate}
      </div>
    `;
    return el;
  }

  /**
   * Subtask Item rendering
   */
  function subtaskItem(subtask) {
    const el = document.createElement('div');
    el.className = `subtask-row ${subtask.completed ? 'completed' : ''}`;
    el.dataset.id = subtask.id;
    el.innerHTML = `
      <input type="checkbox" class="subtask-checkbox" data-id="${subtask.id}" ${subtask.completed ? 'checked' : ''}>
      <span class="subtask-text">${escapeHtml(subtask.title)}</span>
      <button type="button" class="btn btn-ghost btn-icon subtask-delete" data-id="${subtask.id}" title="Delete subtask">✕</button>
    `;
    return el;
  }

  /**
   * Attachment Item rendering
   */
  function attachmentItem(att) {
    const el = document.createElement('div');
    el.className = 'attachment-row';
    el.dataset.id = att.id;

    const isLink = att.mime_type === 'text/uri-list' || !att.size_bytes;
    const icon = isLink ? '🔗' : (att.mime_type && att.mime_type.startsWith('image/') ? '🖼️' : '📄');
    const sizeStr = isLink ? 'Web Link' : formatBytes(att.size_bytes);

    el.innerHTML = `
      <span class="attachment-icon">${icon}</span>
      <div class="attachment-info">
        <a href="${att.url || `/api/attachments/${att.id}/download`}" target="_blank" class="attachment-link" download>
          ${escapeHtml(att.original_name || att.filename)}
        </a>
        <span class="attachment-size">${sizeStr}</span>
      </div>
      <button type="button" class="btn btn-ghost btn-icon attachment-delete" data-id="${att.id}" title="Delete attachment">✕</button>
    `;
    return el;
  }

  /**
   * Time Log Item rendering
   */
  function timeLogItem(log) {
    const el = document.createElement('div');
    el.className = 'timelog-row';
    el.dataset.id = log.id;
    el.innerHTML = `
      <span class="timelog-avatar">${log.user_avatar || '⏱️'}</span>
      <div class="timelog-info">
        <strong>${log.duration_minutes} mins</strong> ${log.notes ? `— <em>${escapeHtml(log.notes)}</em>` : ''}
        <span class="timelog-date">${new Date(log.created_at).toLocaleDateString()} ${new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
      <button type="button" class="btn btn-ghost btn-icon timelog-delete" data-id="${log.id}" title="Delete time log">✕</button>
    `;
    return el;
  }

  /**
   * Format due date with overdue detection
   */
  function formatDueDate(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const isOverdue = date < now;
    const diff = Math.ceil((date - now) / (1000 * 60 * 60 * 24));

    let label;
    if (diff === 0) label = 'Today';
    else if (diff === 1) label = 'Tomorrow';
    else if (diff === -1) label = 'Yesterday';
    else if (diff > 1 && diff <= 7) label = `In ${diff} days`;
    else if (diff < -1) label = `${Math.abs(diff)} days ago`;
    else label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    return `<span class="task-due-date ${isOverdue ? 'overdue' : ''}">📅 ${label}</span>`;
  }

  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Render empty column state
   */
  function emptyState(status, message = null) {
    const messages = {
      todo: { icon: '📋', text: 'No tasks to do yet' },
      in_progress: { icon: '🚀', text: 'Nothing in progress' },
      review: { icon: '🔍', text: 'Nothing in review' },
      done: { icon: '🎉', text: 'No completed tasks' }
    };
    const m = message ? { icon: '✨', text: message } : (messages[status] || { icon: '📁', text: 'Column is empty' });

    const el = document.createElement('div');
    el.className = 'column-empty';
    el.innerHTML = `
      <div class="column-empty-icon">${m.icon}</div>
      <span>${m.text}</span>
    `;
    return el;
  }

  /**
   * Render loading skeleton cards
   */
  function skeletons(count = 2) {
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.className = 'skeleton skeleton-card';
      fragment.appendChild(el);
    }
    return fragment;
  }

  /**
   * Render a toast notification
   */
  function toast(message, type = 'info') {
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };

    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <span class="toast-message">${escapeHtml(message)}</span>
      <button class="toast-dismiss" aria-label="Dismiss">✕</button>
    `;

    return el;
  }

  /**
   * Render a tag pill for the form
   */
  function tagPill(tag) {
    const el = document.createElement('span');
    el.className = 'tag-pill';
    el.innerHTML = `
      ${escapeHtml(tag)}
      <button type="button" class="tag-pill-remove" data-tag="${escapeHtml(tag)}" aria-label="Remove tag ${escapeHtml(tag)}">×</button>
    `;
    return el;
  }

  /**
   * Escape HTML to prevent XSS
   */
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return {
    taskCard,
    matrixCard,
    subtaskItem,
    attachmentItem,
    timeLogItem,
    emptyState,
    skeletons,
    toast,
    tagPill,
    escapeHtml,
    QUADRANT_CONFIG
  };
})();

/**
 * UI Components — pure rendering functions
 */
const Components = (() => {

  /**
   * Render a single task card
   */
  function taskCard(task) {
    const el = document.createElement('div');
    el.className = `task-card priority-${task.priority} status-${task.status}`;
    el.dataset.id = task.id;
    el.draggable = true;

    const tags = Array.isArray(task.tags) ? task.tags : [];
    const dueDateHTML = task.due_date ? formatDueDate(task.due_date) : '';
    const tagsHTML = tags.map(t => `<span class="task-tag">${escapeHtml(t)}</span>`).join('');

    el.innerHTML = `
      <div class="task-card-header">
        <span class="task-title">${escapeHtml(task.title)}</span>
        <div class="task-card-actions">
          <button class="btn btn-ghost btn-icon btn-edit" data-id="${task.id}" title="Edit task" aria-label="Edit task">✏️</button>
          <button class="btn btn-ghost btn-icon btn-delete" data-id="${task.id}" title="Delete task" aria-label="Delete task">🗑</button>
        </div>
      </div>
      ${task.description ? `<p class="task-description">${escapeHtml(task.description)}</p>` : ''}
      <div class="task-meta">
        <span class="task-priority-badge ${task.priority}">${task.priority}</span>
        ${tagsHTML}
        ${dueDateHTML}
      </div>
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

  /**
   * Render empty column state
   */
  function emptyState(status) {
    const messages = {
      todo: { icon: '📋', text: 'No tasks to do yet' },
      in_progress: { icon: '🚀', text: 'Nothing in progress' },
      done: { icon: '🎉', text: 'No completed tasks' }
    };
    const m = messages[status] || messages.todo;

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
  function skeletons(count = 3) {
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
    emptyState,
    skeletons,
    toast,
    tagPill,
    escapeHtml
  };
})();

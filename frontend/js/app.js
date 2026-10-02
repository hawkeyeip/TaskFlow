/**
 * Task Manager — Main Application Logic
 * Orchestrates data flow, event handling, drag-and-drop, and UI updates.
 */
;(function () {
  'use strict';

  // --- State ---
  let tasks = [];
  let currentTags = [];
  let editingTaskId = null;
  let deleteTargetId = null;
  let searchDebounce = null;

  // --- DOM References ---
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const dom = {
    // Columns
    todoCol: $('#tasks-todo'),
    progressCol: $('#tasks-progress'),
    doneCol: $('#tasks-done'),
    // Counts
    countTodo: $('#count-todo'),
    countProgress: $('#count-progress'),
    countDone: $('#count-done'),
    // Stats
    statTodo: $('#stat-todo'),
    statProgress: $('#stat-progress'),
    statDone: $('#stat-done'),
    statOverdue: $('#stat-overdue'),
    // Toolbar
    searchInput: $('#search-input'),
    filterPriority: $('#filter-priority'),
    sortSelect: $('#sort-select'),
    // FAB
    fab: $('#fab-add'),
    // Task Modal
    taskModal: $('#task-modal'),
    modalTitle: $('#modal-title'),
    taskForm: $('#task-form'),
    taskId: $('#task-id'),
    taskTitle: $('#task-title-input'),
    taskDesc: $('#task-desc-input'),
    taskPriority: $('#task-priority-input'),
    taskStatus: $('#task-status-input'),
    taskDue: $('#task-due-input'),
    tagInput: $('#tag-input'),
    tagContainer: $('#tag-container'),
    btnSave: $('#btn-save-task'),
    btnCancel: $('#btn-cancel-task'),
    modalClose: $('#modal-close'),
    // Delete Modal
    deleteModal: $('#delete-modal'),
    deleteTaskName: $('#delete-task-name'),
    btnConfirmDelete: $('#btn-confirm-delete'),
    btnCancelDelete: $('#btn-cancel-delete'),
    // Toast
    toastContainer: $('#toast-container'),
    // Wear OS Companion
    btnWearCompanion: $('#btn-wear-companion'),
    wearModal: $('#wear-modal'),
    wearModalClose: $('#wear-modal-close'),
    wearContent: $('#wear-content'),
    wearClock: $('#wear-clock'),
    wearDockBtns: $('.wear-dock-btn'),
  };

  // --- Init ---
  async function init() {
    showSkeletons();
    bindEvents();
    await loadTasks();
    await loadStats();
  }

  // --- Data Loading ---
  async function loadTasks() {
    try {
      const filters = getFilters();
      tasks = await API.getTasks(filters);
      renderBoard();
    } catch (err) {
      showToast('Failed to load tasks: ' + err.message, 'error');
    }
  }

  async function loadStats() {
    try {
      const stats = await API.getStats();
      dom.statTodo.textContent = stats.todo || 0;
      dom.statProgress.textContent = stats.in_progress || 0;
      dom.statDone.textContent = stats.done || 0;
      dom.statOverdue.textContent = stats.overdue || 0;
    } catch (err) {
      // Silent failure for stats
    }
  }

  function getFilters() {
    return {
      priority: dom.filterPriority.value,
      search: dom.searchInput.value.trim(),
      sort: dom.sortSelect.value,
      order: 'asc'
    };
  }

  // --- Rendering ---
  function renderBoard() {
    const grouped = {
      todo: tasks.filter(t => t.status === 'todo'),
      in_progress: tasks.filter(t => t.status === 'in_progress'),
      done: tasks.filter(t => t.status === 'done')
    };

    renderColumn(dom.todoCol, grouped.todo, 'todo');
    renderColumn(dom.progressCol, grouped.in_progress, 'in_progress');
    renderColumn(dom.doneCol, grouped.done, 'done');

    dom.countTodo.textContent = grouped.todo.length;
    dom.countProgress.textContent = grouped.in_progress.length;
    dom.countDone.textContent = grouped.done.length;
  }

  function renderColumn(container, columnTasks, status) {
    container.innerHTML = '';
    if (columnTasks.length === 0) {
      container.appendChild(Components.emptyState(status));
      return;
    }
    columnTasks.forEach(task => {
      container.appendChild(Components.taskCard(task));
    });
  }

  function showSkeletons() {
    [dom.todoCol, dom.progressCol, dom.doneCol].forEach(col => {
      col.innerHTML = '';
      col.appendChild(Components.skeletons(2));
    });
  }

  // --- Event Binding ---
  function bindEvents() {
    // FAB opens create modal
    dom.fab.addEventListener('click', () => openCreateModal());

    // Modal controls
    dom.modalClose.addEventListener('click', closeTaskModal);
    dom.btnCancel.addEventListener('click', closeTaskModal);
    dom.taskModal.addEventListener('click', (e) => {
      if (e.target === dom.taskModal) closeTaskModal();
    });

    // Form submit
    dom.taskForm.addEventListener('submit', handleFormSubmit);

    // Tag input
    dom.tagInput.addEventListener('keydown', handleTagInput);
    dom.tagContainer.addEventListener('click', handleTagRemove);

    // Search with debounce
    dom.searchInput.addEventListener('input', () => {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        loadTasks();
      }, 300);
    });

    // Filters
    dom.filterPriority.addEventListener('change', () => loadTasks());
    dom.sortSelect.addEventListener('change', () => loadTasks());

    // Delete modal
    dom.btnCancelDelete.addEventListener('click', closeDeleteModal);
    dom.deleteModal.addEventListener('click', (e) => {
      if (e.target === dom.deleteModal) closeDeleteModal();
    });
    dom.btnConfirmDelete.addEventListener('click', handleConfirmDelete);

    // Wear OS Companion
    if (dom.btnWearCompanion) {
      dom.btnWearCompanion.addEventListener('click', openWearModal);
    }
    if (dom.wearModalClose) {
      dom.wearModalClose.addEventListener('click', closeWearModal);
    }
    if (dom.wearModal) {
      dom.wearModal.addEventListener('click', (e) => {
        if (e.target === dom.wearModal) closeWearModal();
      });
    }
    dom.wearDockBtns.forEach(btn => {
      btn.addEventListener('click', () => switchWearTab(btn.dataset.tab));
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboard);

    // Delegated card actions
    document.addEventListener('click', (e) => {
      const editBtn = e.target.closest('.btn-edit');
      if (editBtn) {
        e.stopPropagation();
        openEditModal(editBtn.dataset.id);
        return;
      }
      const deleteBtn = e.target.closest('.btn-delete');
      if (deleteBtn) {
        e.stopPropagation();
        openDeleteModal(deleteBtn.dataset.id);
        return;
      }
    });

    // Drag and drop
    setupDragAndDrop();
  }

  // --- Modal Management ---
  function openCreateModal() {
    editingTaskId = null;
    dom.modalTitle.textContent = 'New Task';
    dom.btnSave.textContent = 'Create Task';
    dom.taskForm.reset();
    dom.taskId.value = '';
    dom.taskPriority.value = 'medium';
    dom.taskStatus.value = 'todo';
    currentTags = [];
    renderTags();
    dom.taskModal.classList.add('active');
    setTimeout(() => dom.taskTitle.focus(), 200);
  }

  function openEditModal(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    editingTaskId = id;
    dom.modalTitle.textContent = 'Edit Task';
    dom.btnSave.textContent = 'Save Changes';
    dom.taskId.value = task.id;
    dom.taskTitle.value = task.title;
    dom.taskDesc.value = task.description || '';
    dom.taskPriority.value = task.priority;
    dom.taskStatus.value = task.status;
    dom.taskDue.value = task.due_date || '';
    currentTags = Array.isArray(task.tags) ? [...task.tags] : [];
    renderTags();
    dom.taskModal.classList.add('active');
    setTimeout(() => dom.taskTitle.focus(), 200);
  }

  function closeTaskModal() {
    dom.taskModal.classList.remove('active');
    editingTaskId = null;
    currentTags = [];
  }

  function openDeleteModal(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    deleteTargetId = id;
    dom.deleteTaskName.textContent = `"${task.title}"`;
    dom.deleteModal.classList.add('active');
  }

  function closeDeleteModal() {
    dom.deleteModal.classList.remove('active');
    deleteTargetId = null;
  }

  // --- Form Handling ---
  async function handleFormSubmit(e) {
    e.preventDefault();
    const title = dom.taskTitle.value.trim();
    if (!title) return;

    const payload = {
      title,
      description: dom.taskDesc.value.trim(),
      priority: dom.taskPriority.value,
      status: dom.taskStatus.value,
      due_date: dom.taskDue.value || null,
      tags: [...currentTags]
    };

    try {
      if (editingTaskId) {
        await API.updateTask(editingTaskId, payload);
        showToast('Task updated successfully', 'success');
      } else {
        await API.createTask(payload);
        showToast('Task created successfully', 'success');
      }
      closeTaskModal();
      await loadTasks();
      await loadStats();
    } catch (err) {
      showToast('Failed to save task: ' + err.message, 'error');
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTargetId) return;
    try {
      await API.deleteTask(deleteTargetId);
      showToast('Task deleted', 'success');
      closeDeleteModal();
      await loadTasks();
      await loadStats();
    } catch (err) {
      showToast('Failed to delete task: ' + err.message, 'error');
    }
  }

  // --- Tags ---
  function handleTagInput(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = dom.tagInput.value.trim().replace(',', '');
      if (val && !currentTags.includes(val)) {
        currentTags.push(val);
        renderTags();
      }
      dom.tagInput.value = '';
    }
    if (e.key === 'Backspace' && dom.tagInput.value === '' && currentTags.length) {
      currentTags.pop();
      renderTags();
    }
  }

  function handleTagRemove(e) {
    const removeBtn = e.target.closest('.tag-pill-remove');
    if (!removeBtn) return;
    const tag = removeBtn.dataset.tag;
    currentTags = currentTags.filter(t => t !== tag);
    renderTags();
  }

  function renderTags() {
    // Remove existing tag pills but keep the input
    dom.tagContainer.querySelectorAll('.tag-pill').forEach(el => el.remove());
    // Insert before the input
    currentTags.forEach(tag => {
      dom.tagContainer.insertBefore(Components.tagPill(tag), dom.tagInput);
    });
  }

  // --- Drag & Drop ---
  function setupDragAndDrop() {
    const columns = $$('.column-tasks');
    let draggedEl = null;

    document.addEventListener('dragstart', (e) => {
      const card = e.target.closest('.task-card');
      if (!card) return;
      draggedEl = card;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', card.dataset.id);
    });

    document.addEventListener('dragend', (e) => {
      if (draggedEl) {
        draggedEl.classList.remove('dragging');
        draggedEl = null;
      }
      columns.forEach(col => col.closest('.board-column').classList.remove('drag-over'));
    });

    columns.forEach(col => {
      col.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        col.closest('.board-column').classList.add('drag-over');
      });

      col.addEventListener('dragleave', (e) => {
        // Only remove if actually leaving the column
        if (!col.contains(e.relatedTarget)) {
          col.closest('.board-column').classList.remove('drag-over');
        }
      });

      col.addEventListener('drop', async (e) => {
        e.preventDefault();
        col.closest('.board-column').classList.remove('drag-over');

        const taskId = e.dataTransfer.getData('text/plain');
        const newStatus = col.dataset.status;
        if (!taskId || !newStatus) return;

        try {
          await API.updateTask(taskId, { status: newStatus });
          showToast(`Task moved to ${formatStatus(newStatus)}`, 'success');
          await loadTasks();
          await loadStats();
        } catch (err) {
          showToast('Failed to move task: ' + err.message, 'error');
        }
      });
    });
  }

  function formatStatus(status) {
    const labels = {
      todo: 'To Do',
      in_progress: 'In Progress',
      done: 'Done'
    };
    return labels[status] || status;
  }

  // --- Keyboard Shortcuts ---
  function handleKeyboard(e) {
    // Escape to close modals
    if (e.key === 'Escape') {
      if (dom.taskModal.classList.contains('active')) closeTaskModal();
      if (dom.deleteModal.classList.contains('active')) closeDeleteModal();
      if (dom.wearModal && dom.wearModal.classList.contains('active')) closeWearModal();
    }
    // Ctrl+N or Cmd+N to create
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      openCreateModal();
    }
    // / to focus search
    if (e.key === '/' && !e.target.closest('input, textarea, select')) {
      e.preventDefault();
      dom.searchInput.focus();
    }
  }


  // --- Wear OS Smartwatch Companion Controller ---
  let activeWearTab = 'tasks';
  let wearClockTimer = null;

  function updateWearClock() {
    if (dom.wearClock) {
      const now = new Date();
      dom.wearClock.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  }

  async function openWearModal() {
    updateWearClock();
    clearInterval(wearClockTimer);
    wearClockTimer = setInterval(updateWearClock, 10000);
    dom.wearModal.classList.add('active');
    await renderActiveWearTab();
  }

  function closeWearModal() {
    dom.wearModal.classList.remove('active');
    clearInterval(wearClockTimer);
  }

  async function switchWearTab(tab) {
    activeWearTab = tab;
    dom.wearDockBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    await renderActiveWearTab();
  }

  async function renderActiveWearTab() {
    if (!dom.wearContent) return;

    if (activeWearTab === 'tasks') {
      dom.wearContent.innerHTML = '<div style="text-align:center; padding: 20px; font-size:10px; color:#888;">Syncing with wrist...</div>';
      try {
        const res = await API.getWearTasks();
        const wearTasks = res.tasks || [];
        if (wearTasks.length === 0) {
          dom.wearContent.innerHTML = '<div style="text-align:center; padding: 30px 10px; font-size:11px; color:#00ff88;">All duties done! ✨</div>';
          return;
        }

        dom.wearContent.innerHTML = '';
        wearTasks.forEach(task => {
          const item = document.createElement('div');
          item.className = 'wear-task-item' + (task.completed ? ' done' : '');
          item.innerHTML = `
            <span class="wear-task-dot ${task.priority}"></span>
            <span class="wear-task-text" style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${Components.escapeHtml(task.title)}</span>
            <span style="font-size:10px; color:${task.completed ? '#00ff88' : '#888'};">${task.completed ? '✓' : '○'}</span>
          `;

          item.addEventListener('click', async () => {
            await API.toggleWearTask(task.id);
            await renderActiveWearTab();
            await loadTasks();
            await loadStats();
          });

          dom.wearContent.appendChild(item);
        });
      } catch (err) {
        dom.wearContent.innerHTML = '<div style="color:#ff1744; font-size:10px; text-align:center;">Sync failed</div>';
      }
    } else if (activeWearTab === 'voice') {
      dom.wearContent.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; gap:8px; text-align:center;">
          <button id="btn-wear-mic" style="width:48px; height:48px; border-radius:50%; background:rgba(179,71,255,0.25); border:1px solid #b347ff; color:#b347ff; font-size:20px; cursor:pointer; display:flex; align-items:center; justify-content:center;">🎙️</button>
          <div id="wear-voice-hint" style="font-size:10px; color:#aaa; padding:0 6px;">Tap mic to dictate task</div>
        </div>
      `;

      const micBtn = dom.wearContent.querySelector('#btn-wear-mic');
      const hint = dom.wearContent.querySelector('#wear-voice-hint');
      micBtn.addEventListener('click', async () => {
        micBtn.style.boxShadow = '0 0 15px #b347ff';
        hint.textContent = 'Listening to wrist audio...';

        setTimeout(async () => {
          const sampleTasks = [
            'Review quarterly cloud budget',
            'Follow up with client contract',
            'Deploy security hotfix',
            'Schedule design sprint review'
          ];
          const chosen = sampleTasks[Math.floor(Math.random() * sampleTasks.length)];
          hint.textContent = `"Captured: ${chosen}"`;

          await API.quickAddWearTask(chosen);
          showToast(`Captured from Wear OS: "${chosen}"`, 'success');
          await loadTasks();
          await loadStats();

          setTimeout(() => switchWearTab('tasks'), 1000);
        }, 1200);
      });
    } else if (activeWearTab === 'tile') {
      try {
        const tile = await API.getWearTile();
        dom.wearContent.innerHTML = `
          <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding: 4px;">
            <div style="font-size:9px; font-weight:700; color:#00f0ff; letter-spacing:1px; margin-bottom:2px;">⚡ TASKFLOW TILE</div>
            <div style="font-size:18px; font-weight:800; color:#b347ff;">${tile.pendingCount} <span style="font-size:10px; font-weight:400; color:#aaa;">duties left</span></div>
            <div style="width:100%; border-top:1px solid rgba(255,255,255,0.1); margin:6px 0;"></div>
            ${(tile.tasks || []).map(t => `<div style="font-size:9.5px; color:#eee; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-bottom:2px;">• ${Components.escapeHtml(t.title)}</div>`).join('')}
          </div>
        `;
      } catch (err) {
        dom.wearContent.innerHTML = '<div style="color:#ff1744; font-size:10px;">Tile load failed</div>';
      }
    }
  }

  // --- Toast Notifications ---
  function showToast(message, type = 'info') {
    const toast = Components.toast(message, type);
    dom.toastContainer.appendChild(toast);

    // Dismiss button
    toast.querySelector('.toast-dismiss').addEventListener('click', () => {
      toast.classList.add('removing');
      setTimeout(() => toast.remove(), 200);
    });

    // Auto dismiss
    setTimeout(() => {
      if (toast.parentNode) {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 200);
      }
    }, 4000);
  }

  // --- Boot ---
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

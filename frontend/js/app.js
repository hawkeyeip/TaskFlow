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

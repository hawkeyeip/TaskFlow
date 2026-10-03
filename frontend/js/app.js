/**
 * TaskFlow Enterprise — Main Application Controller
 * Handles Multi-User Collaboration, Eisenhower Matrix, Analytics,
 * Time Tracking, Subtasks, Attachments, Keyboard Shortcuts & Theme.
 */
;(function () {
  'use strict';

  // --- State ---
  let tasks = [];
  let columns = [];
  let users = [];
  let currentUserId = 'user-1';
  let currentView = 'board';
  let currentTheme = localStorage.getItem('taskflow_theme') || 'dark';
  let selectedTaskId = null;
  let editingTaskId = null;
  let deleteTargetId = null;
  let currentTags = [];
  let currentSubtasks = [];
  let currentAttachments = [];
  let searchDebounce = null;

  // Stopwatch Timer State
  let activeTimerTaskId = null;
  let timerInterval = null;
  let timerSeconds = 0;

  // Wear OS Tab State
  let activeWearTab = 'tasks';

  // --- DOM References ---
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const dom = {
    // Header & Views
    navTabs: $$('.nav-tab'),
    views: {
      board: $('#view-board'),
      matrix: $('#view-matrix'),
      analytics: $('#view-analytics')
    },
    userSwitcher: $('#user-switcher'),
    btnThemeToggle: $('#btn-theme-toggle'),
    themeIcon: $('#theme-icon'),
    btnShortcuts: $('#btn-shortcuts'),
    btnTour: $('#btn-tour'),
    btnSettings: $('#btn-settings'),
    btnWearCompanion: $('#btn-wear-companion'),

    // Board View
    boardContainer: $('#board-columns-container'),
    statTodo: $('#stat-todo'),
    statProgress: $('#stat-progress'),
    statReview: $('#stat-review'),
    statDone: $('#stat-done'),
    statOverdue: $('#stat-overdue'),
    searchInput: $('#search-input'),
    filterAssignee: $('#filter-assignee'),
    filterPriority: $('#filter-priority'),
    filterQuadrant: $('#filter-quadrant'),
    sortSelect: $('#sort-select'),
    btnAddColumn: $('#btn-add-column'),
    fabAdd: $('#fab-add'),

    // Matrix View
    btnMatrixNewTask: $('#btn-matrix-new-task'),
    quadrantTasks: {
      do_first: $('#tasks-q1'),
      schedule: $('#tasks-q2'),
      delegate: $('#tasks-q3'),
      eliminate: $('#tasks-q4')
    },
    quadrantCounts: {
      do_first: $('#count-q1'),
      schedule: $('#count-q2'),
      delegate: $('#count-q3'),
      eliminate: $('#count-q4')
    },

    // Analytics View
    analyticsRange: $('#analytics-range'),
    kpiCompletionRate: $('#kpi-completion-rate'),
    kpiCompleted: $('#kpi-completed'),
    kpiActive: $('#kpi-active'),
    kpiOverdue: $('#kpi-overdue'),
    kpiCycleTime: $('#kpi-cycle-time'),
    kpiTimeRatio: $('#kpi-time-ratio'),
    chartVelocity: $('#chart-velocity'),
    chartPriority: $('#chart-priority'),
    chartStatus: $('#chart-status'),
    chartQuadrant: $('#chart-quadrant'),

    // Task Modal
    taskModal: $('#task-modal'),
    modalTitle: $('#modal-title'),
    modalClose: $('#modal-close'),
    taskForm: $('#task-form'),
    taskId: $('#task-id'),
    taskTitle: $('#task-title-input'),
    taskDesc: $('#task-desc-input'),
    taskPriority: $('#task-priority-input'),
    taskStatus: $('#task-status-input'),
    taskAssignee: $('#task-assignee-input'),
    taskRecurrence: $('#task-recurrence-input'),
    taskDue: $('#task-due-input'),
    taskQuadrant: $('#task-quadrant-input'),
    taskEstTime: $('#task-est-time'),
    quickLogMinutes: $('#quick-log-minutes'),
    btnQuickLogTime: $('#btn-quick-log-time'),
    subtasksSection: $('#section-subtasks'),
    subtasksList: $('#subtasks-list'),
    subtasksCountPill: $('#subtasks-count-pill'),
    newSubtaskTitle: $('#new-subtask-title'),
    btnAddSubtask: $('#btn-add-subtask'),
    attachmentsSection: $('#section-attachments'),
    attachmentsList: $('#attachments-list'),
    attachmentsCountPill: $('#attachments-count-pill'),
    fileUploadInput: $('#file-upload-input'),
    btnTriggerUpload: $('#btn-trigger-upload'),
    btnAddWeblink: $('#btn-add-weblink'),
    cfClient: $('#cf-client'),
    cfBudget: $('#cf-budget'),
    cfPoints: $('#cf-points'),
    cfRisk: $('#cf-risk'),
    tagInput: $('#tag-input'),
    tagContainer: $('#tag-container'),
    shareLinkBox: $('#share-link-box'),
    shareLinkInput: $('#share-link-input'),
    btnCopyShareToken: $('#btn-copy-share-token'),
    btnSaveTask: $('#btn-save-task'),
    btnCancelTask: $('#btn-cancel-task'),

    // Delete Modal
    deleteModal: $('#delete-modal'),
    deleteTaskName: $('#delete-task-name'),
    btnCancelDelete: $('#btn-cancel-delete'),
    btnConfirmDelete: $('#btn-confirm-delete'),

    // Settings Modal
    settingsModal: $('#settings-modal'),
    settingsModalClose: $('#settings-modal-close'),
    btnCloseSettings: $('#btn-close-settings'),
    calFeedUrl: $('#cal-feed-url'),
    btnCopyCalUrl: $('#btn-copy-cal-url'),
    currentUserApiKey: $('#current-user-apikey'),
    btnCopyApiKey: $('#btn-copy-apikey'),
    backupRestoreInput: $('#backup-restore-input'),
    btnTriggerRestore: $('#btn-trigger-restore'),
    webhooksList: $('#webhooks-list'),
    newWebhookUrl: $('#new-webhook-url'),
    btnAddWebhook: $('#btn-add-webhook'),
    columnsManageList: $('#columns-manage-list'),
    newColTitle: $('#new-col-title'),
    btnCreateCustomCol: $('#btn-create-custom-col'),

    // Shortcuts Modal
    shortcutsModal: $('#shortcuts-modal'),
    shortcutsModalClose: $('#shortcuts-modal-close'),

    // Tour Modal
    tourModal: $('#tour-modal'),
    tourModalClose: $('#tour-modal-close'),
    btnTourGetStarted: $('#btn-tour-get-started'),

    // Share Modal
    shareModal: $('#share-modal'),
    shareModalClose: $('#share-modal-close'),
    publicShareUrl: $('#public-share-url'),
    btnCopyPublicLink: $('#btn-copy-public-link'),

    // Wear OS Modal
    wearModal: $('#wear-modal'),
    wearModalClose: $('#wear-modal-close'),
    wearContent: $('#wear-content'),
    wearClock: $('#wear-clock'),
    wearDockBtns: $$('.wear-dock-btn'),

    // Toast
    toastContainer: $('#toast-container')
  };

  // --- Initialization ---
  async function init() {
    applyTheme(currentTheme);
    bindEvents();
    await loadInitialData();
  }

  async function loadInitialData() {
    try {
      // Load users & columns in parallel
      const [usersData, columnsData] = await Promise.all([
        API.getUsers(),
        API.getColumns()
      ]);

      users = usersData || [];
      columns = columnsData || [];

      populateUserSelect();
      populateColumnSelects();
      await loadTasks();
      await loadStats();

      // Show first-time tour if not seen
      if (!localStorage.getItem('taskflow_tour_completed')) {
        dom.tourModal.classList.add('active');
      }
    } catch (err) {
      showToast('Initialization error: ' + err.message, 'error');
    }
  }

  // --- Theme Management ---
  function applyTheme(theme) {
    currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('taskflow_theme', theme);
    if (dom.themeIcon) {
      dom.themeIcon.textContent = theme === 'light' ? '☀️' : '🌙';
    }
  }

  function toggleTheme() {
    applyTheme(currentTheme === 'light' ? 'dark' : 'light');
  }

  // --- Views Switching ---
  function switchView(viewName) {
    currentView = viewName;
    dom.navTabs.forEach(tab => {
      const isActive = tab.dataset.view === viewName;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    Object.entries(dom.views).forEach(([name, el]) => {
      if (el) el.classList.toggle('active', name === viewName);
    });

    if (viewName === 'matrix') {
      renderMatrix();
    } else if (viewName === 'analytics') {
      loadAnalytics();
    } else {
      renderBoard();
    }
  }

  // --- Data Loading ---
  async function loadTasks() {
    try {
      const filters = getFilters();
      tasks = await API.getTasks(filters);
      if (currentView === 'board') renderBoard();
      else if (currentView === 'matrix') renderMatrix();
      else if (currentView === 'analytics') loadAnalytics();
    } catch (err) {
      showToast('Failed to load tasks: ' + err.message, 'error');
    }
  }

  async function loadStats() {
    try {
      const stats = await API.getStats();
      dom.statTodo.textContent = stats.todo || 0;
      dom.statProgress.textContent = stats.in_progress || 0;
      if (dom.statReview) dom.statReview.textContent = stats.review || 0;
      dom.statDone.textContent = stats.done || 0;
      dom.statOverdue.textContent = stats.overdue || 0;
    } catch (err) {
      // stats silent fail
    }
  }

  function getFilters() {
    let assignee = dom.filterAssignee ? dom.filterAssignee.value : 'all';
    if (assignee === 'me') assignee = currentUserId;

    return {
      assignee_id: assignee,
      priority: dom.filterPriority ? dom.filterPriority.value : 'all',
      quadrant: dom.filterQuadrant ? dom.filterQuadrant.value : 'all',
      search: dom.searchInput ? dom.searchInput.value.trim() : '',
      sort: dom.sortSelect ? dom.sortSelect.value : 'position',
      order: 'asc'
    };
  }

  // --- Board Rendering (Dynamic Columns) ---
  function renderBoard() {
    if (!dom.boardContainer) return;
    dom.boardContainer.innerHTML = '';

    columns.forEach(col => {
      const colEl = document.createElement('div');
      colEl.className = 'board-column';
      colEl.dataset.status = col.key;

      const colTasks = tasks.filter(t => t.status === col.key);
      const wipBadge = col.wip_limit > 0 ? ` (${colTasks.length}/${col.wip_limit})` : ` (${colTasks.length})`;

      colEl.innerHTML = `
        <div class="column-header">
          <div class="column-title">
            <span class="column-dot" style="background: ${col.color || 'var(--neon-cyan)'}"></span>
            ${Components.escapeHtml(col.title)}
          </div>
          <span class="column-count">${wipBadge}</span>
        </div>
        <div class="column-tasks" data-status="${col.key}"></div>
      `;

      const tasksContainer = colEl.querySelector('.column-tasks');
      if (colTasks.length === 0) {
        tasksContainer.appendChild(Components.emptyState(col.key));
      } else {
        colTasks.forEach(task => {
          const isSelected = task.id === selectedTaskId;
          const isTimerRunning = task.id === activeTimerTaskId;
          tasksContainer.appendChild(Components.taskCard(task, isSelected, isTimerRunning));
        });
      }

      dom.boardContainer.appendChild(colEl);
    });

    setupDragAndDrop();
  }

  // --- Eisenhower Matrix Rendering ---
  function renderMatrix() {
    const quadrants = ['do_first', 'schedule', 'delegate', 'eliminate'];

    quadrants.forEach(q => {
      const container = dom.quadrantTasks[q];
      const countEl = dom.quadrantCounts[q];
      if (!container) return;

      const qTasks = tasks.filter(t => (t.eisenhower_quadrant || 'schedule') === q && t.status !== 'done');
      if (countEl) countEl.textContent = qTasks.length;

      container.innerHTML = '';
      if (qTasks.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding: 24px; color: var(--text-muted); font-size: 0.8rem;">No active tasks in quadrant</div>';
      } else {
        qTasks.forEach(t => {
          container.appendChild(Components.matrixCard(t));
        });
      }
    });

    setupMatrixDragAndDrop();
  }

  // --- Analytics Loading & Chart Rendering ---
  async function loadAnalytics() {
    try {
      const days = dom.analyticsRange ? dom.analyticsRange.value : 30;
      const res = await API.getAnalytics(days);
      if (!res) return;

      const { totals, velocity, priorityDist, statusDist, quadrantDist } = res;

      // Update KPI metrics
      if (dom.kpiCompletionRate) dom.kpiCompletionRate.textContent = `${totals.completion_rate || 0}%`;
      if (dom.kpiCompleted) dom.kpiCompleted.textContent = totals.completed_tasks || 0;
      if (dom.kpiActive) dom.kpiActive.textContent = totals.active_tasks || 0;
      if (dom.kpiOverdue) dom.kpiOverdue.textContent = totals.overdue_tasks || 0;
      if (dom.kpiCycleTime) dom.kpiCycleTime.textContent = `${totals.avg_cycle_hours || 0}h`;
      if (dom.kpiTimeRatio) dom.kpiTimeRatio.textContent = `${totals.total_actual_mins || 0}m / ${totals.total_estimated_mins || 0}m`;

      // Render Charts
      renderBarChart(dom.chartVelocity, (velocity || []).slice(-7).map(v => ({ label: v.day.slice(5), val: v.count, color: 'var(--neon-green)' })));
      renderBarChart(dom.chartPriority, (priorityDist || []).map(p => ({ label: p.priority, val: p.count, color: getPriorityColor(p.priority) })));
      renderBarChart(dom.chartStatus, (statusDist || []).map(s => ({ label: s.status, val: s.count, color: 'var(--neon-cyan)' })));
      renderBarChart(dom.chartQuadrant, (quadrantDist || []).map(q => ({ label: q.quadrant, val: q.count, color: 'var(--neon-purple)' })));

    } catch (err) {
      showToast('Failed to load analytics: ' + err.message, 'error');
    }
  }

  function getPriorityColor(p) {
    if (p === 'critical') return 'var(--neon-red)';
    if (p === 'high') return 'var(--neon-amber)';
    if (p === 'medium') return 'var(--neon-cyan)';
    return '#78909c';
  }

  function renderBarChart(container, data) {
    if (!container) return;
    container.innerHTML = '';
    if (!data || data.length === 0) {
      container.innerHTML = '<div style="display:flex; align-items:center; justify-content:center; width:100%; color:var(--text-muted); font-size:0.8rem;">No activity data yet</div>';
      return;
    }

    const maxVal = Math.max(...data.map(d => d.val), 1);

    data.forEach(item => {
      const col = document.createElement('div');
      col.className = 'bar-col';
      const pct = Math.round((item.val / maxVal) * 100);

      col.innerHTML = `
        <span class="bar-val">${item.val}</span>
        <div class="bar-rect" style="height: ${Math.max(pct, 5)}%; background: ${item.color || 'var(--neon-cyan)'};"></div>
        <span class="bar-label">${item.label}</span>
      `;
      container.appendChild(col);
    });
  }

  // --- Populate Dropdowns ---
  function populateUserSelect() {
    if (!dom.userSwitcher) return;
    dom.userSwitcher.innerHTML = '';
    users.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.id;
      opt.textContent = `${u.avatar || '👤'} ${u.name} (${u.role})`;
      if (u.id === currentUserId) opt.selected = true;
      dom.userSwitcher.appendChild(opt);
    });

    if (dom.taskAssignee) {
      dom.taskAssignee.innerHTML = '<option value="">Unassigned</option>';
      users.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.id;
        opt.textContent = `${u.avatar || '👤'} ${u.name}`;
        dom.taskAssignee.appendChild(opt);
      });
    }

    if (dom.filterAssignee) {
      dom.filterAssignee.innerHTML = '<option value="all">All Assignees</option><option value="me">Assigned to Me</option>';
      users.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.id;
        opt.textContent = `${u.avatar || '👤'} ${u.name}`;
        dom.filterAssignee.appendChild(opt);
      });
    }
  }

  function populateColumnSelects() {
    if (!dom.taskStatus) return;
    dom.taskStatus.innerHTML = '';
    columns.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.key;
      opt.textContent = c.title;
      dom.taskStatus.appendChild(opt);
    });
  }

  // --- Stopwatch / Live Time Tracking ---
  function toggleStopwatch(taskId) {
    if (activeTimerTaskId === taskId) {
      // Pause / Stop stopwatch
      clearInterval(timerInterval);
      const elapsedMins = Math.max(Math.round(timerSeconds / 60), 1);
      API.createTimeLog(taskId, elapsedMins, currentUserId, 'Logged from live stopwatch')
        .then(() => {
          showToast(`⏱️ Logged ${elapsedMins} minute(s) to task`, 'success');
          activeTimerTaskId = null;
          timerSeconds = 0;
          loadTasks();
        })
        .catch(err => showToast('Failed to log timer: ' + err.message, 'error'));
    } else {
      // Start stopwatch on taskId
      if (timerInterval) clearInterval(timerInterval);
      activeTimerTaskId = taskId;
      timerSeconds = 0;
      showToast('⏱️ Stopwatch started', 'info');
      timerInterval = setInterval(() => {
        timerSeconds++;
      }, 1000);
      renderBoard();
    }
  }

  // --- Event Bindings ---
  function bindEvents() {
    // Navigation Tabs
    dom.navTabs.forEach(tab => {
      tab.addEventListener('click', () => switchView(tab.dataset.view));
    });

    // Theme Toggle
    if (dom.btnThemeToggle) dom.btnThemeToggle.addEventListener('click', toggleTheme);

    // User Switcher
    if (dom.userSwitcher) {
      dom.userSwitcher.addEventListener('change', (e) => {
        currentUserId = e.target.value;
        const u = users.find(x => x.id === currentUserId);
        showToast(`Active User switched to ${u ? u.name : currentUserId}`, 'info');
        loadTasks();
      });
    }

    // Toolbar filters & search
    if (dom.searchInput) {
      dom.searchInput.addEventListener('input', () => {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(loadTasks, 300);
      });
    }
    if (dom.filterAssignee) dom.filterAssignee.addEventListener('change', loadTasks);
    if (dom.filterPriority) dom.filterPriority.addEventListener('change', loadTasks);
    if (dom.filterQuadrant) dom.filterQuadrant.addEventListener('change', loadTasks);
    if (dom.sortSelect) dom.sortSelect.addEventListener('change', loadTasks);
    if (dom.analyticsRange) dom.analyticsRange.addEventListener('change', loadAnalytics);

    // FAB & New Task buttons
    if (dom.fabAdd) dom.fabAdd.addEventListener('click', () => openCreateModal());
    if (dom.btnMatrixNewTask) dom.btnMatrixNewTask.addEventListener('click', () => openCreateModal());
    if (dom.btnAddColumn) dom.btnAddColumn.addEventListener('click', openSettingsModal);

    // Modals
    if (dom.modalClose) dom.modalClose.addEventListener('click', closeTaskModal);
    if (dom.btnCancelTask) dom.btnCancelTask.addEventListener('click', closeTaskModal);
    if (dom.taskForm) dom.taskForm.addEventListener('submit', handleFormSubmit);

    // Subtasks
    if (dom.btnAddSubtask) dom.btnAddSubtask.addEventListener('click', handleAddSubtask);
    if (dom.newSubtaskTitle) {
      dom.newSubtaskTitle.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); handleAddSubtask(); }
      });
    }

    // Attachments
    if (dom.btnTriggerUpload) dom.btnTriggerUpload.addEventListener('click', () => dom.fileUploadInput.click());
    if (dom.fileUploadInput) dom.fileUploadInput.addEventListener('change', handleFileUpload);
    if (dom.btnAddWeblink) dom.btnAddWeblink.addEventListener('click', handleAttachWebLink);

    // Quick Time Logging
    if (dom.btnQuickLogTime) dom.btnQuickLogTime.addEventListener('click', handleQuickTimeLog);

    // Share Token Copy
    if (dom.btnCopyShareToken) dom.btnCopyShareToken.addEventListener('click', handleCopyShareToken);
    if (dom.btnCopyPublicLink) dom.btnCopyPublicLink.addEventListener('click', handleCopyPublicLink);

    // Tags
    if (dom.tagInput) dom.tagInput.addEventListener('keydown', handleTagInput);
    if (dom.tagContainer) dom.tagContainer.addEventListener('click', handleTagRemove);

    // Delete Modal
    if (dom.btnCancelDelete) dom.btnCancelDelete.addEventListener('click', closeDeleteModal);
    if (dom.btnConfirmDelete) dom.btnConfirmDelete.addEventListener('click', handleConfirmDelete);

    // Shortcuts Modal
    if (dom.btnShortcuts) dom.btnShortcuts.addEventListener('click', () => dom.shortcutsModal.classList.add('active'));
    if (dom.shortcutsModalClose) dom.shortcutsModalClose.addEventListener('click', () => dom.shortcutsModal.classList.remove('active'));

    // Tour Modal
    if (dom.btnTour) dom.btnTour.addEventListener('click', () => dom.tourModal.classList.add('active'));
    if (dom.tourModalClose) dom.tourModalClose.addEventListener('click', () => dom.tourModal.classList.remove('active'));
    if (dom.btnTourGetStarted) {
      dom.btnTourGetStarted.addEventListener('click', () => {
        localStorage.setItem('taskflow_tour_completed', 'true');
        dom.tourModal.classList.remove('active');
      });
    }

    // Settings Modal
    if (dom.btnSettings) dom.btnSettings.addEventListener('click', openSettingsModal);
    if (dom.settingsModalClose) dom.settingsModalClose.addEventListener('click', () => dom.settingsModal.classList.remove('active'));
    if (dom.btnCloseSettings) dom.btnCloseSettings.addEventListener('click', () => dom.settingsModal.classList.remove('active'));
    if (dom.btnCopyCalUrl) dom.btnCopyCalUrl.addEventListener('click', () => copyToClipboard(dom.calFeedUrl.value, 'Calendar feed URL copied!'));
    if (dom.btnCopyApiKey) dom.btnCopyApiKey.addEventListener('click', () => copyToClipboard(dom.currentUserApiKey.value, 'API key copied!'));
    if (dom.btnTriggerRestore) dom.btnTriggerRestore.addEventListener('click', () => dom.backupRestoreInput.click());
    if (dom.backupRestoreInput) dom.backupRestoreInput.addEventListener('change', handleBackupRestore);
    if (dom.btnAddWebhook) dom.btnAddWebhook.addEventListener('click', handleAddWebhook);
    if (dom.btnCreateCustomCol) dom.btnCreateCustomCol.addEventListener('click', handleCreateCustomCol);

    // Share Modal
    if (dom.shareModalClose) dom.shareModalClose.addEventListener('click', () => dom.shareModal.classList.remove('active'));

    // Wear OS Companion Modal
    if (dom.btnWearCompanion) dom.btnWearCompanion.addEventListener('click', openWearModal);
    if (dom.wearModalClose) dom.wearModalClose.addEventListener('click', () => dom.wearModal.classList.remove('active'));
    dom.wearDockBtns.forEach(btn => btn.addEventListener('click', () => switchWearTab(btn.dataset.tab)));

    // Global Delegated Card Actions
    document.addEventListener('click', handleCardActions);

    // Global Keyboard Navigation
    document.addEventListener('keydown', handleKeyboardShortcuts);
  }

  // --- Modal Open/Close ---
  function openCreateModal(defaultQuadrant = 'schedule') {
    editingTaskId = null;
    dom.modalTitle.textContent = 'New Task';
    dom.btnSaveTask.textContent = 'Create Task';
    dom.taskForm.reset();
    dom.taskId.value = '';
    dom.taskPriority.value = 'medium';
    dom.taskStatus.value = columns[0] ? columns[0].key : 'todo';
    dom.taskQuadrant.value = defaultQuadrant;
    dom.taskRecurrence.value = 'none';
    dom.taskAssignee.value = currentUserId;
    currentTags = [];
    currentSubtasks = [];
    currentAttachments = [];
    renderTags();
    renderSubtasksList();
    renderAttachmentsList();

    dom.subtasksSection.style.display = 'none';
    dom.attachmentsSection.style.display = 'none';
    dom.shareLinkBox.style.display = 'none';

    dom.taskModal.classList.add('active');
    setTimeout(() => dom.taskTitle.focus(), 150);
  }

  async function openEditModal(id) {
    try {
      const task = await API.getTask(id);
      if (!task) return;

      editingTaskId = id;
      dom.modalTitle.textContent = 'Edit Task';
      dom.btnSaveTask.textContent = 'Save Changes';
      dom.taskId.value = task.id;
      dom.taskTitle.value = task.title;
      dom.taskDesc.value = task.description || '';
      dom.taskPriority.value = task.priority;
      dom.taskStatus.value = task.status;
      dom.taskAssignee.value = task.assignee_id || '';
      dom.taskRecurrence.value = task.recurrence_rule || 'none';
      dom.taskDue.value = task.due_date || '';
      dom.taskQuadrant.value = task.eisenhower_quadrant || 'schedule';
      dom.taskEstTime.value = task.estimated_minutes || 0;

      // Custom fields
      const cf = task.custom_fields || {};
      dom.cfClient.value = cf.client || '';
      dom.cfBudget.value = cf.budget || '';
      dom.cfPoints.value = cf.story_points || '';
      dom.cfRisk.value = cf.risk || '';

      currentTags = Array.isArray(task.tags) ? [...task.tags] : [];
      renderTags();

      // Subtasks & Attachments
      currentSubtasks = task.subtasks || [];
      currentAttachments = task.attachments || [];
      renderSubtasksList();
      renderAttachmentsList();

      dom.subtasksSection.style.display = 'block';
      dom.attachmentsSection.style.display = 'block';

      // Share Link
      if (task.share_token) {
        dom.shareLinkBox.style.display = 'block';
        dom.shareLinkInput.value = `${window.location.origin}/share/${task.share_token}`;
      } else {
        dom.shareLinkBox.style.display = 'none';
      }

      dom.taskModal.classList.add('active');
      setTimeout(() => dom.taskTitle.focus(), 150);
    } catch (err) {
      showToast('Failed to open task: ' + err.message, 'error');
    }
  }

  function closeTaskModal() {
    dom.taskModal.classList.remove('active');
    editingTaskId = null;
    currentTags = [];
    currentSubtasks = [];
    currentAttachments = [];
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

  // --- Form Submit ---
  async function handleFormSubmit(e) {
    e.preventDefault();
    const title = dom.taskTitle.value.trim();
    if (!title) return;

    const customFields = {};
    if (dom.cfClient.value.trim()) customFields.client = dom.cfClient.value.trim();
    if (dom.cfBudget.value.trim()) customFields.budget = dom.cfBudget.value.trim();
    if (dom.cfPoints.value.trim()) customFields.story_points = parseInt(dom.cfPoints.value, 10);
    if (dom.cfRisk.value.trim()) customFields.risk = dom.cfRisk.value.trim();

    const payload = {
      title,
      description: dom.taskDesc.value.trim(),
      priority: dom.taskPriority.value,
      status: dom.taskStatus.value,
      assignee_id: dom.taskAssignee.value || null,
      recurrence_rule: dom.taskRecurrence.value,
      due_date: dom.taskDue.value || null,
      eisenhower_quadrant: dom.taskQuadrant.value,
      estimated_minutes: parseInt(dom.taskEstTime.value || 0, 10),
      custom_fields: customFields,
      tags: [...currentTags]
    };

    try {
      if (editingTaskId) {
        await API.updateTask(editingTaskId, payload);
        showToast('Task updated successfully', 'success');
      } else {
        const newTask = await API.createTask(payload);
        showToast('Task created successfully', 'success');
        editingTaskId = newTask.id;
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
      showToast('Failed to delete: ' + err.message, 'error');
    }
  }

  // --- Subtasks Handling ---
  async function handleAddSubtask() {
    const title = dom.newSubtaskTitle.value.trim();
    if (!title || !editingTaskId) return;

    try {
      const sub = await API.createSubtask(editingTaskId, title);
      currentSubtasks.push(sub);
      renderSubtasksList();
      dom.newSubtaskTitle.value = '';
      loadTasks();
    } catch (err) {
      showToast('Failed to add subtask: ' + err.message, 'error');
    }
  }

  function renderSubtasksList() {
    if (!dom.subtasksList) return;
    dom.subtasksList.innerHTML = '';
    dom.subtasksCountPill.textContent = `${currentSubtasks.length} items`;

    currentSubtasks.forEach(st => {
      const row = Components.subtaskItem(st);
      row.querySelector('.subtask-checkbox').addEventListener('change', async (e) => {
        const completed = e.target.checked;
        await API.updateSubtask(st.id, { completed });
        st.completed = completed ? 1 : 0;
        row.classList.toggle('completed', completed);
        loadTasks();
      });
      row.querySelector('.subtask-delete').addEventListener('click', async () => {
        await API.deleteSubtask(st.id);
        currentSubtasks = currentSubtasks.filter(x => x.id !== st.id);
        renderSubtasksList();
        loadTasks();
      });
      dom.subtasksList.appendChild(row);
    });
  }

  // --- File Attachments Handling ---
  async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file || !editingTaskId) return;

    try {
      showToast('Uploading attachment...', 'info');
      const att = await API.uploadAttachment(editingTaskId, file);
      currentAttachments.push(att);
      renderAttachmentsList();
      showToast('File attached successfully', 'success');
      loadTasks();
    } catch (err) {
      showToast('Upload failed: ' + err.message, 'error');
    }
  }

  async function handleAttachWebLink() {
    if (!editingTaskId) return;
    const url = prompt('Enter document or project link (URL):');
    if (!url) return;
    const title = prompt('Enter link title (optional):') || url;

    try {
      const att = await API.attachLink(editingTaskId, url, title);
      currentAttachments.push(att);
      renderAttachmentsList();
      showToast('Link attached successfully', 'success');
      loadTasks();
    } catch (err) {
      showToast('Failed to attach link: ' + err.message, 'error');
    }
  }

  function renderAttachmentsList() {
    if (!dom.attachmentsList) return;
    dom.attachmentsList.innerHTML = '';
    dom.attachmentsCountPill.textContent = `${currentAttachments.length} files`;

    currentAttachments.forEach(att => {
      const row = Components.attachmentItem(att);
      row.querySelector('.attachment-delete').addEventListener('click', async () => {
        await API.deleteAttachment(att.id);
        currentAttachments = currentAttachments.filter(x => x.id !== att.id);
        renderAttachmentsList();
        loadTasks();
      });
      dom.attachmentsList.appendChild(row);
    });
  }

  // --- Quick Time Logging ---
  async function handleQuickTimeLog() {
    const mins = parseInt(dom.quickLogMinutes.value, 10);
    if (isNaN(mins) || mins <= 0 || !editingTaskId) {
      showToast('Please enter valid minutes to log', 'warning');
      return;
    }

    try {
      await API.createTimeLog(editingTaskId, mins, currentUserId, 'Manual time log');
      showToast(`Logged ${mins} minutes!`, 'success');
      dom.quickLogMinutes.value = '';
      loadTasks();
    } catch (err) {
      showToast('Failed to log time: ' + err.message, 'error');
    }
  }

  // --- Share Links ---
  function handleCopyShareToken() {
    copyToClipboard(dom.shareLinkInput.value, 'Public task link copied to clipboard!');
  }

  function handleCopyPublicLink() {
    copyToClipboard(dom.publicShareUrl.value, 'Public share link copied to clipboard!');
  }

  function copyToClipboard(text, msg) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(msg || 'Copied to clipboard!', 'success');
    }).catch(() => {
      showToast('Failed to copy', 'error');
    });
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
    const btn = e.target.closest('.tag-pill-remove');
    if (!btn) return;
    const tag = btn.dataset.tag;
    currentTags = currentTags.filter(t => t !== tag);
    renderTags();
  }

  function renderTags() {
    if (!dom.tagContainer) return;
    dom.tagContainer.querySelectorAll('.tag-pill').forEach(el => el.remove());
    currentTags.forEach(tag => {
      dom.tagContainer.insertBefore(Components.tagPill(tag), dom.tagInput);
    });
  }

  // --- Delegated Card Actions ---
  function handleCardActions(e) {
    // Stopwatch Button
    const timerBtn = e.target.closest('.btn-timer');
    if (timerBtn) {
      e.stopPropagation();
      toggleStopwatch(timerBtn.dataset.id);
      return;
    }

    // Share Button
    const shareBtn = e.target.closest('.btn-share');
    if (shareBtn) {
      e.stopPropagation();
      API.shareTask(shareBtn.dataset.id).then(res => {
        dom.publicShareUrl.value = res.full_url;
        dom.shareModal.classList.add('active');
      }).catch(err => showToast(err.message, 'error'));
      return;
    }

    // Edit Button
    const editBtn = e.target.closest('.btn-edit');
    if (editBtn) {
      e.stopPropagation();
      openEditModal(editBtn.dataset.id);
      return;
    }

    // Delete Button
    const delBtn = e.target.closest('.btn-delete');
    if (delBtn) {
      e.stopPropagation();
      openDeleteModal(delBtn.dataset.id);
      return;
    }

    // Card selection (for keyboard nav)
    const card = e.target.closest('.task-card');
    if (card) {
      selectedTaskId = card.dataset.id;
      $$('.task-card').forEach(c => c.classList.toggle('selected', c.dataset.id === selectedTaskId));
    }
  }

  // --- Keyboard Shortcuts Navigation ---
  function handleKeyboardShortcuts(e) {
    // Ignore hotkeys when typing in inputs or textareas
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
      if (e.key === 'Escape') document.activeElement.blur();
      return;
    }

    if (e.key === 'Escape') {
      $$('.modal-overlay').forEach(m => m.classList.remove('active'));
      return;
    }

    if (e.key === 'n') {
      e.preventDefault();
      openCreateModal();
      return;
    }

    if (e.key === '/') {
      e.preventDefault();
      if (dom.searchInput) dom.searchInput.focus();
      return;
    }

    if (e.key === 't') {
      e.preventDefault();
      toggleTheme();
      return;
    }

    if (e.key === '?') {
      e.preventDefault();
      dom.shortcutsModal.classList.add('active');
      return;
    }

    // Task Card Selection Navigation (j / k or ArrowDown / ArrowUp)
    if (e.key === 'j' || e.key === 'ArrowDown') {
      e.preventDefault();
      selectRelativeTask(1);
      return;
    }
    if (e.key === 'k' || e.key === 'ArrowUp') {
      e.preventDefault();
      selectRelativeTask(-1);
      return;
    }

    // Edit selected task
    if (e.key === 'e' && selectedTaskId) {
      e.preventDefault();
      openEditModal(selectedTaskId);
      return;
    }

    // Delete selected task
    if ((e.key === 'Backspace' || e.key === 'Delete') && selectedTaskId) {
      e.preventDefault();
      openDeleteModal(selectedTaskId);
      return;
    }

    // Move to column 1, 2, 3, 4
    if (['1', '2', '3', '4'].includes(e.key) && selectedTaskId) {
      const colIdx = parseInt(e.key, 10) - 1;
      if (columns[colIdx]) {
        e.preventDefault();
        const targetCol = columns[colIdx].key;
        API.updateTask(selectedTaskId, { status: targetCol }).then(() => {
          showToast(`Task moved to ${columns[colIdx].title}`, 'success');
          loadTasks();
          loadStats();
        });
      }
    }
  }

  function selectRelativeTask(delta) {
    const cards = Array.from($$('.task-card'));
    if (!cards.length) return;

    let currentIdx = cards.findIndex(c => c.dataset.id === selectedTaskId);
    if (currentIdx === -1) {
      currentIdx = delta > 0 ? 0 : cards.length - 1;
    } else {
      currentIdx = (currentIdx + delta + cards.length) % cards.length;
    }

    selectedTaskId = cards[currentIdx].dataset.id;
    cards.forEach((c, idx) => c.classList.toggle('selected', idx === currentIdx));
    cards[currentIdx].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // --- Settings & Integrations Modal ---
  async function openSettingsModal() {
    dom.calFeedUrl.value = `${window.location.origin}/api/export/calendar.ics`;

    const u = users.find(x => x.id === currentUserId) || users[0];
    if (u && dom.currentUserApiKey) {
      dom.currentUserApiKey.value = u.api_key || 'tk_live_standard';
    }

    await loadWebhooks();
    renderColumnsManager();
    dom.settingsModal.classList.add('active');
  }

  async function loadWebhooks() {
    try {
      const list = await API.getWebhooks();
      dom.webhooksList.innerHTML = '';
      if (!list || list.length === 0) {
        dom.webhooksList.innerHTML = '<div style="font-size:0.75rem; color:var(--text-muted);">No outbound webhooks configured.</div>';
        return;
      }

      list.forEach(wh => {
        const item = document.createElement('div');
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.alignItems = 'center';
        item.style.padding = '4px 0';
        item.style.fontSize = '0.78rem';
        item.innerHTML = `
          <span style="font-family: monospace; overflow:hidden; text-overflow:ellipsis; max-width:320px;">${Components.escapeHtml(wh.url)}</span>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-ghost btn-sm" data-action="test" data-id="${wh.id}" style="font-size:0.7rem;">Ping</button>
            <button class="btn btn-ghost btn-sm" data-action="del" data-id="${wh.id}" style="font-size:0.7rem; color:var(--neon-red);">✕</button>
          </div>
        `;

        item.querySelector('[data-action="test"]').addEventListener('click', async () => {
          await API.testWebhook(wh.id);
          showToast('Webhook ping dispatched!', 'success');
        });

        item.querySelector('[data-action="del"]').addEventListener('click', async () => {
          await API.deleteWebhook(wh.id);
          showToast('Webhook removed', 'info');
          loadWebhooks();
        });

        dom.webhooksList.appendChild(item);
      });
    } catch (e) {}
  }

  async function handleAddWebhook() {
    const url = dom.newWebhookUrl.value.trim();
    if (!url) return;
    try {
      await API.createWebhook({ url });
      showToast('Webhook created', 'success');
      dom.newWebhookUrl.value = '';
      loadWebhooks();
    } catch (err) {
      showToast('Error creating webhook: ' + err.message, 'error');
    }
  }

  function renderColumnsManager() {
    dom.columnsManageList.innerHTML = '';
    columns.forEach(c => {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.alignItems = 'center';
      row.style.padding = '4px 0';
      row.style.fontSize = '0.8rem';
      row.innerHTML = `
        <span><strong style="color:${c.color}">${c.title}</strong> (key: <code>${c.key}</code>)</span>
        <button class="btn btn-ghost" data-id="${c.id}" style="font-size:0.75rem; color:var(--neon-red);">Delete</button>
      `;
      row.querySelector('button').addEventListener('click', async () => {
        if (confirm(`Delete workflow column "${c.title}"?`)) {
          await API.deleteColumn(c.id);
          columns = await API.getColumns();
          populateColumnSelects();
          renderColumnsManager();
          loadTasks();
        }
      });
      dom.columnsManageList.appendChild(row);
    });
  }

  async function handleCreateCustomCol() {
    const title = dom.newColTitle.value.trim();
    if (!title) return;
    try {
      await API.createColumn({ title, color: 'var(--neon-magenta)' });
      showToast(`Column "${title}" created!`, 'success');
      dom.newColTitle.value = '';
      columns = await API.getColumns();
      populateColumnSelects();
      renderColumnsManager();
      loadTasks();
    } catch (err) {
      showToast('Failed to add column: ' + err.message, 'error');
    }
  }

  async function handleBackupRestore(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = JSON.parse(evt.target.result);
        if (confirm('Restore database from this backup? Current data will be safely updated.')) {
          await API.restoreBackup(data);
          showToast('Database successfully restored!', 'success');
          dom.settingsModal.classList.remove('active');
          await loadInitialData();
        }
      } catch (err) {
        showToast('Invalid backup file: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  }

  // --- Drag & Drop for Board ---
  function setupDragAndDrop() {
    const columnsEls = $$('.column-tasks');
    let draggedId = null;

    document.querySelectorAll('.task-card').forEach(card => {
      card.addEventListener('dragstart', (e) => {
        draggedId = card.dataset.id;
        card.classList.add('dragging');
        e.dataTransfer.setData('text/plain', card.dataset.id);
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        $$('.board-column').forEach(c => c.classList.remove('drag-over'));
      });
    });

    columnsEls.forEach(col => {
      col.addEventListener('dragover', (e) => {
        e.preventDefault();
        col.closest('.board-column').classList.add('drag-over');
      });

      col.addEventListener('dragleave', (e) => {
        if (!col.contains(e.relatedTarget)) {
          col.closest('.board-column').classList.remove('drag-over');
        }
      });

      col.addEventListener('drop', async (e) => {
        e.preventDefault();
        col.closest('.board-column').classList.remove('drag-over');
        const taskId = e.dataTransfer.getData('text/plain') || draggedId;
        const newStatus = col.dataset.status;
        if (!taskId || !newStatus) return;

        try {
          await API.updateTask(taskId, { status: newStatus });
          showToast(`Task moved to ${newStatus}`, 'success');
          await loadTasks();
          await loadStats();
        } catch (err) {
          showToast('Move failed: ' + err.message, 'error');
        }
      });
    });
  }

  // --- Drag & Drop for Matrix ---
  function setupMatrixDragAndDrop() {
    const quadrants = $$('.quadrant-tasks');
    let draggedId = null;

    document.querySelectorAll('.matrix-card').forEach(card => {
      card.addEventListener('dragstart', (e) => {
        draggedId = card.dataset.id;
        e.dataTransfer.setData('text/plain', card.dataset.id);
      });
    });

    quadrants.forEach(q => {
      q.addEventListener('dragover', (e) => e.preventDefault());
      q.addEventListener('drop', async (e) => {
        e.preventDefault();
        const taskId = e.dataTransfer.getData('text/plain') || draggedId;
        const targetQuadrant = q.dataset.quadrant;
        if (!taskId || !targetQuadrant) return;

        try {
          await API.updateTask(taskId, { eisenhower_quadrant: targetQuadrant });
          showToast(`Moved to ${targetQuadrant.replace('_', ' ')}`, 'success');
          await loadTasks();
        } catch (err) {
          showToast('Move failed: ' + err.message, 'error');
        }
      });
    });
  }

  // --- Wear OS Simulator (Preserved) ---
  function openWearModal() {
    dom.wearModal.classList.add('active');
    updateWearClock();
    renderActiveWearTab();
  }

  function updateWearClock() {
    if (!dom.wearClock) return;
    const now = new Date();
    dom.wearClock.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  async function switchWearTab(tab) {
    activeWearTab = tab;
    dom.wearDockBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
    await renderActiveWearTab();
  }

  async function renderActiveWearTab() {
    if (!dom.wearContent) return;

    if (activeWearTab === 'tasks') {
      dom.wearContent.innerHTML = '<div style="text-align:center; padding: 20px; font-size:10px; color:#888;">Syncing wrist...</div>';
      try {
        const res = await API.getWearTasks();
        const wearTasks = res.tasks || [];
        if (!wearTasks.length) {
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
      micBtn.addEventListener('click', () => {
        micBtn.style.boxShadow = '0 0 15px #b347ff';
        hint.textContent = 'Listening to wrist audio...';
        setTimeout(async () => {
          const samples = ['Review quarterly budget', 'Deploy security patch', 'Follow up with client contract'];
          const chosen = samples[Math.floor(Math.random() * samples.length)];
          hint.textContent = `"${chosen}"`;
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
        dom.wearContent.innerHTML = '<div style="color:#ff1744; font-size:10px;">Tile failed</div>';
      }
    }
  }

  // --- Toast Notifications ---
  function showToast(message, type = 'info') {
    const toast = Components.toast(message, type);
    dom.toastContainer.appendChild(toast);
    toast.querySelector('.toast-dismiss').addEventListener('click', () => {
      toast.classList.add('removing');
      setTimeout(() => toast.remove(), 200);
    });
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

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const db = require('../db');

console.log('\n🧪 Running TaskFlow Enterprise Comprehensive Feature Tests...\n');

// 1. Multi-User Verification
console.log('1️⃣ Multi-User Verification:');
const users = db.getAllUsers();
assert(users.length >= 4, 'Should have at least 4 default seed users');
const brandon = users.find(u => u.name === 'Brandon Heisey');
assert(brandon && brandon.role === 'admin', 'Brandon should be admin');
const userByApiKey = db.getUserByApiKey(brandon.api_key);
assert(userByApiKey && userByApiKey.id === brandon.id, 'API key resolution failed');
console.log('   ✅ Multi-user and API key authentication working');

// 2. Dynamic Workflow Columns
console.log('2️⃣ Dynamic Workflow Columns:');
const cols = db.getAllColumns();
assert(cols.length >= 4, 'Should have standard default columns');
const customCol = db.createColumn({ key: 'test_qa', title: 'QA Testing', color: '#ff00ff' });
assert(customCol && customCol.key === 'test_qa', 'Custom column creation failed');
const updatedCols = db.getAllColumns();
assert(updatedCols.some(c => c.key === 'test_qa'), 'Custom column should be in list');
db.deleteColumn(customCol.id);
console.log('   ✅ Custom workflow columns CRUD working');

// 3. Advanced Task Management: Subtasks & Custom Fields
console.log('3️⃣ Subtasks & Custom Fields:');
const task = db.createTask({
  title: 'Test Enterprise Architecture',
  description: 'Validating nested subtasks and custom fields',
  priority: 'high',
  status: 'todo',
  recurrence_rule: 'weekly',
  eisenhower_quadrant: 'do_first',
  estimated_minutes: 90,
  custom_fields: { client: 'ACME Cyber', budget: '$20,000' },
  assignee_id: brandon.id
});
assert(task && task.id, 'Task creation failed');
assert(task.recurrence_rule === 'weekly', 'Recurrence rule should be weekly');
assert(task.eisenhower_quadrant === 'do_first', 'Quadrant should be do_first');

// Subtasks
const sub1 = db.createSubtask({ taskId: task.id, title: 'Step 1: Code Review' });
const sub2 = db.createSubtask({ taskId: task.id, title: 'Step 2: Integration Verification' });
assert(sub1 && sub2, 'Subtasks creation failed');
db.updateSubtask(sub1.id, { completed: 1 });
const subs = db.getSubtasksByTaskId(task.id);
assert(subs.length === 2 && subs[0].completed === 1, 'Subtask completion state failed');
console.log('   ✅ Subtasks checklist and progress tracking working');

// 4. Time Tracking
console.log('4️⃣ Time Tracking:');
const log1 = db.createTimeLog({ taskId: task.id, userId: brandon.id, durationMinutes: 30, notes: 'Design phase' });
const log2 = db.createTimeLog({ taskId: task.id, userId: brandon.id, durationMinutes: 45, notes: 'Implementation' });
const taskWithTime = db.getTaskById(task.id);
assert(taskWithTime.actual_minutes === 75, `Expected 75 actual minutes, got ${taskWithTime.actual_minutes}`);
console.log('   ✅ Time logs & actual minutes accumulation working');

// 5. Recurring Task Auto-Spawn on Completion
console.log('5️⃣ Recurring Task Auto-Spawn:');
const completedTask = db.updateTask(task.id, { status: 'done' });
assert(completedTask.status === 'done', 'Task should be done');
assert(completedTask.completed_at !== null, 'completed_at should be populated');

// Next weekly recurrence should have spawned
const recurringTasks = db.getAllTasks({ search: 'Test Enterprise Architecture' });
assert(recurringTasks.length >= 2, 'Next occurrence should have auto-spawned');
const nextOccurrence = recurringTasks.find(t => t.id !== task.id && t.status === 'todo');
assert(nextOccurrence, 'Next occurrence must be in todo status');
assert(nextOccurrence.recurrence_rule === 'weekly', 'Next occurrence must inherit weekly recurrence');
const nextSubs = db.getSubtasksByTaskId(nextOccurrence.id);
assert(nextSubs.length === 2 && nextSubs[0].completed === 0, 'Next occurrence must duplicate subtasks in uncompleted state');
console.log('   ✅ Recurring task auto-spawn and subtask duplication working');

// 6. Attachments
console.log('6️⃣ Attachments & Documents:');
const att = db.createAttachment({
  taskId: task.id,
  filename: 'spec.pdf',
  originalName: 'Architecture_Spec.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 1024,
  filePath: '/tmp/spec.pdf',
  url: '/uploads/spec.pdf'
});
assert(att && att.id, 'Attachment creation failed');
const atts = db.getAttachmentsByTaskId(task.id);
assert(atts.length >= 1, 'Attachments query failed');
console.log('   ✅ File attachments metadata working');

// 7. Public Task Sharing
console.log('7️⃣ Public Task Sharing:');
assert(task.share_token, 'Task must have a share_token');
const shared = db.getTaskByShareToken(task.share_token);
assert(shared && shared.id === task.id, 'Share token retrieval failed');
console.log('   ✅ Public share token resolution working');

// 8. Productivity Analytics
console.log('8️⃣ Productivity Analytics:');
const analytics = db.getAnalyticsSummary(30);
assert(analytics.totals.total_tasks > 0, 'Analytics total tasks should be > 0');
assert(analytics.totals.completed_tasks > 0, 'Analytics completed tasks should be > 0');
assert(Array.isArray(analytics.velocity), 'Analytics velocity should be an array');
assert(Array.isArray(analytics.quadrantDist), 'Analytics quadrantDist should be an array');
console.log('   ✅ Productivity reports & velocity calculation working');

// 9. Database Backup & Restore Integrity
console.log('9️⃣ Backup & Restore Integrity:');
const backup = db.exportDatabaseBackup();
assert(backup.version === '2.0.0', 'Backup version must be 2.0.0');
assert(Array.isArray(backup.tasks) && backup.tasks.length > 0, 'Backup tasks must be populated');
assert(Array.isArray(backup.subtasks) && backup.subtasks.length > 0, 'Backup subtasks must be populated');
const restoreRes = db.restoreDatabaseBackup(backup);
assert(restoreRes.success === true, 'Database restore failed');
console.log('   ✅ Full database backup export & restore working');

// Clean up test tasks
db.deleteTask(task.id);
db.deleteTask(nextOccurrence.id);

console.log('\n🎉 ALL 9 ARCHITECTURAL CAPABILITY TESTS PASSED WITH ZERO ERRORS!\n');

import {
  countTasksByDueDate,
  deleteTaskById,
  getTaskById,
  getTaskDetail,
  insertTask,
  listPlannerToday,
  listTasksDueOn,
  listTasksForToday,
  setTaskCompletedAt,
  updateTaskFields,
} from '../../database/repositories/taskRepository';
import { addDays, isValidDateKey, monthRange, nowIso, parseDateKey, toDateKey } from '../../utils/dates';
import { ValidationError } from '../../utils/errors';
import { newId } from '../../utils/id';
import { weekStartOf } from './plannerDates';

// Shared by add and edit so both enforce the same rules. `dueDate: null` means "someday".
function cleanTaskInput({ title, description, dueDate, priority }) {
  const cleanTitle = typeof title === 'string' ? title.trim() : '';
  if (!cleanTitle) throw new ValidationError('Add a task title.');
  if (![1, 2, 3].includes(priority)) throw new ValidationError('Priority must be high, normal or low.');
  if (dueDate !== null && !isValidDateKey(dueDate)) throw new ValidationError('That date is not valid.');
  return {
    title: cleanTitle,
    description: typeof description === 'string' && description.trim() ? description.trim() : null,
    dueDate,
    priority,
  };
}

export async function addTask(db, { title, description = null, dueDate = toDateKey(), priority = 2 }) {
  const clean = cleanTaskInput({ title, description, dueDate, priority });
  await insertTask(db, { id: newId(), ...clean, nowIso: nowIso() });
}

export async function updateTask(db, taskId, { title, description = null, dueDate, priority = 2 }) {
  const existing = await getTaskById(db, taskId);
  if (!existing) throw new ValidationError('That task no longer exists.');
  const clean = cleanTaskInput({ title, description, dueDate: dueDate === undefined ? existing.due_date : dueDate, priority });
  await updateTaskFields(db, { id: taskId, ...clean, nowIso: nowIso() });
}

export async function deleteTask(db, taskId) {
  await deleteTaskById(db, taskId);
}

export async function toggleTask(db, taskId) {
  const task = await getTaskById(db, taskId);
  if (!task) throw new ValidationError('That task no longer exists.');
  const now = nowIso();
  await setTaskCompletedAt(db, taskId, task.completed_at ? null : now, now);
}

// Moves a task to tomorrow (relative to `todayKey`) without changing anything else about it.
export async function rescheduleTaskToTomorrow(db, taskId, todayKey = toDateKey()) {
  const task = await getTaskDetail(db, taskId);
  if (!task) throw new ValidationError('That task no longer exists.');
  await updateTaskFields(db, {
    id: taskId,
    title: task.title,
    description: task.description,
    dueDate: addDays(todayKey, 1),
    priority: task.priority,
    nowIso: nowIso(),
  });
}

export async function getTaskForEdit(db, taskId) {
  const row = await getTaskDetail(db, taskId);
  return row ? mapTask(row, null) : null;
}

function mapTask(r, todayKey) {
  const done = r.completed_at !== null;
  const dueDate = r.due_date ?? null;
  return {
    id: r.id,
    title: r.title,
    description: r.description ?? null,
    dueDate,
    priority: r.priority,
    done,
    overdue: todayKey !== null && !done && dueDate !== null && dueDate < todayKey,
  };
}

function localDayBounds(dateKey) {
  // "Completed today" is a local-day window, converted to UTC instants for comparison.
  return {
    dayStartIso: parseDateKey(dateKey).toISOString(),
    dayEndIso: parseDateKey(addDays(dateKey, 1)).toISOString(),
  };
}

export async function getTodayTasks(db, dateKey) {
  const { dayStartIso, dayEndIso } = localDayBounds(dateKey);
  const rows = await listTasksForToday(db, dateKey, dayStartIso, dayEndIso);
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    dueDate: r.due_date,
    priority: r.priority,
    done: r.completed_at !== null,
    overdue: r.completed_at === null && r.due_date !== null && r.due_date < dateKey,
  }));
}

// Splits the Planner "Today" list into gentle sections. `overdue` is kept as a data flag only;
// the UI labels it "From earlier".
export function groupPlannerToday(tasks) {
  return {
    earlier: tasks.filter((t) => t.overdue),
    today: tasks.filter((t) => !t.overdue && t.dueDate !== null),
    someday: tasks.filter((t) => t.dueDate === null),
  };
}

export async function getPlannerToday(db, dateKey) {
  const { dayStartIso, dayEndIso } = localDayBounds(dateKey);
  const rows = await listPlannerToday(db, dateKey, dayStartIso, dayEndIso);
  return groupPlannerToday(rows.map((r) => mapTask(r, dateKey)));
}

export async function getTasksForDay(db, dateKey, todayKey = toDateKey()) {
  if (!isValidDateKey(dateKey)) throw new ValidationError('That date is not valid.');
  const rows = await listTasksDueOn(db, dateKey);
  return rows.map((r) => mapTask(r, todayKey));
}

function toCountMap(rows) {
  const map = new Map();
  for (const r of rows) map.set(r.due_date, { total: Number(r.total), open: Number(r.open_count) });
  return map;
}

// Seven days, Monday first, each with { dateKey, total, open }. Weeks cross month and year boundaries freely.
export async function getWeekOverview(db, dateKey) {
  const start = weekStartOf(dateKey);
  const counts = toCountMap(await countTasksByDueDate(db, start, addDays(start, 7)));
  return Array.from({ length: 7 }, (_, i) => {
    const key = addDays(start, i);
    const c = counts.get(key);
    return { dateKey: key, total: c?.total ?? 0, open: c?.open ?? 0 };
  });
}

// Days in the month (monthKey 'YYYY-MM') that have at least one task.
export async function getMonthTaskDays(db, monthKey) {
  const { start, endExclusive } = monthRange(`${monthKey}-01`);
  const rows = await countTasksByDueDate(db, start, endExclusive);
  return new Set(rows.map((r) => r.due_date));
}

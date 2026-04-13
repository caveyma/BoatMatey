/**
 * Client-side due math for engine maintenance schedules (planning layer).
 * Next due date/hours are derived from last completion + intervals — not stored in DB v1.
 */

/** @param {string|Date|null|undefined} raw */
export function parseIsoDateOnly(raw) {
  if (raw == null || raw === '') return null;
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return null;
    return new Date(raw.getFullYear(), raw.getMonth(), raw.getDate());
  }
  const s = String(raw);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function formatYmd(day) {
  if (!day) return null;
  const y = day.getFullYear();
  const mo = String(day.getMonth() + 1).padStart(2, '0');
  const d = String(day.getDate()).padStart(2, '0');
  return `${y}-${mo}-${d}`;
}

/** @param {string} isoYmd */
export function addCalendarMonthsToIsoDate(isoYmd, months) {
  const d = parseIsoDateOnly(isoYmd);
  if (!d || months == null || !Number.isFinite(months)) return null;
  const next = new Date(d.getFullYear(), d.getMonth() + months, d.getDate());
  return formatYmd(next);
}

/**
 * Canonical meter reading for interval comparisons (stored in engine JSON notes).
 * @param {object|null|undefined} engine
 * @returns {number|null}
 */
export function getEngineMeterReadingHours(engine) {
  if (!engine) return null;
  const v = engine.engine_meter_hours;
  const n = v != null && v !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {object} schedule
 * @returns {{ nextDueDate: string|null, nextDueHours: number|null }}
 */
export function computeScheduleNextDue(schedule) {
  const im = schedule.interval_months != null ? Number(schedule.interval_months) : null;
  const ih = schedule.interval_hours != null ? Number(schedule.interval_hours) : null;
  let nextDueDate = null;
  let nextDueHours = null;
  if (im && im > 0 && schedule.last_completed_date) {
    const iso = String(schedule.last_completed_date).slice(0, 10);
    nextDueDate = addCalendarMonthsToIsoDate(iso, im);
  }
  if (ih && ih > 0 && schedule.last_completed_engine_hours != null) {
    const base = Number(schedule.last_completed_engine_hours);
    if (Number.isFinite(base)) nextDueHours = base + ih;
  }
  return { nextDueDate, nextDueHours };
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Whole days from today (negative = before today). */
function dayOffsetFromToday(day) {
  if (!day) return null;
  const t0 = startOfDay(new Date()).getTime();
  const t1 = startOfDay(day).getTime();
  return Math.round((t1 - t0) / 86400000);
}

/**
 * @param {object} schedule
 * @param {{ today?: Date, currentEngineHours?: number|null }} ctx
 * @returns {'setup_needed'|'ok'|'due_soon'|'overdue'}
 */
export function computeEngineScheduleStatus(schedule, ctx = {}) {
  const today = ctx.today instanceof Date ? ctx.today : new Date();
  const currentEngineHours =
    ctx.currentEngineHours != null && Number.isFinite(Number(ctx.currentEngineHours))
      ? Number(ctx.currentEngineHours)
      : null;

  const hasMonthRule = !!(schedule.interval_months && Number(schedule.interval_months) > 0);
  const hasHoursRule = !!(schedule.interval_hours && Number(schedule.interval_hours) > 0);
  const hasDateBaseline = !!schedule.last_completed_date;
  const hasHoursBaseline =
    schedule.last_completed_engine_hours != null &&
    Number.isFinite(Number(schedule.last_completed_engine_hours));

  const { nextDueDate, nextDueHours } = computeScheduleNextDue(schedule);

  const canDate = hasMonthRule && hasDateBaseline && !!nextDueDate;
  const canHours = hasHoursRule && hasHoursBaseline && nextDueHours != null;

  if (!canDate && !canHours) {
    if ((hasMonthRule && !hasDateBaseline) || (hasHoursRule && !hasHoursBaseline)) return 'setup_needed';
    return 'setup_needed';
  }

  let dateOverdue = false;
  let dateSoon = false;
  if (canDate) {
    const dueDay = parseIsoDateOnly(nextDueDate);
    if (dueDay) {
      const off = dayOffsetFromToday(dueDay);
      dateOverdue = off != null && off < 0;
      dateSoon = off != null && off >= 0 && off <= 30;
    }
  }

  let hoursOverdue = false;
  let hoursSoon = false;
  if (canHours && currentEngineHours != null) {
    hoursOverdue = currentEngineHours >= nextDueHours;
    hoursSoon = currentEngineHours < nextDueHours && nextDueHours - currentEngineHours <= 10;
  }

  if (dateOverdue || hoursOverdue) return 'overdue';
  if (dateSoon || hoursSoon) return 'due_soon';
  return 'ok';
}

export function formatScheduleIntervalSummary(schedule) {
  const m = schedule.interval_months != null ? Number(schedule.interval_months) : null;
  const h = schedule.interval_hours != null ? Number(schedule.interval_hours) : null;
  const parts = [];
  if (m && m > 0) parts.push(`every ${m} mo`);
  if (h && h > 0) parts.push(`every ${h} h`);
  return parts.length ? parts.join(' · ') : '—';
}

function norm(s) {
  return String(s || '')
    .trim()
    .toLowerCase();
}

/**
 * Loose match between DIY/pro service title and schedule task name (optional post-save prompt).
 * @param {object[]} schedules — active rows for boat
 * @param {{ engineId: string|null, serviceType: string }} param1
 */
export function findSchedulesMatchingServiceEntry(schedules, { engineId, serviceType }) {
  const st = norm(serviceType);
  if (!st || !engineId) return [];
  return schedules.filter((s) => {
    if (s.is_active === false) return false;
    if (s.engine_id !== engineId) return false;
    const tn = norm(s.task_name);
    if (!tn) return false;
    if (tn === st) return true;
    if (tn.length < 4 || st.length < 4) return tn === st;
    return st.includes(tn) || tn.includes(st);
  });
}

/**
 * Calendar-only due math for sails & rigging maintenance schedules.
 */

import { parseIsoDateOnly, addCalendarMonthsToIsoDate } from './engineMaintenanceScheduleDue.js';

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function dayOffsetFromToday(day) {
  if (!day) return null;
  const t0 = startOfDay(new Date()).getTime();
  const t1 = startOfDay(day).getTime();
  return Math.round((t1 - t0) / 86400000);
}

/**
 * @param {object} schedule
 * @returns {{ nextDueDate: string|null }}
 */
export function computeSailsScheduleNextDue(schedule) {
  const im = schedule.interval_months != null ? Number(schedule.interval_months) : null;
  if (!im || im <= 0 || !schedule.last_completed_date) {
    return { nextDueDate: null };
  }
  const iso = String(schedule.last_completed_date).slice(0, 10);
  return { nextDueDate: addCalendarMonthsToIsoDate(iso, im) };
}

/**
 * @param {object} schedule
 * @param {{ today?: Date }} [ctx]
 * @returns {'setup_needed'|'ok'|'due_soon'|'overdue'}
 */
export function computeSailsRiggingScheduleStatus(schedule) {
  const im = schedule.interval_months != null ? Number(schedule.interval_months) : null;
  const hasRule = !!(im && im > 0);
  const hasBaseline = !!schedule.last_completed_date;

  if (!hasRule || !hasBaseline) return 'setup_needed';

  const { nextDueDate } = computeSailsScheduleNextDue(schedule);
  if (!nextDueDate) return 'setup_needed';

  const dueDay = parseIsoDateOnly(nextDueDate);
  if (!dueDay) return 'setup_needed';

  const off = dayOffsetFromToday(dueDay);
  if (off == null) return 'ok';
  if (off < 0) return 'overdue';
  if (off <= 30) return 'due_soon';
  return 'ok';
}

/** @param {object} schedule */
export function formatSailsScheduleIntervalSummary(schedule) {
  const m = schedule.interval_months != null ? Number(schedule.interval_months) : null;
  if (m && m > 0) return `every ${m} mo`;
  return '—';
}

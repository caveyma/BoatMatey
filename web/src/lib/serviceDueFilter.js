/**
 * Shared "next service due" date logic for Service History filters (dashboard + service list).
 * Uses local calendar days; `next_service_due` is expected as YYYY-MM-DD (or parseable prefix).
 */

const MS_PER_DAY = 86400000;

function startOfTodayLocal() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function toDay(raw) {
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

/** Whole days from today: negative = overdue, 0 = today, positive = future */
export function nextServiceDueDayOffset(entry) {
  const day = toDay(entry?.next_service_due);
  if (!day) return null;
  const t0 = startOfTodayLocal().getTime();
  const t1 = day.getTime();
  return Math.round((t1 - t0) / MS_PER_DAY);
}

/**
 * @param {object} entry - service row with optional next_service_due
 * @param {string} filter - '' | 'overdue' | 'due_soon'
 */
export function serviceEntryMatchesDueFilter(entry, filter) {
  if (!filter) return true;
  const off = nextServiceDueDayOffset(entry);
  if (off == null) return false;
  if (filter === 'overdue') return off < 0;
  if (filter === 'due_soon') return off >= 0 && off <= 30;
  return true;
}

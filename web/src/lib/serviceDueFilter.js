/**
 * Shared due logic for service entries + maintenance schedules.
 */

import {
  computeEngineScheduleStatus,
  computeScheduleNextDue,
  getEngineMeterReadingHours
} from './engineMaintenanceScheduleDue.js';
import {
  computeSailsRiggingScheduleStatus,
  computeSailsScheduleNextDue
} from './sailsRiggingMaintenanceScheduleDue.js';

const MS_PER_DAY = 86400000;
export const DUE_SOON_DAYS = 30;

function startOfTodayLocal(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
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

export function fmtYmd(day) {
  if (!day) return '';
  const y = day.getFullYear();
  const m = String(day.getMonth() + 1).padStart(2, '0');
  const d = String(day.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Whole days from today: negative = overdue, 0 = today, positive = future */
export function dayOffsetFromToday(day, now = new Date()) {
  if (!day) return null;
  const t0 = startOfTodayLocal(now).getTime();
  const t1 = day.getTime();
  return Math.round((t1 - t0) / MS_PER_DAY);
}

/** @returns {'overdue'|'due_soon'|'ok'} */
export function getServiceDueStatus(rawDueDate, now = new Date()) {
  const day = toDay(rawDueDate);
  if (!day) return 'ok';
  const off = dayOffsetFromToday(day, now);
  if (off == null) return 'ok';
  if (off < 0) return 'overdue';
  if (off <= DUE_SOON_DAYS) return 'due_soon';
  return 'ok';
}

export function nextServiceDueDayOffset(entry, now = new Date()) {
  const day = toDay(entry?.next_service_due);
  if (!day) return null;
  return dayOffsetFromToday(day, now);
}

function toDueRow(kind, status, label, dateDay, path, id, extra = {}) {
  return {
    id,
    kind,
    status,
    label,
    dateStr: fmtYmd(dateDay),
    sort: dateDay.getTime(),
    path,
    ...extra
  };
}

/**
 * Canonical due rows used by dashboard and Service History.
 * Includes service entries + engine schedules + sail/rigging schedules.
 */
export function buildDueMaintenanceRows({
  boatId,
  serviceEntries = [],
  engineSchedules = [],
  sailsSchedules = [],
  maintenanceSchedules = [],
  engines = [],
  now = new Date()
}) {
  const rows = [];
  const enginesById = new Map(engines.map((e) => [e.id, e]));
  const today = startOfTodayLocal(now);

  function engineDisplayName(engine) {
    if (!engine) return 'Engine';
    const label = (engine.label || engine.name || '').trim();
    if (label) return label;
    const side = (engine.position || '').trim();
    return side ? `${side} engine` : 'Engine';
  }

  for (const s of serviceEntries) {
    const dueDay = toDay(s.next_service_due);
    if (!dueDay) continue;
    const status = getServiceDueStatus(s.next_service_due, now);
    if (status === 'ok') continue;
    const title = (s.service_type || s.title || 'Service').trim() || 'Service';
    rows.push(
      toDueRow(
        'service',
        status,
        `Next due: ${title}`,
        dueDay,
        `/boat/${boatId}/service/${s.id}`,
        s.id,
        { sourceId: s.id, engineId: s.engine_id || null }
      )
    );
  }

  for (const m of maintenanceSchedules) {
    if (m.is_archived) continue;
    const dueDay = toDay(m.next_due_at);
    const dueStatus = dueDay ? getServiceDueStatus(m.next_due_at, now) : 'ok';
    if (dueStatus === 'ok') continue;
    rows.push(
      toDueRow(
        'maintenance_schedule',
        dueStatus,
        `Schedule: ${(m.title || 'Maintenance').trim()}`,
        dueDay || today,
        `/boat/${boatId}/maintenance-schedules?status=${dueStatus}&schedule=${encodeURIComponent(m.id)}`,
        m.id,
        { sourceId: m.id, engineId: m.linked_entity_type === 'engine' ? m.linked_entity_id : null }
      )
    );
  }

  for (const sch of engineSchedules) {
    if (sch.is_active === false) continue;
    const engine = enginesById.get(sch.engine_id);
    const meter = getEngineMeterReadingHours(engine);
    const status = computeEngineScheduleStatus(sch, { today: now, currentEngineHours: meter });
    if (status !== 'overdue' && status !== 'due_soon') continue;

    const { nextDueDate, nextDueHours } = computeScheduleNextDue(sch);
    const anchorFromDate = nextDueDate ? toDay(nextDueDate) : null;
    const engLabel = engineDisplayName(engine);
    const title = (sch.task_name || 'Schedule').trim();
    let label = `Engine schedule: ${engLabel} — ${title}`;
    let anchor = anchorFromDate;

    if (!anchor) {
      anchor = new Date(today);
      if (status === 'overdue') anchor.setDate(anchor.getDate() - 1);
    }
    if (
      status === 'due_soon' &&
      !anchorFromDate &&
      nextDueHours != null &&
      meter != null &&
      meter < nextDueHours
    ) {
      label = `${label} · ${Math.round(nextDueHours - meter)}h to due`;
    }

    rows.push(
      toDueRow(
        'engine_schedule',
        status,
        label,
        anchor,
        `/boat/${boatId}/maintenance-schedules?scope=engine&engine=${encodeURIComponent(sch.engine_id)}&schedule=${encodeURIComponent(sch.id)}`,
        sch.id,
        { sourceId: sch.id, engineId: sch.engine_id || null }
      )
    );
  }

  for (const sch of sailsSchedules) {
    if (sch.is_active === false) continue;
    const status = computeSailsRiggingScheduleStatus(sch);
    if (status !== 'overdue' && status !== 'due_soon') continue;
    const { nextDueDate } = computeSailsScheduleNextDue(sch);
    let anchor = nextDueDate ? toDay(nextDueDate) : null;
    if (!anchor) {
      anchor = new Date(today);
      if (status === 'overdue') anchor.setDate(anchor.getDate() - 1);
    }
    const title = (sch.task_name || 'Schedule').trim();
    rows.push(
      toDueRow(
        'sails_schedule',
        status,
        `Rigging schedule: ${title}`,
        anchor,
        `/boat/${boatId}/maintenance-schedules?scope=sails-rigging&schedule=${encodeURIComponent(sch.id)}`,
        sch.id,
        { sourceId: sch.id, engineId: null }
      )
    );
  }

  rows.sort((a, b) => a.sort - b.sort);
  return rows;
}

/**
 * @param {object} entry - service row with optional next_service_due
 * @param {string} filter - '' | 'overdue' | 'due_soon'
 */
export function serviceEntryMatchesDueFilter(entry, filter) {
  if (!filter) return true;
  const status = getServiceDueStatus(entry?.next_service_due);
  if (filter === 'overdue') return status === 'overdue';
  if (filter === 'due_soon') return status === 'due_soon';
  return true;
}

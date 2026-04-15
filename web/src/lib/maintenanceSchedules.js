import {
  getEngines,
  getMaintenanceSchedules,
  createMaintenanceSchedule,
  updateMaintenanceSchedule,
  deleteMaintenanceSchedule,
  getCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  getEngineMaintenanceSchedules,
  updateEngineMaintenanceSchedule,
  deleteEngineMaintenanceSchedule,
  getSailsRiggingMaintenanceSchedules,
  updateSailsRiggingMaintenanceSchedule,
  deleteSailsRiggingMaintenanceSchedule
} from './dataService.js';
import { computeEngineScheduleStatus, computeScheduleNextDue, getEngineMeterReadingHours } from './engineMaintenanceScheduleDue.js';
import { computeSailsRiggingScheduleStatus, computeSailsScheduleNextDue } from './sailsRiggingMaintenanceScheduleDue.js';
import {
  cancelSingleOsNotification,
  createStableNotificationId,
  scheduleSingleOsNotification
} from './notifications.js';
import { getTemplateDefaults } from './maintenanceScheduleTemplates.js';

export const MAINTENANCE_DUE_SOON_DAYS = 30;
export const ENGINE_SCHEDULE_TYPES = ['Oil change', 'Fuel filter', 'Impeller', 'Belt inspection', 'Cooling system check', 'Full service', 'Gearbox service', 'Custom'];
const MAINTENANCE_EVENT_TYPE = 'maintenance_schedule';

function toDay(raw) {
  if (!raw) return null;
  const m = String(raw).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function daysFromToday(rawDate) {
  const d = toDay(rawDate);
  if (!d) return null;
  const now = new Date();
  const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((d.getTime() - t0) / 86400000);
}

function statusFromDays(off) {
  if (off == null) return 'upcoming';
  if (off < 0) return 'overdue';
  if (off <= MAINTENANCE_DUE_SOON_DAYS) return 'due_soon';
  return 'upcoming';
}

function computeUnifiedStatus(schedule, enginesById) {
  if (schedule.is_archived) return 'archived';
  if (schedule.source === 'legacy_engine') return schedule.legacy_status;
  if (schedule.source === 'legacy_sails') return schedule.legacy_status;

  const dateStatus = statusFromDays(daysFromToday(schedule.next_due_at));
  if (schedule.frequency_type === 'hours' || schedule.frequency_type === 'date_and_hours') {
    const eng = schedule.linked_entity_type === 'engine' ? enginesById.get(schedule.linked_entity_id) : null;
    const meter = getEngineMeterReadingHours(eng);
    if (schedule.next_due_hours != null && meter != null) {
      const off = Number(schedule.next_due_hours) - Number(meter);
      if (off < 0) return 'overdue';
      if (off <= 30) return 'due_soon';
    }
    if (schedule.frequency_type === 'hours') return dateStatus === 'upcoming' ? 'upcoming' : dateStatus;
  }
  return dateStatus;
}

function normalizeLegacyEngine(row, boatId, enginesById) {
  const status = computeEngineScheduleStatus(row, {
    today: new Date(),
    currentEngineHours: getEngineMeterReadingHours(enginesById.get(row.engine_id))
  });
  const due = computeScheduleNextDue(row);
  const eng = enginesById.get(row.engine_id);
  const engineName = (eng?.label || eng?.name || '').trim() || 'Engine';
  return {
    id: row.id,
    source: 'legacy_engine',
    boat_id: boatId,
    category: 'Engine',
    linked_entity_type: 'engine',
    linked_entity_id: row.engine_id,
    title: row.task_name || 'Engine maintenance',
    notes: row.notes || '',
    frequency_type: row.interval_months && row.interval_hours ? 'date_and_hours' : row.interval_hours ? 'hours' : 'date',
    frequency_mode: row.interval_months && row.interval_hours ? 'date_and_hours' : row.interval_hours ? 'hours' : 'date',
    schedule_type: 'Custom',
    interval_months: row.interval_months ?? null,
    interval_hours: row.interval_hours ?? null,
    last_completed_at: row.last_completed_date || null,
    last_completed_hours: row.last_completed_engine_hours ?? null,
    next_due_at: due.nextDueDate || null,
    next_due_hours: due.nextDueHours ?? null,
    remind_offset_days: 7,
    notification_enabled: true,
    notification_id: null,
    is_archived: row.is_active === false,
    linked_name: engineName,
    legacy_status: status
  };
}

function normalizeLegacySails(row, boatId) {
  const status = computeSailsRiggingScheduleStatus(row);
  const due = computeSailsScheduleNextDue(row);
  return {
    id: row.id,
    source: 'legacy_sails',
    boat_id: boatId,
    category: row.category || 'Sail & Rigging',
    linked_entity_type: 'sails_rigging',
    linked_entity_id: null,
    title: row.task_name || 'Sail & rigging maintenance',
    notes: row.notes || '',
    frequency_type: 'date',
    frequency_mode: 'date',
    schedule_type: 'Custom',
    interval_months: row.interval_months ?? null,
    interval_hours: null,
    last_completed_at: row.last_completed_date || null,
    last_completed_hours: null,
    next_due_at: due.nextDueDate || null,
    next_due_hours: null,
    remind_offset_days: 7,
    notification_enabled: true,
    notification_id: null,
    is_archived: row.is_active === false,
    linked_name: row.category || 'Sail & Rigging',
    legacy_status: status
  };
}

function normalizeCentral(row) {
  return {
    ...row,
    source: 'central',
    schedule_type: row.schedule_type || 'Custom',
    remind_offset_days: row.remind_offset_days != null ? Number(row.remind_offset_days) : 7,
    notification_enabled: row.notification_enabled !== false,
    notification_id: row.notification_id != null ? Number(row.notification_id) : null,
    linked_name: row.linked_entity_type === 'engine' ? 'Engine' : ''
  };
}

function addMonths(ymd, months) {
  const d = toDay(ymd);
  if (!d || !months) return ymd || null;
  d.setMonth(d.getMonth() + Number(months));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function computeScheduleRollForward(row, completedDate, completedHours) {
  const intervalMonths = row.interval_months != null ? Number(row.interval_months) : null;
  const intervalHours = row.interval_hours != null ? Number(row.interval_hours) : null;
  return {
    last_completed_at: completedDate || null,
    last_completed_hours:
      completedHours != null && completedHours !== '' && Number.isFinite(Number(completedHours))
        ? Number(completedHours)
        : null,
    next_due_at:
      completedDate && intervalMonths && intervalMonths > 0
        ? addMonths(completedDate, intervalMonths)
        : row.next_due_at || null,
    next_due_hours:
      completedHours != null && completedHours !== '' && intervalHours && intervalHours > 0
        ? Number(completedHours) + Number(intervalHours)
        : row.next_due_hours ?? null
  };
}

function toLocalNoonDate(rawYmd) {
  const d = toDay(rawYmd);
  if (!d) return null;
  d.setHours(12, 0, 0, 0);
  return d;
}

function minusDays(date, days) {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() - Number(days || 0));
  return d;
}

async function syncScheduleNotification(row) {
  const prevId = row.notification_id != null ? Number(row.notification_id) : null;
  const hasDate = !!row.next_due_at;
  const enabled = row.notification_enabled !== false;
  const archived = !!row.is_archived;

  if (!enabled || archived || !hasDate) {
    if (prevId) await cancelSingleOsNotification(prevId);
    if (prevId != null) {
      await updateMaintenanceSchedule(row.id, { notification_id: null });
      row.notification_id = null;
    }
    return row;
  }

  const dueAt = toLocalNoonDate(row.next_due_at);
  if (!dueAt) return row;
  const offset = row.remind_offset_days != null ? Number(row.remind_offset_days) : 7;
  const remindAt = minusDays(dueAt, offset);
  if (remindAt.getTime() <= Date.now()) {
    if (prevId) await cancelSingleOsNotification(prevId);
    if (prevId != null) {
      await updateMaintenanceSchedule(row.id, { notification_id: null });
      row.notification_id = null;
    }
    return row;
  }
  const newId = createStableNotificationId(`maintenance:${row.id}:${row.next_due_at}:${offset}`);

  if (prevId && prevId !== newId) {
    await cancelSingleOsNotification(prevId);
  }

  const result = await scheduleSingleOsNotification({
    notificationId: newId,
    title: 'Maintenance Due Soon',
    body: `${row.title || 'Maintenance schedule'} is due on ${row.next_due_at}`,
    at: remindAt
  });
  if (result.ok) {
    if (prevId !== newId) {
      await updateMaintenanceSchedule(row.id, { notification_id: newId });
      row.notification_id = newId;
    }
    return row;
  }

  if (prevId && prevId !== newId) {
    await cancelSingleOsNotification(prevId);
    await updateMaintenanceSchedule(row.id, { notification_id: null });
    row.notification_id = null;
  }
  return row;
}

function shouldHaveCalendarEvent(row) {
  return row?.source === 'central' && !row?.is_archived && !!row?.next_due_at;
}

function toMaintenanceCalendarPayload(row) {
  return {
    date: row.next_due_at,
    title: row.title || 'Maintenance schedule',
    notes: row.notes || null,
    time: null,
    repeat: null,
    repeat_until: null,
    reminder_minutes: null,
    type: MAINTENANCE_EVENT_TYPE,
    schedule_id: row.id
  };
}

async function getScheduleLinkedCalendarEvents(boatId, scheduleId) {
  const events = await getCalendarEvents(boatId);
  return (events || []).filter(
    (ev) =>
      ev?.type === MAINTENANCE_EVENT_TYPE &&
      String(ev?.schedule_id || '') === String(scheduleId || '')
  );
}

async function removeDuplicateScheduleEvents(boatId, scheduleId, keepEventId = null) {
  const events = await getScheduleLinkedCalendarEvents(boatId, scheduleId);
  const duplicateRows = events.filter((ev) => !keepEventId || ev.id !== keepEventId);
  for (const ev of duplicateRows) {
    if (ev?.id) await deleteCalendarEvent(ev.id, { allowWithoutSubscription: true });
  }
}

async function syncCentralScheduleCalendarEvent(row) {
  const boatId = row?.boat_id;
  if (!boatId || row?.source !== 'central' || !row?.id) return;

  const linkedEvents = await getScheduleLinkedCalendarEvents(boatId, row.id);
  const canonicalEvent = linkedEvents[0] || null;
  if (linkedEvents.length > 1) {
    await removeDuplicateScheduleEvents(boatId, row.id, canonicalEvent?.id || null);
  }

  if (!shouldHaveCalendarEvent(row)) {
    if (canonicalEvent?.id) await deleteCalendarEvent(canonicalEvent.id, { allowWithoutSubscription: true });
    return;
  }

  const payload = toMaintenanceCalendarPayload(row);
  if (!canonicalEvent) {
    await createCalendarEvent(boatId, payload);
    await removeDuplicateScheduleEvents(boatId, row.id, null);
    return;
  }

  await updateCalendarEvent(canonicalEvent.id, payload);
}

export async function backfillMaintenanceScheduleCalendarEvents(boatId) {
  if (!boatId) return;
  const schedules = await getMaintenanceSchedules(boatId);
  const events = await getCalendarEvents(boatId);
  const linkedRows = (events || []).filter((ev) => ev?.type === MAINTENANCE_EVENT_TYPE && ev?.schedule_id);
  const bySchedule = new Map();
  for (const ev of linkedRows) {
    const key = String(ev.schedule_id);
    if (!bySchedule.has(key)) bySchedule.set(key, []);
    bySchedule.get(key).push(ev);
  }

  for (const schedule of schedules || []) {
    const wrapped = { ...schedule, source: 'central', boat_id: boatId };
    if (shouldHaveCalendarEvent(wrapped)) {
      await syncCentralScheduleCalendarEvent(wrapped);
    } else {
      const linked = bySchedule.get(String(schedule.id)) || [];
      for (const ev of linked) {
        if (ev?.id) await deleteCalendarEvent(ev.id, { allowWithoutSubscription: true });
      }
    }
  }
}

export async function getUnifiedMaintenanceSchedules(boatId) {
  const [engines, central, legacyEngine, legacySails] = await Promise.all([
    getEngines(boatId),
    getMaintenanceSchedules(boatId),
    getEngineMaintenanceSchedules(boatId),
    getSailsRiggingMaintenanceSchedules(boatId)
  ]);
  const enginesById = new Map((engines || []).map((e) => [e.id, e]));
  const combined = [
    ...(central || []).map(normalizeCentral),
    ...(legacyEngine || []).map((row) => normalizeLegacyEngine(row, boatId, enginesById)),
    ...(legacySails || []).map((row) => normalizeLegacySails(row, boatId))
  ].map((row) => ({ ...row, status: computeUnifiedStatus(row, enginesById) }));
  combined.sort((a, b) => {
    const rank = { overdue: 0, due_soon: 1, upcoming: 2, archived: 3 };
    const ra = rank[a.status] ?? 9;
    const rb = rank[b.status] ?? 9;
    if (ra !== rb) return ra - rb;
    const da = toDay(a.next_due_at)?.getTime() || Number.MAX_SAFE_INTEGER;
    const db = toDay(b.next_due_at)?.getTime() || Number.MAX_SAFE_INTEGER;
    return da - db;
  });
  return combined;
}

export async function createUnifiedMaintenanceSchedule(boatId, payload) {
  if (payload.interval_months == null || payload.interval_hours == null || !payload.frequency_mode) {
    const t = getTemplateDefaults(payload.category || 'Other', payload.schedule_type || 'Custom');
    if (t) {
      if (payload.frequency_mode == null) payload.frequency_mode = t.frequency_mode;
      if (payload.interval_months == null) payload.interval_months = t.interval_months;
      if (payload.interval_hours == null) payload.interval_hours = t.interval_hours;
      if (payload.remind_offset_days == null) payload.remind_offset_days = t.remind_offset_days;
    }
  }
  const created = await createMaintenanceSchedule(boatId, payload);
  if (!created) return created;
  await syncScheduleNotification(created);
  await syncCentralScheduleCalendarEvent({ ...created, source: 'central', boat_id: boatId });
  return created;
}

export async function updateUnifiedMaintenanceSchedule(row, payload) {
  if (row.source === 'legacy_engine') {
    const update = {
      task_name: payload.title ?? row.title,
      category: payload.category ?? row.category,
      notes: payload.notes ?? row.notes,
      last_completed_date: payload.last_completed_at ?? row.last_completed_at,
      last_completed_engine_hours: payload.last_completed_hours ?? row.last_completed_hours,
      interval_months: payload.interval_metadata?.interval_months ?? row.interval_months,
      interval_hours: payload.interval_metadata?.interval_hours ?? row.interval_hours,
      is_active: payload.is_archived == null ? row.is_archived !== true : !payload.is_archived
    };
    return updateEngineMaintenanceSchedule(row.id, update);
  }
  if (row.source === 'legacy_sails') {
    const update = {
      task_name: payload.title ?? row.title,
      category: payload.category ?? row.category,
      notes: payload.notes ?? row.notes,
      last_completed_date: payload.last_completed_at ?? row.last_completed_at,
      interval_months: payload.interval_metadata?.interval_months ?? row.interval_months,
      is_active: payload.is_archived == null ? row.is_archived !== true : !payload.is_archived
    };
    return updateSailsRiggingMaintenanceSchedule(row.id, update);
  }
  if (payload.frequency_mode == null && payload.frequency_type != null) {
    payload.frequency_mode = payload.frequency_type;
  }
  await updateMaintenanceSchedule(row.id, payload);
  const merged = { ...row, ...payload };
  await syncScheduleNotification(merged);
  await syncCentralScheduleCalendarEvent(merged);
  return merged;
}

export async function rollForwardUnifiedMaintenanceSchedule(row, completedDate, completedHours) {
  if (row.source !== 'central') return null;
  const next = computeScheduleRollForward(row, completedDate, completedHours);
  return updateUnifiedMaintenanceSchedule(row, next);
}

export async function deleteUnifiedMaintenanceSchedule(row) {
  if (row.source === 'central' && row.notification_id) {
    await cancelSingleOsNotification(row.notification_id);
  }
  if (row.source === 'central') {
    const linkedEvents = await getScheduleLinkedCalendarEvents(row.boat_id, row.id);
    for (const ev of linkedEvents) {
      if (ev?.id) await deleteCalendarEvent(ev.id, { allowWithoutSubscription: true });
    }
  }
  if (row.source === 'legacy_engine') return deleteEngineMaintenanceSchedule(row.id);
  if (row.source === 'legacy_sails') return deleteSailsRiggingMaintenanceSchedule(row.id);
  return deleteMaintenanceSchedule(row.id);
}

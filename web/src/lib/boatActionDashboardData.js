/**
 * Assembles "action dashboard" metrics for one boat from synced local storage
 * plus optional fuel log + calendar arrays from the same load cycle as the boat dashboard.
 */

import {
  serviceHistoryStorage,
  hauloutStorage,
  projectsStorage,
  inventoryStorage,
  shipsLogStorage,
  enginesStorage,
  engineMaintenanceScheduleStorage,
  sailsRiggingMaintenanceScheduleStorage
} from './storage.js';
import {
  computeEngineScheduleStatus,
  computeScheduleNextDue,
  getEngineMeterReadingHours
} from './engineMaintenanceScheduleDue.js';
import {
  computeSailsRiggingScheduleStatus,
  computeSailsScheduleNextDue
} from './sailsRiggingMaintenanceScheduleDue.js';
import {
  getInventoryDetail,
  inventoryItemNeedsReview,
  inventoryNeedsAttentionStrict,
  inventoryRecommendedReplacementOffsetDays,
  inventoryReplacementDueOrSoon,
  normalizeInventoryItem
} from './inventoryMarine.js';

const MS_PER_DAY = 86400000;

function startOfTodayLocal() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** @param {string|Date|null|undefined} raw */
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

/** @returns {number|null} whole days from today (negative = overdue) */
function dayOffsetFromToday(day) {
  if (!day) return null;
  const t0 = startOfTodayLocal().getTime();
  const t1 = day.getTime();
  return Math.round((t1 - t0) / MS_PER_DAY);
}

function fmtYmd(day) {
  if (!day) return '';
  const y = day.getFullYear();
  const m = String(day.getMonth() + 1).padStart(2, '0');
  const d = String(day.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isIssueRowOpen(p) {
  if (!p || p.archived_at) return false;
  const type = p.type || 'Project';
  if (type !== 'Issue') return false;
  const st = p.status || '';
  return !['Resolved', 'Closed'].includes(st);
}

function isProjectRowOpen(p) {
  if (!p || p.archived_at) return false;
  const type = p.type || 'Project';
  const st = p.status || '';
  if (type === 'Issue') return isIssueRowOpen(p);
  return st !== 'Completed';
}

function truncateText(s, max) {
  const t = (s || '').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}\u2026`;
}

/**
 * One-line contextual summary under the boat name (real data only).
 * @param {string} boatId
 * @param {ReturnType<typeof buildBoatActionDashboardModel>} model
 */
export function computeBoatDashboardTagline(boatId, model) {
  const { overdue, dueSoon, counts } = model;
  if (overdue.length > 0) {
    const raw = overdue[0].label
      .replace(/^Next due:\s*/i, '')
      .replace(/^Project:\s*/i, '')
      .replace(/^Issue:\s*/i, '');
    return `Overdue: ${truncateText(raw, 46)}`;
  }
  if (dueSoon.length > 0) {
    const r = dueSoon[0];
    const d = toDay(r.dateStr);
    const off = dayOffsetFromToday(d);
    const raw = r.label.replace(/^Next due:\s*/i, '');
    if (off === 0) return `Due today: ${truncateText(raw, 44)}`;
    return `Next due: ${truncateText(raw, 36)} in ${off} day${off === 1 ? '' : 's'}`;
  }

  const services = serviceHistoryStorage.getAll(boatId);
  let bestFuture = null;
  for (const s of services) {
    const due = toDay(s.next_service_due);
    if (!due) continue;
    const off = dayOffsetFromToday(due);
    if (off == null || off < 0) continue;
    const t = (s.service_type || s.title || 'Service').trim();
    if (!bestFuture || off < bestFuture.off) bestFuture = { off, label: t || 'Service' };
  }
  if (bestFuture) {
    return `Next service due in ${bestFuture.off} day${bestFuture.off === 1 ? '' : 's'} — ${truncateText(bestFuture.label, 36)}`;
  }

  if (counts.openIssues > 0) {
    return `${counts.openIssues} open issue${counts.openIssues === 1 ? '' : 's'} need review`;
  }
  if (counts.inventoryReview > 0) {
    return `${counts.inventoryReview} inventory item${counts.inventoryReview === 1 ? '' : 's'} need review (condition or replacement date)`;
  }
  if (counts.lowStock > 0) {
    return `${counts.lowStock} inventory item${counts.lowStock === 1 ? '' : 's'} at or below required stock`;
  }

  const engines = enginesStorage.getAll(boatId);
  if (!engines.length) {
    return 'Your boat record is just getting started — add your engine or first service below';
  }
  if (!services.length) {
    return 'Your boat record is just getting started — log your first service below';
  }
  return 'Your boat record is just getting started — add your first service or set a next due date below';
}

/**
 * @param {string} boatId
 * @param {{ fuelLogs?: object[], calendarEvents?: object[] }} [extras]
 */
export function buildBoatActionDashboardModel(boatId, extras = {}) {
  const fuelLogs = Array.isArray(extras.fuelLogs) ? extras.fuelLogs : [];
  const calendarEvents = Array.isArray(extras.calendarEvents) ? extras.calendarEvents : [];

  const services = serviceHistoryStorage.getAll(boatId);
  const haulouts = hauloutStorage.getAll(boatId);
  const projects = projectsStorage.getAll(boatId);
  const inventory = inventoryStorage.getAll(boatId);
  const logs = shipsLogStorage.getAll(boatId);

  /** @type {{ kind: string, label: string, dateStr: string, sort: number, href: string }[]} */
  const overdue = [];
  /** @type {{ kind: string, label: string, dateStr: string, sort: number, href: string }[]} */
  const dueSoon = [];

  const pushDateBucket = (day, kind, label, path, buckets) => {
    const off = dayOffsetFromToday(day);
    if (off == null) return;
    const row = { kind, label, dateStr: fmtYmd(day), sort: day.getTime(), path };
    if (off < 0) buckets.overdue.push(row);
    else if (off >= 0 && off <= 30) buckets.dueSoon.push(row);
  };

  const buckets = { overdue, dueSoon };

  for (const s of services) {
    const due = toDay(s.next_service_due);
    if (due) {
      const title = (s.service_type || s.title || 'Service').trim() || 'Service';
      pushDateBucket(due, 'service', `Next due: ${title}`, `/boat/${boatId}/service/${s.id}`, buckets);
    }
  }

  for (const h of haulouts) {
    const due = toDay(h.next_haulout_due);
    if (due) {
      pushDateBucket(due, 'haulout', 'Next haul-out due', `/boat/${boatId}/haulout/${h.id}`, buckets);
    }
  }

  for (const p of projects) {
    if (!isProjectRowOpen(p)) continue;
    const td = toDay(p.target_date);
    if (td) {
      const name = (p.project_name || 'Untitled').trim();
      const typeLabel = (p.type || 'Project') === 'Issue' ? 'Issue' : 'Project';
      pushDateBucket(td, 'project', `${typeLabel}: ${name}`, `/boat/${boatId}/projects/${p.id}`, buckets);
    }
  }

  for (const ev of calendarEvents) {
    if (!ev?.date) continue;
    const d = toDay(ev.date);
    if (!d) continue;
    const title = (ev.title || 'Calendar').trim();
    pushDateBucket(d, 'calendar', title, `/calendar`, buckets);
  }

  const schedules = engineMaintenanceScheduleStorage.getAll(boatId);
  const engines = enginesStorage.getAll(boatId);
  const enginesById = new Map(engines.map((e) => [e.id, e]));
  const todayForSched = new Date();

  for (const sch of schedules) {
    if (sch.is_active === false) continue;
    const engine = enginesById.get(sch.engine_id);
    const meter = getEngineMeterReadingHours(engine);
    const st = computeEngineScheduleStatus(sch, { today: todayForSched, currentEngineHours: meter });
    if (st !== 'overdue' && st !== 'due_soon') continue;

    const { nextDueDate, nextDueHours } = computeScheduleNextDue(sch);
    const engLabel = (engine && (engine.label || '').trim()) || 'Engine';
    const title = (sch.task_name || 'Schedule').trim();
    const label = `Schedule: ${title} (${engLabel})`;
    const path = `/boat/${boatId}/engines/${sch.engine_id}`;
    const t0 = startOfTodayLocal();

    if (st === 'overdue') {
      let anchor = nextDueDate ? toDay(nextDueDate) : null;
      if (!anchor) {
        anchor = new Date(t0);
        anchor.setDate(anchor.getDate() - 1);
      }
      overdue.push({ kind: 'engine_schedule', label, dateStr: fmtYmd(anchor), sort: anchor.getTime(), path });
    } else {
      const anchorFromDate = nextDueDate ? toDay(nextDueDate) : null;
      if (anchorFromDate) {
        const off = dayOffsetFromToday(anchorFromDate);
        if (off != null && off >= 0 && off <= 30) {
          dueSoon.push({
            kind: 'engine_schedule',
            label,
            dateStr: fmtYmd(anchorFromDate),
            sort: anchorFromDate.getTime(),
            path
          });
        }
      } else if (
        nextDueHours != null &&
        meter != null &&
        meter < nextDueHours &&
        nextDueHours - meter <= 10
      ) {
        dueSoon.push({
          kind: 'engine_schedule',
          label: `${label} · ${Math.round(nextDueHours - meter)}h to due`,
          dateStr: fmtYmd(t0),
          sort: t0.getTime(),
          path
        });
      }
    }
  }

  const sailsSchedules = sailsRiggingMaintenanceScheduleStorage.getAll(boatId);
  const t0 = startOfTodayLocal();

  const inventoryPath = `/boat/${boatId}/inventory?attention=needs`;

  for (const inv of inventory) {
    const row = normalizeInventoryItem(inv);
    const name = (row.name || 'Item').trim() || 'Item';
    if (inventoryNeedsAttentionStrict(row)) {
      const d = getInventoryDetail(row);
      const c = (d.condition || '').trim();
      const off = inventoryRecommendedReplacementOffsetDays(row);
      if (off !== null && off < 0) {
        const anchor = toDay(d.recommended_replacement_date) || (() => {
          const x = new Date(startOfTodayLocal());
          x.setDate(x.getDate() - 1);
          return x;
        })();
        overdue.push({
          kind: 'inventory',
          label: `Inventory: ${name} — replacement date passed`,
          dateStr: fmtYmd(anchor),
          sort: anchor.getTime(),
          path: inventoryPath
        });
      } else if (c === 'Needs Replacement') {
        const t0 = startOfTodayLocal();
        overdue.push({
          kind: 'inventory',
          label: `Inventory: ${name} — needs replacement`,
          dateStr: fmtYmd(t0),
          sort: t0.getTime(),
          path: inventoryPath
        });
      } else {
        const t0 = startOfTodayLocal();
        dueSoon.push({
          kind: 'inventory',
          label: `Inventory: ${name} — needs attention`,
          dateStr: fmtYmd(t0),
          sort: t0.getTime(),
          path: inventoryPath
        });
      }
      continue;
    }
    if (inventoryReplacementDueOrSoon(row)) {
      const d = getInventoryDetail(row);
      const day = toDay(d.recommended_replacement_date);
      const off = inventoryRecommendedReplacementOffsetDays(row);
      if (day && off !== null && off >= 0) {
        dueSoon.push({
          kind: 'inventory',
          label: `Inventory: ${name} — replacement due in ${off} day${off === 1 ? '' : 's'}`,
          dateStr: fmtYmd(day),
          sort: day.getTime(),
          path: inventoryPath
        });
      }
    }
  }

  for (const sch of sailsSchedules) {
    if (sch.is_active === false) continue;
    const st = computeSailsRiggingScheduleStatus(sch);
    if (st !== 'overdue' && st !== 'due_soon') continue;

    const { nextDueDate } = computeSailsScheduleNextDue(sch);
    const title = (sch.task_name || 'Schedule').trim();
    const label = `Rigging schedule: ${title}`;
    const path = `/boat/${boatId}/sails-rigging`;

    if (st === 'overdue') {
      let anchor = nextDueDate ? toDay(nextDueDate) : null;
      if (!anchor) {
        anchor = new Date(t0);
        anchor.setDate(anchor.getDate() - 1);
      }
      overdue.push({ kind: 'sails_schedule', label, dateStr: fmtYmd(anchor), sort: anchor.getTime(), path });
    } else {
      const anchorFromDate = nextDueDate ? toDay(nextDueDate) : null;
      if (anchorFromDate) {
        const off = dayOffsetFromToday(anchorFromDate);
        if (off != null && off >= 0 && off <= 30) {
          dueSoon.push({
            kind: 'sails_schedule',
            label,
            dateStr: fmtYmd(anchorFromDate),
            sort: anchorFromDate.getTime(),
            path
          });
        }
      }
    }
  }

  const openIssues = projects.filter(isIssueRowOpen);

  const lowStockItems = inventory.filter((i) => {
    const stock = i.in_stock_level != null ? Number(i.in_stock_level) : 0;
    const req = i.required_quantity != null ? Number(i.required_quantity) : 0;
    return stock <= req;
  });

  const inventoryReview = inventory.filter((i) => inventoryItemNeedsReview(normalizeInventoryItem(i))).length;

  /** Recent activity: services, passage log, fuel (when provided), projects — merged by date */
  const recent = [];

  for (const s of services) {
    const d = toDay(s.date || s.service_date);
    if (!d) continue;
    recent.push({
      type: 'Service',
      title: (s.service_type || s.title || 'Service').trim() || 'Service',
      dateStr: fmtYmd(d),
      sort: d.getTime(),
      path: `/boat/${boatId}/service/${s.id}`
    });
  }

  for (const e of logs) {
    const d = toDay(e.date || e.trip_date);
    if (!d) continue;
    recent.push({
      type: 'Passage log',
      title: (e.title || `${e.departure || ''} → ${e.arrival || ''}` || 'Passage').trim() || 'Passage',
      dateStr: fmtYmd(d),
      sort: d.getTime(),
      path: `/boat/${boatId}/log/${e.id}`
    });
  }

  for (const f of fuelLogs) {
    const d = toDay(f.log_date);
    if (!d) continue;
    const litres = f.fuel_added_litres != null ? `${f.fuel_added_litres} L` : 'Fuel log';
    recent.push({
      type: 'Fuel',
      title: litres,
      dateStr: fmtYmd(d),
      sort: d.getTime(),
      path: `/boat/${boatId}/fuel`
    });
  }

  for (const p of projects) {
    if (p.archived_at) continue;
    const d = toDay(p.date_reported || p.target_date || p.updated_at);
    if (!d) continue;
    recent.push({
      type: (p.type || 'Project') === 'Issue' ? 'Issue' : 'Project',
      title: (p.project_name || 'Untitled').trim() || 'Untitled',
      dateStr: fmtYmd(d),
      sort: d.getTime(),
      path: `/boat/${boatId}/projects/${p.id}`
    });
  }

  recent.sort((a, b) => b.sort - a.sort);
  const recentTop = recent.slice(0, 4);

  overdue.sort((a, b) => a.sort - b.sort);
  dueSoon.sort((a, b) => a.sort - b.sort);

  const hasMaintenanceScheduleAttention =
    overdue.some((r) => r.kind === 'engine_schedule' || r.kind === 'sails_schedule') ||
    dueSoon.some((r) => r.kind === 'engine_schedule' || r.kind === 'sails_schedule');

  const model = {
    counts: {
      overdue: overdue.length,
      dueSoon: dueSoon.length,
      openIssues: openIssues.length,
      lowStock: lowStockItems.length,
      inventoryReview
    },
    overdue,
    dueSoon,
    openIssues,
    lowStockItems,
    recentTop,
    hasMaintenanceScheduleAttention
  };
  model.tagline = computeBoatDashboardTagline(boatId, model);
  return model;
}

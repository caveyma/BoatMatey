/**
 * Assembles "action dashboard" metrics for one boat from synced local storage
 * plus optional fuel log + calendar arrays from the same load cycle as the boat dashboard.
 */

import {
  serviceHistoryStorage,
  projectsStorage,
  inventoryStorage,
  shipsLogStorage,
  enginesStorage,
  engineMaintenanceScheduleStorage,
  sailsRiggingMaintenanceScheduleStorage
} from './storage.js';
import {
  buildDueMaintenanceRows
} from './serviceDueFilter.js';
import {
  inventoryItemNeedsReview,
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

function inventoryItemLabel(item) {
  return (
    (item?.item_name || item?.name || item?.part_name || item?.title || '').trim() ||
    'Inventory item'
  );
}

function issueItemLabel(issue) {
  return ((issue?.project_name || issue?.title || '').trim() || 'Issue');
}

function dayOffsetFromDateStr(dateStr) {
  const d = toDay(dateStr);
  return dayOffsetFromToday(d);
}

function toAttentionDueRow(row, status) {
  const label = (row?.label || '').trim();
  const isRigging = row.kind === 'sails_schedule' || /^Rigging schedule:\s*/i.test(label);
  const isEngine = row.kind === 'engine_schedule' || /^Engine schedule:\s*/i.test(label);
  const source = isRigging ? 'Rigging schedule' : isEngine ? 'Engine schedule' : 'Service history';
  const title = label
    .replace(/^Rigging schedule:\s*/i, '')
    .replace(/^Engine schedule:\s*/i, '')
    .replace(/^Next due:\s*/i, '')
    .trim();
  return {
    status,
    dateStr: row.dateStr || '',
    title: title || 'Maintenance item',
    context: source,
    path: row.path,
    priority: status === 'OVERDUE' ? 10 : 20,
    sort: Number(row.sort) || 0
  };
}

function buildAttentionRows(model, boatId) {
  const rows = [];
  for (const row of model.overdue) rows.push(toAttentionDueRow(row, 'OVERDUE'));
  for (const row of model.dueSoon) rows.push(toAttentionDueRow(row, 'DUE'));

  for (const item of model.lowStockItems) {
    const stock = item?.in_stock_level != null ? Number(item.in_stock_level) : 0;
    const req = item?.required_quantity != null ? Number(item.required_quantity) : 0;
    const itemId = item?.id ? encodeURIComponent(String(item.id)) : '';
    rows.push({
      status: 'LOW STOCK',
      dateStr: '',
      title: inventoryItemLabel(item),
      context: 'Inventory',
      path: itemId
        ? `/boat/${boatId}/inventory?stock=low&item=${itemId}`
        : `/boat/${boatId}/inventory?stock=low`,
      priority: 30,
      sort: req - stock
    });
  }

  for (const issue of model.openIssues) {
    const d = toDay(issue.date_reported || issue.target_date || issue.updated_at);
    rows.push({
      status: 'OPEN',
      dateStr: d ? fmtYmd(d) : '',
      title: issueItemLabel(issue),
      context: 'Projects & Issues',
      path: `/boat/${boatId}/projects/${issue.id}`,
      priority: 40,
      sort: d ? d.getTime() : 0
    });
  }

  rows.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    if (a.priority === 30) return b.sort - a.sort;
    return a.sort - b.sort;
  });
  return rows;
}

/**
 * One-line contextual summary under the boat name (real data only).
 * @param {string} boatId
 * @param {ReturnType<typeof buildBoatActionDashboardModel>} model
 */
export function computeBoatDashboardTagline(boatId, model) {
  const { counts, attentionRows = [] } = model;
  const top = attentionRows[0];
  if (top) {
    if (top.status === 'OVERDUE') {
      return `Overdue: ${truncateText(`${top.context} — ${top.title}`, 52)}`;
    }
    if (top.status === 'DUE') {
      const off = dayOffsetFromDateStr(top.dateStr);
      if (off === 0) return `Due today: ${truncateText(`${top.context} — ${top.title}`, 50)}`;
      if (off != null && off > 0) {
        return `Due soon: ${truncateText(`${top.context} — ${top.title}`, 40)} in ${off} day${off === 1 ? '' : 's'}`;
      }
      return `Due soon: ${truncateText(`${top.context} — ${top.title}`, 50)}`;
    }
    if (top.status === 'LOW STOCK') {
      return `Low stock: ${truncateText(top.title, 44)} below required stock`;
    }
    if (top.status === 'OPEN') {
      return `Open issue: ${truncateText(top.title, 48)}`;
    }
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

  if (counts.inventoryReview > 0) {
    return `${counts.inventoryReview} inventory item${counts.inventoryReview === 1 ? '' : 's'} need review (condition or replacement date)`;
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

  const services = serviceHistoryStorage.getAll(boatId);
  const projects = projectsStorage.getAll(boatId);
  const inventory = inventoryStorage.getAll(boatId);
  const logs = shipsLogStorage.getAll(boatId);

  /** @type {{ kind: string, label: string, dateStr: string, sort: number, href: string }[]} */
  const overdue = [];
  /** @type {{ kind: string, label: string, dateStr: string, sort: number, href: string }[]} */
  const dueSoon = [];

  const schedules = engineMaintenanceScheduleStorage.getAll(boatId);
  const engines = enginesStorage.getAll(boatId);
  const sailsSchedules = sailsRiggingMaintenanceScheduleStorage.getAll(boatId);
  const dueRows = buildDueMaintenanceRows({
    boatId,
    serviceEntries: services,
    engineSchedules: schedules,
    sailsSchedules,
    engines
  });
  for (const row of dueRows) {
    if (row.status === 'overdue') overdue.push(row);
    else if (row.status === 'due_soon') dueSoon.push(row);
  }

  const t0 = startOfTodayLocal();

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
    attentionRows: [],
    recentTop,
    hasMaintenanceScheduleAttention
  };
  model.attentionRows = buildAttentionRows(model, boatId);
  model.tagline = computeBoatDashboardTagline(boatId, model);
  return model;
}

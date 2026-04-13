/**
 * Boat Dashboard Page
 * Shows the 8 cards for a specific boat
 */

import { navigate } from '../router.js';
import { renderIcon } from '../components/icons.js';
import { createYachtHeader, createBackButton } from '../components/header.js';
import { showToast } from '../components/toast.js';
import {
  getBoat,
  getEngines,
  getServiceEntries,
  getHaulouts,
  getProjects,
  getInventory,
  getEquipment,
  getLogbook,
  getLinks,
  getFuelLogs,
  getBatteries,
  getBoatElectrical,
  getBoatDistressInfo,
  getCalendarEvents,
  getEngineMaintenanceSchedules,
  getSailsRiggingMaintenanceSchedules,
  touchBoatDashboardOpen
} from '../lib/dataService.js';
import {
  boatsStorage,
  enginesStorage,
  serviceHistoryStorage,
  hauloutStorage,
  projectsStorage,
  inventoryStorage,
  navEquipmentStorage,
  safetyEquipmentStorage,
  shipsLogStorage,
  linksStorage,
  boatDashboardSetupCompleteStorage,
  sailsRiggingMaintenanceScheduleStorage
} from '../lib/storage.js';
import { computeSailsRiggingScheduleStatus } from '../lib/sailsRiggingMaintenanceScheduleDue.js';
import {
  canAccessCard,
  shouldShowPremiumBadge,
  canAccessPremiumFeature,
  getBasicPlanRecordLimit,
  canAccessRoute
} from '../lib/access.js';
import { buildBoatActionDashboardModel } from '../lib/boatActionDashboardData.js';
import { hasActiveSubscription } from '../lib/subscription.js';
import {
  inventorySummaryCounts,
  inventoryItemNeedsReview,
  normalizeInventoryItem
} from '../lib/inventoryMarine.js';

/** Short benefit-led line for premium-locked dashboard cards (free users). */
const PREMIUM_CARD_TEASER = {
  fuel: 'Monitor fuel usage and performance',
  electrical: 'Track batteries and avoid failures',
  haulout: 'Plan and track haul-out work',
  projects: 'Plan projects and track issues',
  inventory: 'Spares, stores, sails, winches, and rigging',
  navigation: 'Navigation kit and warranty dates',
  safety: 'Safety gear, inspections and expiry dates',
  log: 'Log your trips and journeys',
  watermaker: 'Service history for your watermaker',
  'sails-rigging': 'Sails, rigging and deck hardware'
};
import { exportBoatReport } from '../lib/exportBoatReport.js';

const serviceIconUrl = new URL('../assets/service-wrench.png', import.meta.url).href;
const engineIconUrl = new URL('../assets/engine.png', import.meta.url).href;
const safetyIconUrl = new URL('../assets/safety-ring.png', import.meta.url).href;
const logIconUrl = new URL('../assets/log-book.png', import.meta.url).href;
const linksIconUrl = new URL('../assets/links-globe.png', import.meta.url).href;
const navigationIconUrl = new URL('../assets/navigation-compass.png', import.meta.url).href;
const boatIconUrl = new URL('../assets/boat-generic.png', import.meta.url).href;
const sailBoatDetailsIconUrl = new URL('../assets/Sail-generic.png', import.meta.url).href;
// Sails & Rigging card icon – use custom sailboat artwork.
// Ensure the image exists at: web/src/assets/sails-rigging.png
const sailsRiggingIconUrl = new URL('../assets/sails-rigging.png', import.meta.url).href;
// Watermaker card icon – place your supplied glass-of-water image at this path:
// web/src/assets/watermaker.png
const watermakerIconUrl = new URL('../assets/watermaker.png', import.meta.url).href;
// Haul-out maintenance uses a tools/hoist themed icon.
// Ensure the provided icon image is copied to `src/assets/haulout-hook.png`.
const hauloutIconUrl = new URL('../assets/haulout-hook.png', import.meta.url).href;
const maydayIconUrl = new URL('../assets/mayday.png', import.meta.url).href;
const fuelPerformanceIconUrl = new URL('../assets/fuel-performance.png', import.meta.url).href;
const electricalBatteryIconUrl = new URL('../assets/electrical-battery.png', import.meta.url).href;
const projectIconUrl = new URL('../assets/Project.png', import.meta.url).href;
const inventoryIconUrl = new URL('../assets/inventory.png', import.meta.url).href;
/** Same asset as home fleet calendar card (`boats.js`). */
const calendarCardIconUrl = new URL('../assets/calendar-card.png', import.meta.url).href;
let currentBoatId = null;
let currentBoat = null;

const SETUP_COMPLETE_NUDGE_MS = 24 * 60 * 60 * 1000;

/** Appends "· used/limit Basic" on free plan for modules with Basic limits. */
function withBasicPlanUsageLine(cardId, boatId, baseLine) {
  if (hasActiveSubscription()) return baseLine;
  const lim = getBasicPlanRecordLimit(cardId);
  if (lim == null) return baseLine;
  let used = 0;
  switch (cardId) {
    case 'projects':
      used = projectsStorage.getAll(boatId).filter((p) => !p.archived_at).length;
      break;
    case 'inventory':
      used = inventoryStorage.getAll(boatId).length;
      break;
    case 'navigation':
      used = navEquipmentStorage.getAll(boatId).length;
      break;
    case 'safety':
      used = safetyEquipmentStorage.getAll(boatId).length;
      break;
    case 'log':
      used = shipsLogStorage.getAll(boatId).length;
      break;
    default:
      return baseLine;
  }
  return `${baseLine} · ${used}/${lim} Basic`;
}

function getStatusText(cardId, boatId) {
  switch (cardId) {
    case 'boat':
      const boat = boatsStorage.get(boatId);
      return boat ? boat.boat_name || 'Configured' : 'Not configured';
    
    case 'engines':
      const engines = enginesStorage.getAll(boatId);
      return `${engines.length} engine${engines.length !== 1 ? 's' : ''}`;
    
    case 'service':
      const services = serviceHistoryStorage.getAll(boatId);
      return `${services.length} entr${services.length !== 1 ? 'ies' : 'y'}`;
    
    case 'haulout':
      const haulouts = hauloutStorage.getAll(boatId);
      return `${haulouts.length} haul-out${haulouts.length !== 1 ? 's' : ''}`;
    
    case 'navigation': {
      const nav = navEquipmentStorage.getAll(boatId);
      return withBasicPlanUsageLine(
        'navigation',
        boatId,
        `${nav.length} item${nav.length !== 1 ? 's' : ''}`
      );
    }

    case 'safety': {
      const safety = safetyEquipmentStorage.getAll(boatId);
      return withBasicPlanUsageLine(
        'safety',
        boatId,
        `${safety.length} item${safety.length !== 1 ? 's' : ''}`
      );
    }

    case 'log': {
      const logs = shipsLogStorage.getAll(boatId);
      return withBasicPlanUsageLine(
        'log',
        boatId,
        `${logs.length} passage${logs.length !== 1 ? 's' : ''}`
      );
    }
    
    case 'links':
      const links = linksStorage.getAll(boatId);
      return `${links.length} link${links.length !== 1 ? 's' : ''}`;

    case 'projects': {
      const projects = projectsStorage.getAll(boatId);
      const projectItems = projects.filter((p) => (p.type || 'Project') === 'Project');
      const issueItems = projects.filter((p) => (p.type || 'Project') === 'Issue');
      const openIssues = issueItems.filter((p) => !['Resolved', 'Closed'].includes(p.status || '')).length;
      let line;
      if (projects.length === 0) line = 'No projects or issues';
      else {
        const parts = [];
        if (projectItems.length > 0) parts.push(`Projects: ${projectItems.length}`);
        if (issueItems.length > 0) parts.push(`Issues: ${issueItems.length}`);
        if (openIssues > 0) parts.push(`Open: ${openIssues}`);
        line = parts.length ? parts.join(' · ') : `${projects.length} item${projects.length !== 1 ? 's' : ''}`;
      }
      return withBasicPlanUsageLine('projects', boatId, line);
    }
    
    case 'watermaker':
      return 'Track watermaker service';

    case 'sails-rigging': {
      const boat = boatsStorage.get(boatId);
      if (boat?.boat_type !== 'sailing') return 'Sails & rigging';
      const rows = sailsRiggingMaintenanceScheduleStorage.getAll(boatId).filter((s) => s.is_active !== false);
      if (rows.length === 0) return 'Details saved · no schedule yet';
      let overdueN = 0;
      let soonN = 0;
      for (const s of rows) {
        const st = computeSailsRiggingScheduleStatus(s);
        if (st === 'overdue') overdueN += 1;
        else if (st === 'due_soon') soonN += 1;
      }
      if (overdueN > 0) return `${overdueN} rigging schedule overdue`;
      if (soonN > 0) return `${soonN} rigging due within 30 days`;
      return `${rows.length} rigging schedule item${rows.length !== 1 ? 's' : ''}`;
    }

    case 'fuel':
      return '…';

    case 'electrical':
      return '…';

    case 'mayday':
      return '…';

    case 'inventory': {
      const items = inventoryStorage.getAll(boatId).map(normalizeInventoryItem);
      const sum = inventorySummaryCounts(items);
      const lowCount = items.filter((i) => (i.in_stock_level != null ? Number(i.in_stock_level) : 0) <= (i.required_quantity != null ? Number(i.required_quantity) : 0)).length;
      const criticalCount = items.filter((i) => !!i.critical_spare && (i.in_stock_level == null || Number(i.in_stock_level) === 0)).length;
      let line;
      if (items.length === 0) line = 'No items';
      else {
        const parts = [`${sum.total} item${sum.total !== 1 ? 's' : ''}`];
        if (sum.sails || sum.winches || sum.rigging) {
          const seg = [];
          if (sum.sails) seg.push(`${sum.sails} sail${sum.sails !== 1 ? 's' : ''}`);
          if (sum.winches) seg.push(`${sum.winches} winch${sum.winches === 1 ? '' : 'es'}`);
          if (sum.rigging) seg.push(`${sum.rigging} rigging`);
          parts.push(seg.join(', '));
        }
        if (sum.attention) parts.push(`${sum.attention} need attention`);
        if (criticalCount > 0) parts.push(`${criticalCount} critical`);
        else if (lowCount > 0) parts.push(`${lowCount} low stock`);
        line = parts.join(' · ');
      }
      return withBasicPlanUsageLine('inventory', boatId, line);
    }

    default:
      return '';
  }
}

function createCard(id, title, iconName, route, boatId) {
  const isLocked = shouldShowPremiumBadge(id);
  const card = document.createElement('a');
  card.href = `#${route}`;
  card.className = `dashboard-card card-color-${id}` + (isLocked ? ' dashboard-card-premium-locked' : '');
  card.onclick = (e) => {
    e.preventDefault();
    navigate(route);
  };

  const useBitmapImage = id === 'boat' || id === 'service' || id === 'haulout' || id === 'engines' || id === 'navigation' || id === 'safety' || id === 'log' || id === 'links' || id === 'watermaker' || id === 'sails-rigging' || id === 'mayday' || id === 'fuel' || id === 'electrical' || id === 'projects' || id === 'inventory';
  const badgeClass = useBitmapImage
    ? 'dashboard-card-icon-badge dashboard-card-icon-bitmap'
    : 'dashboard-card-icon-badge';

  let iconHtml;
  if (id === 'projects') {
    iconHtml = `<img src="${projectIconUrl}" alt="${title} icon" class="dashboard-card-icon-img">`;
  } else if (id === 'mayday') {
    iconHtml = `<img src="${maydayIconUrl}" alt="${title} icon" class="dashboard-card-icon-img">`;
  } else if (id === 'fuel') {
    iconHtml = `<img src="${fuelPerformanceIconUrl}" alt="${title} icon" class="dashboard-card-icon-img">`;
  } else if (id === 'electrical') {
    iconHtml = `<img src="${electricalBatteryIconUrl}" alt="${title} icon" class="dashboard-card-icon-img">`;
  } else if (id === 'sails-rigging') {
    iconHtml = `<img src="${sailsRiggingIconUrl}" alt="${title} icon" class="dashboard-card-icon-img">`;
  } else if (id === 'boat') {
    const b = boatsStorage.get(boatId);
    const detailsIconUrl = b?.boat_type === 'sailing' ? sailBoatDetailsIconUrl : boatIconUrl;
    iconHtml = `<img src="${detailsIconUrl}" alt="${title} icon" class="dashboard-card-icon-img">`;
  } else if (id === 'service') {
    iconHtml = `<img src="${serviceIconUrl}" alt="${title} icon" class="dashboard-card-icon-img">`;
  } else if (id === 'haulout') {
    iconHtml = `<img src="${hauloutIconUrl}" alt="${title} icon" class="dashboard-card-icon-img">`;
  } else if (id === 'engines') {
    iconHtml = `<img src="${engineIconUrl}" alt="${title} icon" class="dashboard-card-icon-img">`;
  } else if (id === 'navigation') {
    iconHtml = `<img src="${navigationIconUrl}" alt="${title} icon" class="dashboard-card-icon-img">`;
  } else if (id === 'safety') {
    iconHtml = `<img src="${safetyIconUrl}" alt="${title} icon" class="dashboard-card-icon-img">`;
  } else if (id === 'log') {
    iconHtml = `<img src="${logIconUrl}" alt="${title} icon" class="dashboard-card-icon-img">`;
  } else if (id === 'links') {
    iconHtml = `<img src="${linksIconUrl}" alt="${title} icon" class="dashboard-card-icon-img">`;
  } else if (id === 'watermaker') {
    iconHtml = `<img src="${watermakerIconUrl}" alt="${title} icon" class="dashboard-card-icon-img">`;
  } else if (id === 'inventory') {
    iconHtml = `<img src="${inventoryIconUrl}" alt="${title} icon" class="dashboard-card-icon-img">`;
  } else {
    iconHtml = renderIcon(iconName);
  }

  card.setAttribute('data-card-id', id);
  const statusLine =
    isLocked && PREMIUM_CARD_TEASER[id] ? PREMIUM_CARD_TEASER[id] : getStatusText(id, boatId);

  card.innerHTML = `
    <div class="${badgeClass}">${iconHtml}</div>
    ${isLocked ? '<span class="dashboard-card-premium-badge" title="Available with Premium — try it first" aria-label="Premium feature">Premium Feature</span>' : ''}
    <div class="dashboard-card-title">${title}</div>
    <div class="dashboard-card-status">${statusLine}</div>
  `;

  return card;
}

function escapeHtmlDash(s) {
  if (s == null || s === '') return '';
  const d = document.createElement('div');
  d.textContent = String(s);
  return d.innerHTML;
}

const ATTENTION_TILE_ICONS = {
  overdue: 'wrench',
  soon: 'calendar',
  issues: 'clipboard',
  stock: 'inventory'
};

/**
 * Fills the action dashboard host (needs attention, recent activity, quick actions).
 */
function mountBoatActionDashboard(boatId, model, isArchived) {
  const host = document.getElementById('boat-action-dashboard');
  if (!host) return;

  host.innerHTML = '';
  if (isArchived) {
    const wrap = document.createElement('div');
    wrap.className = 'card boat-action-dash-archive-hint';
    wrap.innerHTML =
      '<p class="text-muted" style="margin:0;">This boat is archived. Use the cards below to view records only.</p>';
    host.appendChild(wrap);
    return;
  }

  const { counts, overdue, dueSoon, recentTop, openIssues, hasMaintenanceScheduleAttention } = model;
  const serviceBase = `/boat/${boatId}/service`;
  const issuesTarget = `/boat/${boatId}/projects?type=Issue&status=active&archived=active`;

  const anyAttention = counts.overdue + counts.dueSoon + counts.openIssues + counts.lowStock > 0;

  function makeAttentionTile(label, count, path, kind) {
    const btn = document.createElement('button');
    btn.type = 'button';
    const n = Number(count) || 0;
    const zeroClass = anyAttention && n === 0 ? ' boat-action-dash-tile--zero' : '';
    btn.className = `boat-action-dash-tile boat-action-dash-tile--${kind}${zeroClass}`;
    const iconName = ATTENTION_TILE_ICONS[kind] || 'clipboard';
    btn.innerHTML = `
      <span class="boat-action-dash-tile-icon" aria-hidden="true">${renderIcon(iconName)}</span>
      <span class="boat-action-dash-tile-value">${n}</span>
      <span class="boat-action-dash-tile-label">${escapeHtmlDash(label)}</span>
      <span class="boat-action-dash-tile-hint">Open</span>
    `;
    btn.addEventListener('click', () => navigate(path));
    return btn;
  }

  const needs = document.createElement('section');
  needs.className = 'boat-action-dash-section boat-action-dash-needs';
  needs.setAttribute('aria-labelledby', 'boat-dash-needs-title');

  const h2 = document.createElement('h2');
  h2.className = 'boat-action-dash-section-title boat-action-dash-needs-title';
  h2.id = 'boat-dash-needs-title';
  h2.textContent = 'Needs attention';
  needs.appendChild(h2);

  if (!anyAttention) {
    const allClear = document.createElement('div');
    allClear.className = 'boat-action-dash-all-clear';
    allClear.innerHTML = `
      <div class="boat-action-dash-all-clear-icon" aria-hidden="true">${renderIcon('check')}</div>
      <p class="boat-action-dash-all-clear-title">Nothing needs attention right now</p>
      <p class="boat-action-dash-all-clear-sub text-muted">You are on top of due dates, open issues, and inventory levels for this boat.</p>
    `;
    needs.appendChild(allClear);
  } else {
    const grid = document.createElement('div');
    grid.className = 'boat-action-dash-needs-grid';
    grid.appendChild(makeAttentionTile('Overdue', counts.overdue, `${serviceBase}?due=overdue`, 'overdue'));
    grid.appendChild(makeAttentionTile('Due in 30 days', counts.dueSoon, `${serviceBase}?due=due_soon`, 'soon'));
    grid.appendChild(makeAttentionTile('Open issues', counts.openIssues, issuesTarget, 'issues'));
    grid.appendChild(makeAttentionTile('Low stock', counts.lowStock, `/boat/${boatId}/inventory?stock=low`, 'stock'));
    needs.appendChild(grid);

    if (hasMaintenanceScheduleAttention) {
      const hint = document.createElement('p');
      hint.className = 'text-muted boat-action-dash-schedule-hint';
      hint.style.cssText = 'margin: 0.5rem 0 0; font-size: 0.9rem;';
      hint.textContent =
        'Counts and the list below include engine and sail & rigging maintenance schedules where applicable. The service “Overdue / Due in 30 days” shortcuts still open your service history only.';
      needs.appendChild(hint);
    }

    if (openIssues && openIssues.length > 0) {
      const preview = document.createElement('div');
      preview.className = 'boat-action-dash-open-preview';
      const n = openIssues.length;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'boat-action-dash-open-preview-btn';
      btn.textContent = `${n} open issue${n === 1 ? '' : 's'} need review`;
      btn.addEventListener('click', () => navigate(issuesTarget));
      preview.appendChild(btn);
      needs.appendChild(preview);
    }

    if (overdue.length > 0 || dueSoon.length > 0) {
      const list = document.createElement('ul');
      list.className = 'boat-action-dash-due-list';
      const lines = [];
      overdue.slice(0, 4).forEach((row) => lines.push({ ...row, tag: 'Overdue' }));
      dueSoon.slice(0, 4).forEach((row) => lines.push({ ...row, tag: 'Due' }));
      lines.slice(0, 6).forEach((row) => {
        const li = document.createElement('li');
        const a = document.createElement('button');
        a.type = 'button';
        a.className = 'boat-action-dash-due-line';
        a.innerHTML = `<span class="boat-action-dash-due-tag">${escapeHtmlDash(row.tag)}</span><span class="boat-action-dash-due-meta">${escapeHtmlDash(row.dateStr)}</span><span class="boat-action-dash-due-label">${escapeHtmlDash(row.label)}</span>`;
        a.addEventListener('click', () => navigate(row.path));
        li.appendChild(a);
        list.appendChild(li);
      });
      needs.appendChild(list);
    }
  }

  host.appendChild(needs);

  const recentSec = document.createElement('section');
  recentSec.className = 'boat-action-dash-section boat-action-dash-recent';
  const hRecent = document.createElement('h2');
  hRecent.className = 'boat-action-dash-section-title';
  hRecent.textContent = 'Recent activity';
  recentSec.appendChild(hRecent);

  if (!recentTop.length) {
    const box = document.createElement('div');
    box.className = 'boat-action-dash-recent-empty card';
    const p = document.createElement('p');
    p.className = 'boat-action-dash-recent-empty-text text-muted';
    p.textContent = 'No activity yet — start by logging your first service or a fuel entry.';
    box.appendChild(p);
    const row = document.createElement('div');
    row.className = 'boat-action-dash-recent-empty-actions';
    const svc = document.createElement('button');
    svc.type = 'button';
    svc.className = 'btn-primary boat-action-dash-inline-btn';
    svc.textContent = 'Add service';
    svc.addEventListener('click', () => navigate(`/boat/${boatId}/service/new`));
    const fuel = document.createElement('button');
    fuel.type = 'button';
    fuel.className = 'btn-secondary boat-action-dash-inline-btn';
    fuel.textContent = 'Add fuel log';
    fuel.addEventListener('click', () => navigate(`/boat/${boatId}/fuel`));
    row.appendChild(svc);
    row.appendChild(fuel);
    box.appendChild(row);
    recentSec.appendChild(box);
  } else {
    const ul = document.createElement('ul');
    ul.className = 'boat-action-dash-recent-list';
    recentTop.forEach((row) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'boat-action-dash-recent-row';
      btn.innerHTML = `<span class="boat-action-dash-recent-type">${escapeHtmlDash(row.type)}</span><span class="boat-action-dash-recent-title">${escapeHtmlDash(row.title)}</span><span class="boat-action-dash-recent-date">${escapeHtmlDash(row.dateStr)}</span>`;
      btn.addEventListener('click', () => navigate(row.path));
      li.appendChild(btn);
      ul.appendChild(li);
    });
    recentSec.appendChild(ul);
  }
  host.appendChild(recentSec);

  const quick = document.createElement('section');
  quick.className = 'boat-action-dash-section boat-action-dash-quick';
  const hQuick = document.createElement('h2');
  hQuick.className = 'boat-action-dash-section-title';
  hQuick.textContent = 'Quick actions';
  quick.appendChild(hQuick);

  const qGrid = document.createElement('div');
  qGrid.className = 'boat-action-dash-quick-grid';

  /** Same icon shell and card colour token as main dashboard cards (`createCard`). */
  function quickTileWithCardIcon(label, path, imageUrl, cardColorId, title) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `boat-action-dash-quick-tile card-color-${cardColorId}`;
    if (title) b.title = title;

    const iconOuter = document.createElement('span');
    iconOuter.className = 'boat-action-dash-quick-tile-icon boat-action-dash-quick-tile-icon--bitmap';

    const badge = document.createElement('span');
    badge.className =
      'dashboard-card-icon-badge dashboard-card-icon-bitmap boat-action-dash-quick-tile-icon-badge';
    badge.setAttribute('aria-hidden', 'true');

    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = '';
    img.className = 'dashboard-card-icon-img';

    badge.appendChild(img);
    iconOuter.appendChild(badge);

    const labelSpan = document.createElement('span');
    labelSpan.className = 'boat-action-dash-quick-tile-label';
    labelSpan.textContent = label;

    b.appendChild(iconOuter);
    b.appendChild(labelSpan);
    b.addEventListener('click', () => navigate(path));
    return b;
  }

  qGrid.appendChild(
    quickTileWithCardIcon('Add service', `/boat/${boatId}/service/new`, serviceIconUrl, 'service', 'Add a service entry')
  );
  qGrid.appendChild(
    quickTileWithCardIcon(
      'Add issue / project',
      `/boat/${boatId}/projects/new`,
      projectIconUrl,
      'projects',
      'Add a project or issue'
    )
  );
  qGrid.appendChild(
    quickTileWithCardIcon(
      'Add passage log',
      `/boat/${boatId}/log/new`,
      logIconUrl,
      'log',
      'Add a passage log entry'
    )
  );
  const calPath = canAccessRoute('/calendar') ? '/calendar' : `/boat/${boatId}/reminder`;
  qGrid.appendChild(
    quickTileWithCardIcon(
      canAccessRoute('/calendar') ? 'Calendar' : 'Reminder',
      calPath,
      calendarCardIconUrl,
      'calendar',
      canAccessRoute('/calendar') ? 'Calendar & alerts' : 'Maintenance reminder'
    )
  );

  quick.appendChild(qGrid);
  host.appendChild(quick);
}

function render() {
  const container = document.createElement('div');
  container.className = 'container';

  // Get boat ID from URL
  const hash = window.location.hash;
  const match = hash.match(/\/boat\/([^\/]+)/);
  currentBoatId = match ? match[1] : null;

  if (!currentBoatId) {
    container.innerHTML = `
      <div class="container">
        <h1>Error</h1>
        <p>Boat not found</p>
        <button class="btn-primary" onclick="navigate('/')">Go Home</button>
      </div>
    `;
    window.navigate = navigate;
    return container;
  }

  const boat = boatsStorage.get(currentBoatId);
  if (!boat) {
    container.innerHTML = `
      <div class="container">
        <h1>Error</h1>
        <p>Boat not found</p>
        <button class="btn-primary" onclick="navigate('/')">Go Home</button>
      </div>
    `;
    window.navigate = navigate;
    return container;
  }

  currentBoat = { ...boat, status: boat.status || 'active' };
  const isArchived = currentBoat.status === 'archived';

  const wrapper = document.createElement('div');
  wrapper.className = 'boat-action-dashboard-page';

  const header = createYachtHeader(boat.boat_name || 'Boat Dashboard', {
    showSettings: true
  });
  wrapper.appendChild(header);

  const tagline = document.createElement('p');
  tagline.id = 'boat-dashboard-tagline';
  tagline.className = 'boat-dashboard-tagline text-muted';
  tagline.setAttribute('aria-live', 'polite');
  wrapper.appendChild(tagline);

  const pageContent = document.createElement('div');
  pageContent.className = 'page-content';
  pageContent.appendChild(createBackButton());

  const primaryStack = document.createElement('div');
  primaryStack.className = 'boat-dashboard-primary-stack';

  const actionDashHost = document.createElement('div');
  actionDashHost.id = 'boat-action-dashboard';
  actionDashHost.className = 'boat-action-dashboard';
  primaryStack.appendChild(actionDashHost);

  const onboardingHost = document.createElement('div');
  onboardingHost.id = 'boat-dashboard-onboarding';
  onboardingHost.className = 'boat-dashboard-setup-host';
  primaryStack.appendChild(onboardingHost);

  pageContent.appendChild(primaryStack);

  if (isArchived) {
    const banner = document.createElement('div');
    banner.className = 'archived-banner';
    banner.innerHTML = `
      <p><strong>Archived boat.</strong> Viewing and exporting only. No new logs, services, uploads, or edits. To edit again, reactivate this boat from Your boats.</p>
    `;
    pageContent.appendChild(banner);
  }

  const exportRow = document.createElement('div');
  exportRow.className = 'boat-export-row';
  exportRow.style.cssText = 'margin-bottom: 1rem;';
  exportRow.innerHTML = `
    <button type="button" class="btn-secondary" id="export-boat-report-btn" aria-label="Export boat report as PDF">
      ${renderIcon('download')} Export Boat Report
    </button>
    <p class="text-muted" style="font-size: 0.875rem; margin-top: 0.35rem;">Download a complete PDF report for this boat.</p>
  `;

  const modulesRegion = document.createElement('div');
  modulesRegion.className = 'boat-dashboard-modules-region';
  modulesRegion.appendChild(exportRow);

  const grid = document.createElement('div');
  grid.className = 'dashboard-grid';

  const cards = [
    { id: 'boat', title: 'Boat Details', icon: 'boat', route: `/boat/${currentBoatId}/details` },
    ...(currentBoat.boat_type === 'sailing'
      ? [{ id: 'sails-rigging', title: 'Sails & Rigging', icon: 'sail', route: `/boat/${currentBoatId}/sails-rigging` }]
      : []),
    { id: 'engines', title: 'Engines', icon: 'engine', route: `/boat/${currentBoatId}/engines` },
    { id: 'service', title: 'Service History', icon: 'wrench', route: `/boat/${currentBoatId}/service` },
    ...(currentBoat.watermaker_installed
      ? [{ id: 'watermaker', title: 'Watermaker Service', icon: 'droplet', route: `/boat/${currentBoatId}/watermaker` }]
      : []),
    { id: 'fuel', title: 'Fuel & Performance', icon: 'fuel', route: `/boat/${currentBoatId}/fuel` },
    { id: 'electrical', title: 'Electrical & Batteries', icon: 'battery', route: `/boat/${currentBoatId}/electrical` },
    { id: 'mayday', title: 'Mayday / Distress Call', icon: 'mayday', route: `/boat/${currentBoatId}/mayday` },
    { id: 'haulout', title: 'Haul-Out Maintenance', icon: 'wrench', route: `/boat/${currentBoatId}/haulout` },
    { id: 'projects', title: 'Projects & Issues', icon: 'clipboard', route: `/boat/${currentBoatId}/projects` },
    { id: 'inventory', title: 'Inventory', icon: 'inventory', route: `/boat/${currentBoatId}/inventory` },
    { id: 'navigation', title: 'Navigation Equipment', icon: 'chart', route: `/boat/${currentBoatId}/navigation` },
    { id: 'safety', title: 'Safety Equipment', icon: 'shield', route: `/boat/${currentBoatId}/safety` },
    { id: 'log', title: 'Passage Log', icon: 'book', route: `/boat/${currentBoatId}/log` },
    { id: 'links', title: 'Web Links', icon: 'link', route: `/boat/${currentBoatId}/links` }
  ];

  cards.forEach(card => {
    grid.appendChild(createCard(card.id, card.title, card.icon, card.route, currentBoatId));
  });

  container.appendChild(grid);
  modulesRegion.appendChild(container);
  pageContent.appendChild(modulesRegion);
  wrapper.appendChild(pageContent);

  return wrapper;
}

function renderBoatDashboardOnboarding(boatId) {
  const host = document.getElementById('boat-dashboard-onboarding');
  if (!host || !boatId) return;
  if (hasActiveSubscription()) {
    host.innerHTML = '';
    host.hidden = true;
    return;
  }
  host.hidden = false;
  const engines = enginesStorage.getAll(boatId);
  const services = serviceHistoryStorage.getAll(boatId);
  const hasEngine = engines.length > 0;
  const hasService = services.length > 0;
  const hasReminderFlow = services.some((s) => !!s.next_service_due);

  let setupCompleteAtMs = null;
  if (hasReminderFlow) {
    const recorded = boatDashboardSetupCompleteStorage.recordFirstComplete(boatId);
    setupCompleteAtMs = recorded ? Date.parse(recorded) : null;
  }
  const showDay2Nudge =
    hasReminderFlow &&
    setupCompleteAtMs != null &&
    !Number.isNaN(setupCompleteAtMs) &&
    Date.now() - setupCompleteAtMs >= SETUP_COMPLETE_NUDGE_MS;

  const stepClass = (done) => (done ? 'dashboard-onboarding-step is-done' : 'dashboard-onboarding-step');

  const stepsBlock = `
      <h3 class="dashboard-onboarding-title">Get your boat set up</h3>
      <ol class="dashboard-onboarding-list">
        <li class="${stepClass(hasEngine)}">
          <span class="dashboard-onboarding-label">Add your engine</span>
          ${hasEngine ? '<span class="text-muted">Done</span>' : `<a href="#/boat/${boatId}/engines" class="btn-link dashboard-onboarding-link">Add engine</a>`}
        </li>
        <li class="${stepClass(hasService)}">
          <span class="dashboard-onboarding-label">Log your first service</span>
          ${hasService ? '<span class="text-muted">Done</span>' : `<a href="#/boat/${boatId}/service/new" class="btn-link dashboard-onboarding-link">Add service entry</a>`}
        </li>
        <li class="${stepClass(hasReminderFlow)}">
          <span class="dashboard-onboarding-label">Set next due date &amp; reminder</span>
          ${hasReminderFlow ? '<span class="text-muted">Done</span>' : hasService ? `<a href="#/boat/${boatId}/service/${services[0].id}" class="btn-link dashboard-onboarding-link">Open service entry</a>` : '<span class="text-muted">After you add a service</span>'}
        </li>
      </ol>`;

  const completedSetupBlock = `
      <p class="dashboard-onboarding-success">You&apos;re now set up 👍</p>
      <p class="dashboard-onboarding-reinforcement">Your boat is being tracked and your first reminder is in place.</p>
      <p style="margin-top: 0.75rem;"><a href="#/boat/${boatId}/reminder" class="btn-link dashboard-onboarding-reminder-link">View your reminder</a></p>
      <div class="dashboard-onboarding-upgrade">
        <p class="dashboard-onboarding-upgrade-text">You&apos;re currently on the free plan.<br>Unlock full access to properly look after your boat and stay on top of everything.</p>
        <button type="button" class="btn-primary dashboard-onboarding-trial-btn">Unlock Full Access &amp; Start Free Trial</button>
      </div>`;

  const day2NudgeBlock = `
      <p class="dashboard-onboarding-success">You&apos;re back 👍</p>
      <p class="dashboard-onboarding-reinforcement">Your boat is now being tracked. Keep everything up to date so you do not miss anything important.</p>
      <div class="dashboard-onboarding-upgrade">
        <p class="dashboard-onboarding-upgrade-text">You&apos;re currently on the free plan.<br>Unlock full access to properly look after your boat and stay on top of everything.</p>
        <button type="button" class="btn-primary dashboard-onboarding-trial-btn">Unlock Full Access &amp; Start Free Trial</button>
      </div>`;

  let cardInner = '';
  if (showDay2Nudge) {
    cardInner = day2NudgeBlock;
  } else {
    cardInner = stepsBlock;
    if (hasReminderFlow) {
      cardInner += completedSetupBlock;
    }
  }

  host.innerHTML = `
    <section class="boat-dashboard-setup-section" aria-label="Setup checklist">
      <div class="dashboard-onboarding card boat-dashboard-setup-card">
        ${cardInner}
      </div>
    </section>
  `;

  host.querySelectorAll('.dashboard-onboarding-link, .dashboard-onboarding-reminder-link').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const href = a.getAttribute('href') || '';
      const path = href.replace(/^#/, '');
      navigate(path);
    });
  });

  const trialBtn = host.querySelector('.dashboard-onboarding-trial-btn');
  if (trialBtn) {
    trialBtn.addEventListener('click', () => navigate('/subscription'));
  }
}

async function onMount() {
  const hash = window.location.hash;
  const match = hash.match(/\/boat\/([^\/]+)/);
  const boatId = match ? match[1] : null;

  if (boatId) {
    void touchBoatDashboardOpen();
    try {
      sessionStorage.setItem('bm_onboarding_context_boat', boatId);
    } catch (_) {}
    const b = await getBoat(boatId);
    if (b) {
      boatsStorage.save(b);
      currentBoat = b;
    }
    // Fetch and sync all section data so card counts are correct
    const loadResults = await Promise.all([
      getEngines(boatId),
      getServiceEntries(boatId),
      getHaulouts(boatId),
      getProjects(boatId),
      getInventory(boatId),
      getEquipment(boatId, 'navigation'),
      getEquipment(boatId, 'safety'),
      getLogbook(boatId),
      getLinks(boatId),
      getFuelLogs(boatId),
      getBatteries(boatId),
      getBoatElectrical(boatId),
      getCalendarEvents(boatId),
      getEngineMaintenanceSchedules(boatId),
      boatsStorage.get(boatId)?.boat_type === 'sailing'
        ? getSailsRiggingMaintenanceSchedules(boatId)
        : Promise.resolve([])
    ]);
    const fuelLogs = loadResults[9] || [];
    const calendarEvents = loadResults[12] || [];

    const actionModel = buildBoatActionDashboardModel(boatId, { fuelLogs, calendarEvents });
    const isBoatArchivedNow = (boatsStorage.get(boatId)?.status || 'active') === 'archived';
    mountBoatActionDashboard(boatId, actionModel, isBoatArchivedNow);

    const taglineEl = document.getElementById('boat-dashboard-tagline');
    if (taglineEl) {
      taglineEl.textContent = isBoatArchivedNow ? 'Archived boat — viewing records only' : actionModel.tagline || '';
    }

    const statusElements = document.querySelectorAll('.dashboard-card-status');
    const cardIds = [
      'boat',
      ...(currentBoat?.boat_type === 'sailing' ? ['sails-rigging'] : []),
      'engines',
      'service',
      ...(currentBoat?.watermaker_installed ? ['watermaker'] : []),
      'fuel',
      'electrical',
      'mayday',
      'haulout',
      'projects',
      'inventory',
      'navigation',
      'safety',
      'log',
      'links'
    ];
    statusElements.forEach((el, index) => {
      if (cardIds[index]) {
        const cid = cardIds[index];
        if (!canAccessCard(cid) && PREMIUM_CARD_TEASER[cid]) {
          el.textContent = PREMIUM_CARD_TEASER[cid];
          return;
        }
        el.textContent = getStatusText(cid, boatId);
      }
    });

    const fuelCardStatus = document.querySelector('.dashboard-card[data-card-id="fuel"] .dashboard-card-status');
    const electricalCardStatus = document.querySelector('.dashboard-card[data-card-id="electrical"] .dashboard-card-status');
    if (fuelCardStatus && canAccessCard('fuel')) {
      const logs = await getFuelLogs(boatId);
      fuelCardStatus.textContent = logs.length > 0
        ? new Date(logs[0].log_date).toLocaleDateString()
        : 'No entries';
    }
    if (electricalCardStatus && canAccessCard('electrical')) {
      const batteries = await getBatteries(boatId);
      const hasElectrical = await getBoatElectrical(boatId);
      electricalCardStatus.textContent = batteries.length > 0
        ? `${batteries.length} batter${batteries.length !== 1 ? 'ies' : 'y'}`
        : 'Not set';
    }
    const maydayCardStatus = document.querySelector('.dashboard-card[data-card-id="mayday"] .dashboard-card-status');
    if (maydayCardStatus && canAccessCard('mayday')) {
      const distressInfo = await getBoatDistressInfo(boatId);
      maydayCardStatus.textContent = distressInfo ? 'Ready' : 'Not set';
    }

    renderBoatDashboardOnboarding(boatId);

    const inventoryCard = document.querySelector('.dashboard-card[data-card-id="inventory"]');
    if (inventoryCard) {
      const existingBadge = inventoryCard.querySelector('.dashboard-card-inventory-badge');
      if (existingBadge) existingBadge.remove();
      const items = inventoryStorage.getAll(boatId).map(normalizeInventoryItem);
      const lowCount = items.filter((i) => (i.in_stock_level != null ? Number(i.in_stock_level) : 0) <= (i.required_quantity != null ? Number(i.required_quantity) : 0)).length;
      const criticalCount = items.filter((i) => !!i.critical_spare && (i.in_stock_level == null || Number(i.in_stock_level) === 0)).length;
      const attentionCount = items.filter((i) => inventoryItemNeedsReview(i)).length;
      if (criticalCount > 0 || lowCount > 0 || attentionCount > 0) {
        const badge = document.createElement('div');
        let extra = '';
        let label = '';
        let n = 0;
        if (criticalCount > 0) {
          extra = ' dashboard-card-inventory-badge-critical';
          label = `${criticalCount} critical out of stock`;
          n = criticalCount;
        } else if (lowCount > 0) {
          label = `${lowCount} low stock`;
          n = lowCount;
        } else {
          extra = ' dashboard-card-inventory-badge-attention';
          label = `${attentionCount} inventory items need attention`;
          n = attentionCount;
        }
        badge.className = 'dashboard-card-inventory-badge' + extra;
        badge.setAttribute('aria-label', label);
        badge.textContent = n;
        inventoryCard.appendChild(badge);
      }
    }

    const exportBtn = document.getElementById('export-boat-report-btn');
    if (exportBtn) {
      exportBtn.onclick = async (e) => {
        e.preventDefault();
        if (!canAccessPremiumFeature()) {
          showToast('Export Boat Report is a Premium feature.', 'info');
          navigate('/subscription');
          return;
        }
        exportBtn.disabled = true;
        const labelHtml = exportBtn.innerHTML;
        exportBtn.innerHTML = 'Generating…';
        try {
          const result = await exportBoatReport(boatId);
          if (result.success) {
            showToast('Report ready. ' + (window.Capacitor?.isNativePlatform?.() ? 'Use the share sheet to save or share.' : 'Download started.'), 'success');
          } else {
            if (result.error === 'premium_required') {
              showToast('Export Boat Report is a Premium feature.', 'info');
              navigate('/subscription');
            } else {
              showToast(result.error || 'Export failed.', 'error');
            }
          }
        } catch (err) {
          showToast(err?.message || 'Export failed. Please try again.', 'error');
        } finally {
          exportBtn.disabled = false;
          exportBtn.innerHTML = labelHtml;
        }
      };
    }
  }
}

export default {
  render,
  onMount
};

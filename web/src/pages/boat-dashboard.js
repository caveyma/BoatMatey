/**
 * Boat Dashboard Page
 * Shows the 8 cards for a specific boat
 */

import { navigate } from '../router.js';
import { renderIcon } from '../components/icons.js';
import { createYachtHeader, createBackButton } from '../components/header.js';
import { showToast } from '../components/toast.js';
import { getBoat, getEngines, getServiceEntries, getHaulouts, getProjects, getInventory, getEquipment, getLogbook, getLinks, getFuelLogs, getBatteries, getBoatElectrical, getBoatDistressInfo } from '../lib/dataService.js';
import { boatsStorage, enginesStorage, serviceHistoryStorage, hauloutStorage, projectsStorage, inventoryStorage, navEquipmentStorage, safetyEquipmentStorage, shipsLogStorage, linksStorage } from '../lib/storage.js';
import { canAccessCard, shouldShowPremiumBadge, canAccessPremiumFeature } from '../lib/access.js';
import { exportBoatReport } from '../lib/exportBoatReport.js';

const serviceIconUrl = new URL('../assets/service-wrench.png', import.meta.url).href;
const engineIconUrl = new URL('../assets/engine.png', import.meta.url).href;
const safetyIconUrl = new URL('../assets/safety-ring.png', import.meta.url).href;
const logIconUrl = new URL('../assets/log-book.png', import.meta.url).href;
const linksIconUrl = new URL('../assets/links-globe.png', import.meta.url).href;
const navigationIconUrl = new URL('../assets/navigation-compass.png', import.meta.url).href;
const boatIconUrl = new URL('../assets/boat-generic.png', import.meta.url).href;
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
let currentBoatId = null;
let currentBoat = null;

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
    
    case 'navigation':
      const nav = navEquipmentStorage.getAll(boatId);
      return `${nav.length} item${nav.length !== 1 ? 's' : ''}`;
    
    case 'safety':
      const safety = safetyEquipmentStorage.getAll(boatId);
      return `${safety.length} item${safety.length !== 1 ? 's' : ''}`;
    
    case 'log':
      const logs = shipsLogStorage.getAll(boatId);
      return `${logs.length} passage${logs.length !== 1 ? 's' : ''}`;
    
    case 'links':
      const links = linksStorage.getAll(boatId);
      return `${links.length} link${links.length !== 1 ? 's' : ''}`;

    case 'projects':
      const projects = projectsStorage.getAll(boatId);
      const planned = projects.filter((p) => !['Completed', 'Cancelled'].includes(p.status || '')).length;
      const inProgress = projects.filter((p) => p.status === 'In Progress').length;
      const completed = projects.filter((p) => p.status === 'Completed').length;
      if (projects.length === 0) return 'No projects';
      const parts = [];
      if (planned > 0) parts.push(`Planned: ${planned}`);
      if (inProgress > 0) parts.push(`In progress: ${inProgress}`);
      if (completed > 0) parts.push(`Done: ${completed}`);
      return parts.length ? parts.join(' · ') : `${projects.length} project${projects.length !== 1 ? 's' : ''}`;
    
    case 'watermaker':
      return 'Track watermaker service';

    case 'sails-rigging':
      return 'Sails & rigging';

    case 'fuel':
      return '…';

    case 'electrical':
      return '…';

    case 'mayday':
      return '…';

    case 'inventory': {
      const items = inventoryStorage.getAll(boatId);
      const lowCount = items.filter((i) => (i.in_stock_level != null ? Number(i.in_stock_level) : 0) <= (i.required_quantity != null ? Number(i.required_quantity) : 0)).length;
      const criticalCount = items.filter((i) => !!i.critical_spare && (i.in_stock_level == null || Number(i.in_stock_level) === 0)).length;
      if (items.length === 0) return 'No items';
      const parts = [`${items.length} item${items.length !== 1 ? 's' : ''}`];
      if (lowCount > 0) parts.push(`${lowCount} low`);
      if (criticalCount > 0) parts.push(`${criticalCount} critical`);
      return parts.join(' · ');
    }

    default:
      return '';
  }
}

function createCard(id, title, iconName, route, boatId) {
  const isLocked = shouldShowPremiumBadge(id);
  const card = document.createElement('a');
  card.href = isLocked ? '#/subscription' : `#${route}`;
  card.className = `dashboard-card card-color-${id}` + (isLocked ? ' dashboard-card-premium-locked' : '');
  card.onclick = (e) => {
    e.preventDefault();
    if (canAccessCard(id)) navigate(route);
    else navigate('/subscription');
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
    // Always use the generic boat artwork so the card matches the home screen.
    iconHtml = `<img src="${boatIconUrl}" alt="${title} icon" class="dashboard-card-icon-img">`;
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
  card.innerHTML = `
    <div class="${badgeClass}">${iconHtml}</div>
    ${isLocked ? '<span class="dashboard-card-premium-badge" aria-label="Premium feature">Premium</span>' : ''}
    <div class="dashboard-card-title">${title}</div>
    <div class="dashboard-card-status">${getStatusText(id, boatId)}</div>
  `;

  return card;
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

  const header = createYachtHeader(boat.boat_name || 'Boat Dashboard', { showSettings: true });
  wrapper.appendChild(header);

  const pageContent = document.createElement('div');
  pageContent.className = 'page-content';
  pageContent.appendChild(createBackButton());

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
  pageContent.appendChild(exportRow);

  const grid = document.createElement('div');
  grid.className = 'dashboard-grid';

  const cards = [
    { id: 'boat', title: 'Boat Details', icon: 'boat', route: `/boat/${currentBoatId}/details` },
    { id: 'engines', title: 'Engines', icon: 'engine', route: `/boat/${currentBoatId}/engines` },
    { id: 'service', title: 'Service History', icon: 'wrench', route: `/boat/${currentBoatId}/service` },
    ...(currentBoat.watermaker_installed
      ? [{ id: 'watermaker', title: 'Watermaker Service', icon: 'droplet', route: `/boat/${currentBoatId}/watermaker` }]
      : []),
    { id: 'fuel', title: 'Fuel & Performance', icon: 'fuel', route: `/boat/${currentBoatId}/fuel` },
    { id: 'electrical', title: 'Electrical & Batteries', icon: 'battery', route: `/boat/${currentBoatId}/electrical` },
    { id: 'mayday', title: 'Mayday / Distress Call', icon: 'mayday', route: `/boat/${currentBoatId}/mayday` },
    { id: 'haulout', title: 'Haul-Out Maintenance', icon: 'wrench', route: `/boat/${currentBoatId}/haulout` },
    { id: 'projects', title: 'Projects', icon: 'clipboard', route: `/boat/${currentBoatId}/projects` },
    { id: 'inventory', title: 'Inventory', icon: 'inventory', route: `/boat/${currentBoatId}/inventory` },
    ...(currentBoat.boat_type === 'sailing'
      ? [{ id: 'sails-rigging', title: 'Sails & Rigging', icon: 'sail', route: `/boat/${currentBoatId}/sails-rigging` }]
      : []),
    { id: 'navigation', title: 'Navigation Equipment', icon: 'chart', route: `/boat/${currentBoatId}/navigation` },
    { id: 'safety', title: 'Safety Equipment', icon: 'shield', route: `/boat/${currentBoatId}/safety` },
    { id: 'log', title: 'Passage Log', icon: 'book', route: `/boat/${currentBoatId}/log` },
    { id: 'links', title: 'Web Links', icon: 'link', route: `/boat/${currentBoatId}/links` }
  ];

  cards.forEach(card => {
    grid.appendChild(createCard(card.id, card.title, card.icon, card.route, currentBoatId));
  });

  container.appendChild(grid);
  pageContent.appendChild(container);
  wrapper.appendChild(pageContent);

  return wrapper;
}

async function onMount() {
  const hash = window.location.hash;
  const match = hash.match(/\/boat\/([^\/]+)/);
  const boatId = match ? match[1] : null;

  if (boatId) {
    const b = await getBoat(boatId);
    if (b) {
      boatsStorage.save(b);
      currentBoat = b;
    }
    // Fetch and sync all section data so card counts are correct
    await Promise.all([
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
      getBoatElectrical(boatId)
    ]);

    const statusElements = document.querySelectorAll('.dashboard-card-status');
    const cardIds = [
      'boat',
      'engines',
      'service',
      ...(currentBoat?.watermaker_installed ? ['watermaker'] : []),
      'fuel',
      'electrical',
      'mayday',
      'haulout',
      'projects',
      'inventory',
      ...(currentBoat?.boat_type === 'sailing' ? ['sails-rigging'] : []),
      'navigation',
      'safety',
      'log',
      'links'
    ];
    statusElements.forEach((el, index) => {
      if (cardIds[index]) {
        el.textContent = getStatusText(cardIds[index], boatId);
      }
    });

    const fuelCardStatus = document.querySelector('.dashboard-card[data-card-id="fuel"] .dashboard-card-status');
    const electricalCardStatus = document.querySelector('.dashboard-card[data-card-id="electrical"] .dashboard-card-status');
    if (fuelCardStatus) {
      const logs = await getFuelLogs(boatId);
      fuelCardStatus.textContent = logs.length > 0
        ? new Date(logs[0].log_date).toLocaleDateString()
        : 'No entries';
    }
    if (electricalCardStatus) {
      const batteries = await getBatteries(boatId);
      const hasElectrical = await getBoatElectrical(boatId);
      electricalCardStatus.textContent = batteries.length > 0
        ? `${batteries.length} batter${batteries.length !== 1 ? 'ies' : 'y'}`
        : 'Not set';
    }
    const maydayCardStatus = document.querySelector('.dashboard-card[data-card-id="mayday"] .dashboard-card-status');
    if (maydayCardStatus) {
      const distressInfo = await getBoatDistressInfo(boatId);
      maydayCardStatus.textContent = distressInfo ? 'Ready' : 'Not set';
    }

    const inventoryCard = document.querySelector('.dashboard-card[data-card-id="inventory"]');
    if (inventoryCard) {
      const existingBadge = inventoryCard.querySelector('.dashboard-card-inventory-badge');
      if (existingBadge) existingBadge.remove();
      const items = inventoryStorage.getAll(boatId);
      const lowCount = items.filter((i) => (i.in_stock_level != null ? Number(i.in_stock_level) : 0) <= (i.required_quantity != null ? Number(i.required_quantity) : 0)).length;
      const criticalCount = items.filter((i) => !!i.critical_spare && (i.in_stock_level == null || Number(i.in_stock_level) === 0)).length;
      if (criticalCount > 0 || lowCount > 0) {
        const badge = document.createElement('div');
        badge.className = 'dashboard-card-inventory-badge' + (criticalCount > 0 ? ' dashboard-card-inventory-badge-critical' : '');
        badge.setAttribute('aria-label', criticalCount > 0 ? `${criticalCount} critical out of stock` : `${lowCount} low stock`);
        badge.textContent = criticalCount > 0 ? criticalCount : lowCount;
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

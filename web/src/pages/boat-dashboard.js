/**
 * Boat Dashboard Page
 * Shows the 8 cards for a specific boat
 */

import { navigate } from '../router.js';
import { renderIcon } from '../components/icons.js';
import { createYachtHeader, createBackButton } from '../components/header.js';
import { getBoat, getEngines, getServiceEntries, getHaulouts, getEquipment, getLogbook, getLinks } from '../lib/dataService.js';
import { boatsStorage, enginesStorage, serviceHistoryStorage, hauloutStorage, navEquipmentStorage, safetyEquipmentStorage, shipsLogStorage, linksStorage } from '../lib/storage.js';

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
      return `${logs.length} trip${logs.length !== 1 ? 's' : ''}`;
    
    case 'links':
      const links = linksStorage.getAll(boatId);
      return `${links.length} link${links.length !== 1 ? 's' : ''}`;
    
    case 'watermaker':
      return 'Track watermaker service';

    case 'sails-rigging':
      return 'Sails & rigging';

    default:
      return '';
  }
}

function createCard(id, title, iconName, route, boatId) {
  const card = document.createElement('a');
  card.href = `#${route}`;
  card.className = `dashboard-card card-color-${id}`;
  card.onclick = (e) => {
    e.preventDefault();
    navigate(route);
  };

  const useBitmapImage = id === 'boat' || id === 'service' || id === 'haulout' || id === 'engines' || id === 'navigation' || id === 'safety' || id === 'log' || id === 'links' || id === 'watermaker' || id === 'sails-rigging';
  const badgeClass = useBitmapImage
    ? 'dashboard-card-icon-badge dashboard-card-icon-bitmap'
    : 'dashboard-card-icon-badge';

  let iconHtml;
  if (id === 'sails-rigging') {
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
  } else {
    iconHtml = renderIcon(iconName);
  }

  card.innerHTML = `
    <div class="${badgeClass}">${iconHtml}</div>
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

  const header = createYachtHeader(boat.boat_name || 'Boat Dashboard');
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

  const grid = document.createElement('div');
  grid.className = 'dashboard-grid';

  const cards = [
    { id: 'boat', title: 'Boat Details', icon: 'boat', route: `/boat/${currentBoatId}/details` },
    { id: 'engines', title: 'Engines', icon: 'engine', route: `/boat/${currentBoatId}/engines` },
    { id: 'service', title: 'Service History', icon: 'wrench', route: `/boat/${currentBoatId}/service` },
    ...(currentBoat.watermaker_installed
      ? [{ id: 'watermaker', title: 'Watermaker Service', icon: 'droplet', route: `/boat/${currentBoatId}/watermaker` }]
      : []),
    { id: 'haulout', title: 'Haul-Out Maintenance', icon: 'wrench', route: `/boat/${currentBoatId}/haulout` },
    ...(currentBoat.boat_type === 'sailing'
      ? [{ id: 'sails-rigging', title: 'Sails & Rigging', icon: 'sail', route: `/boat/${currentBoatId}/sails-rigging` }]
      : []),
    { id: 'navigation', title: 'Navigation Equipment', icon: 'chart', route: `/boat/${currentBoatId}/navigation` },
    { id: 'safety', title: 'Safety Equipment', icon: 'shield', route: `/boat/${currentBoatId}/safety` },
    { id: 'log', title: "Ship's Log", icon: 'book', route: `/boat/${currentBoatId}/log` },
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
      getEquipment(boatId, 'navigation'),
      getEquipment(boatId, 'safety'),
      getLogbook(boatId),
      getLinks(boatId)
    ]);

    const statusElements = document.querySelectorAll('.dashboard-card-status');
    const cardIds = [
      'boat',
      'engines',
      'service',
      ...(currentBoat?.watermaker_installed ? ['watermaker'] : []),
      'haulout',
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
  }
}

export default {
  render,
  onMount
};

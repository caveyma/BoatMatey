/**
 * Boat Dashboard Page
 * Shows the 8 cards for a specific boat
 */

import { navigate } from '../router.js';
import { renderIcon } from '../components/icons.js';
import { createYachtHeader } from '../components/header.js';
import { boatsStorage, enginesStorage, serviceHistoryStorage, hauloutStorage, navEquipmentStorage, safetyEquipmentStorage, shipsLogStorage, linksStorage } from '../lib/storage.js';

const serviceIconUrl = new URL('../assets/service-wrench.png', import.meta.url).href;
const engineIconUrl = new URL('../assets/engine.png', import.meta.url).href;
const safetyIconUrl = new URL('../assets/safety-ring.png', import.meta.url).href;
const logIconUrl = new URL('../assets/log-book.png', import.meta.url).href;
const linksIconUrl = new URL('../assets/links-globe.png', import.meta.url).href;
const navigationIconUrl = new URL('../assets/navigation-compass.png', import.meta.url).href;
const adminIconUrl = new URL('../assets/account-admin.png', import.meta.url).href;
const boatIconUrl = new URL('../assets/boat-generic.png', import.meta.url).href;
// Haul-out maintenance uses a tools/hoist themed icon.
// Ensure the provided icon image is copied to `src/assets/haulout-hook.png`.
const hauloutIconUrl = new URL('../assets/haulout-hook.png', import.meta.url).href;
// Calendar / reminders card uses the calendar artwork provided by the user.
// Copy the image into `src/assets/calendar-card.png` if it is not already present.
const calendarIconUrl = new URL('../assets/calendar-card.png', import.meta.url).href;

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
    
    case 'calendar':
      // Calendar aggregates reminders from engines / service / haul-out,
      // so we just show a simple status label here.
      return 'Reminders & alerts';
    
    case 'account':
      return 'Settings';
    
    case 'guide':
      return 'How each card works';
    
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

  const useBitmapImage = id === 'boat' || id === 'service' || id === 'haulout' || id === 'engines' || id === 'navigation' || id === 'safety' || id === 'log' || id === 'links' || id === 'calendar' || id === 'account';
  const badgeClass = useBitmapImage
    ? 'dashboard-card-icon-badge dashboard-card-icon-bitmap'
    : 'dashboard-card-icon-badge';

  let iconHtml;
  if (id === 'boat') {
    const photoUrl = currentBoat?.photo_url || currentBoat?.photo_data || null;
    if (photoUrl) {
      iconHtml = `<img src="${photoUrl}" alt="${title} icon" class="dashboard-card-icon-img">`;
    } else {
      // Fall back to the same generic boat artwork used on the home screen
      iconHtml = `<img src="${boatIconUrl}" alt="${title} icon" class="dashboard-card-icon-img">`;
    }
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
  } else if (id === 'calendar') {
    iconHtml = `<img src="${calendarIconUrl}" alt="${title} icon" class="dashboard-card-icon-img">`;
  } else if (id === 'account') {
    iconHtml = `<img src="${adminIconUrl}" alt="${title} icon" class="dashboard-card-icon-img">`;
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

  // Cache the current boat so the Boat Details card can use its photo
  currentBoat = boat;

  const wrapper = document.createElement('div');
  
  // Yacht header
  const header = createYachtHeader(boat.boat_name || 'Boat Dashboard', true, () => navigate('/'));
  wrapper.appendChild(header);
  
  // Page content
  const pageContent = document.createElement('div');
  pageContent.className = 'page-content';

  const grid = document.createElement('div');
  grid.className = 'dashboard-grid';

  const cards = [
    { id: 'boat', title: 'Boat Details', icon: 'boat', route: `/boat/${currentBoatId}/details` },
    { id: 'engines', title: 'Engines', icon: 'engine', route: `/boat/${currentBoatId}/engines` },
    { id: 'service', title: 'Service History', icon: 'wrench', route: `/boat/${currentBoatId}/service` },
    { id: 'haulout', title: 'Haul-Out Maintenance', icon: 'wrench', route: `/boat/${currentBoatId}/haulout` },
    { id: 'navigation', title: 'Navigation Equipment', icon: 'chart', route: `/boat/${currentBoatId}/navigation` },
    { id: 'safety', title: 'Safety Equipment', icon: 'shield', route: `/boat/${currentBoatId}/safety` },
    { id: 'log', title: "Ship's Log", icon: 'book', route: `/boat/${currentBoatId}/log` },
    { id: 'calendar', title: 'Calendar & Alerts', icon: 'calendar', route: `/boat/${currentBoatId}/calendar` },
    { id: 'links', title: 'Web Links', icon: 'link', route: `/boat/${currentBoatId}/links` },
    { id: 'account', title: 'Admin', icon: 'user', route: '/account' },
    { id: 'guide', title: 'Guide', icon: 'file', route: `/boat/${currentBoatId}/guide` }
  ];

  cards.forEach(card => {
    grid.appendChild(createCard(card.id, card.title, card.icon, card.route, currentBoatId));
  });

  container.appendChild(grid);
  pageContent.appendChild(container);
  wrapper.appendChild(pageContent);

  return wrapper;
}

function onMount() {
  // Refresh status text when page loads
  const hash = window.location.hash;
  const match = hash.match(/\/boat\/([^\/]+)/);
  const boatId = match ? match[1] : null;
  
  if (boatId) {
    const statusElements = document.querySelectorAll('.dashboard-card-status');
    statusElements.forEach((el, index) => {
      const cards = [
        'boat',
        'engines',
        'service',
        'haulout',
        'navigation',
        'safety',
        'log',
        'calendar',
        'links',
        'account',
        'guide'
      ];
      if (cards[index]) {
        el.textContent = getStatusText(cards[index], boatId);
      }
    });
  }
}

export default {
  render,
  onMount
};

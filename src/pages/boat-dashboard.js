/**
 * Boat Dashboard Page
 * Shows the 8 cards for a specific boat
 */

import { navigate } from '../router.js';
import { renderIcon } from '../components/icons.js';
import { createYachtHeader } from '../components/header.js';
import { boatsStorage, enginesStorage, serviceHistoryStorage, navEquipmentStorage, safetyEquipmentStorage, shipsLogStorage, linksStorage } from '../lib/storage.js';

let currentBoatId = null;

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
    
    case 'account':
      return 'Settings';
    
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

  card.innerHTML = `
    <div class="dashboard-card-icon-badge">${renderIcon(iconName)}</div>
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
    { id: 'navigation', title: 'Navigation Equipment', icon: 'compass', route: `/boat/${currentBoatId}/navigation` },
    { id: 'safety', title: 'Safety Equipment', icon: 'shield', route: `/boat/${currentBoatId}/safety` },
    { id: 'log', title: "Ship's Log", icon: 'book', route: `/boat/${currentBoatId}/log` },
    { id: 'links', title: 'Links', icon: 'link', route: `/boat/${currentBoatId}/links` },
    { id: 'account', title: 'Account', icon: 'user', route: '/account' }
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
        'boat', 'engines', 'service', 'navigation', 
        'safety', 'log', 'links', 'account'
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

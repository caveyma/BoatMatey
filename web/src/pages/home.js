/**
 * Home Dashboard Page
 */

import { navigate } from '../router.js';
import { renderIcon } from '../components/icons.js';
import { boatStorage, enginesStorage, serviceHistoryStorage, navEquipmentStorage, safetyEquipmentStorage, shipsLogStorage, linksStorage } from '../lib/storage.js';

const serviceIconUrl = new URL('../assets/service-wrench.png', import.meta.url).href;
const boatIconUrl = new URL('../assets/boat-generic.png', import.meta.url).href;
const engineIconUrl = new URL('../assets/engine.png', import.meta.url).href;
const safetyIconUrl = new URL('../assets/safety-ring.png', import.meta.url).href;
const logIconUrl = new URL('../assets/log-book.png', import.meta.url).href;
const linksIconUrl = new URL('../assets/links-globe.png', import.meta.url).href;
const navigationIconUrl = new URL('../assets/navigation-compass.png', import.meta.url).href;
const adminIconUrl = new URL('../assets/account-admin.png', import.meta.url).href;

function getStatusText(cardId) {
  switch (cardId) {
    case 'boat':
      const boat = boatStorage.get();
      return boat ? boat.boat_name || 'Configured' : 'Not configured';
    
    case 'engines':
      const engines = enginesStorage.getAll();
      return `${engines.length} engine${engines.length !== 1 ? 's' : ''}`;
    
    case 'service':
      const services = serviceHistoryStorage.getAll();
      return `${services.length} entr${services.length !== 1 ? 'ies' : 'y'}`;
    
    case 'navigation':
      const nav = navEquipmentStorage.getAll();
      return `${nav.length} item${nav.length !== 1 ? 's' : ''}`;
    
    case 'safety':
      const safety = safetyEquipmentStorage.getAll();
      return `${safety.length} item${safety.length !== 1 ? 's' : ''}`;
    
    case 'log':
      const logs = shipsLogStorage.getAll();
      return `${logs.length} trip${logs.length !== 1 ? 's' : ''}`;
    
    case 'links':
      const links = linksStorage.getAll();
      return `${links.length} link${links.length !== 1 ? 's' : ''}`;
    
    case 'account':
      return 'Settings';
    
    default:
      return '';
  }
}

function createCard(id, title, iconName, route) {
  const card = document.createElement('a');
  card.href = `#${route}`;
  card.className = `dashboard-card card-color-${id}`;
  card.onclick = (e) => {
    e.preventDefault();
    navigate(route);
  };

  const useBitmapImage = id === 'boat' || id === 'service' || id === 'engines' || id === 'navigation' || id === 'safety' || id === 'log' || id === 'links' || id === 'account';
  const badgeClass = useBitmapImage
    ? 'dashboard-card-icon-badge dashboard-card-icon-bitmap'
    : 'dashboard-card-icon-badge';

  let iconHtml;
  if (id === 'boat') {
    iconHtml = `<img src="${boatIconUrl}" alt="${title} icon" class="dashboard-card-icon-img">`;
  } else if (id === 'service') {
    iconHtml = `<img src="${serviceIconUrl}" alt="${title} icon" class="dashboard-card-icon-img">`;
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
  } else if (id === 'account') {
    iconHtml = `<img src="${adminIconUrl}" alt="${title} icon" class="dashboard-card-icon-img">`;
  } else {
    iconHtml = renderIcon(iconName);
  }

  card.innerHTML = `
    <div class="${badgeClass}">${iconHtml}</div>
    <div class="dashboard-card-title">${title}</div>
    <div class="dashboard-card-status">${getStatusText(id)}</div>
  `;

  return card;
}

function render() {
  const container = document.createElement('div');
  container.className = 'container';

  const header = document.createElement('div');
  header.className = 'page-header';
  header.innerHTML = `
    <h1>BoatMatey</h1>
    <p class="text-muted">Your boat maintenance & logbook</p>
  `;

  const grid = document.createElement('div');
  grid.className = 'dashboard-grid';

  const cards = [
    { id: 'boat', title: 'Boat Details', icon: 'boat', route: '/boat' },
    { id: 'engines', title: 'Engines', icon: 'engine', route: '/engines' },
    { id: 'service', title: 'Service History', icon: 'wrench', route: '/service' },
    { id: 'navigation', title: 'Navigation Equipment', icon: 'compass', route: '/navigation' },
    { id: 'safety', title: 'Safety Equipment', icon: 'shield', route: '/safety' },
    { id: 'log', title: "Ship's Log", icon: 'book', route: '/log' },
    { id: 'links', title: 'Web Links', icon: 'link', route: '/links' },
    { id: 'account', title: 'Settings', icon: 'user', route: '/account' }
  ];

  cards.forEach(card => {
    grid.appendChild(createCard(card.id, card.title, card.icon, card.route));
  });

  container.appendChild(header);
  container.appendChild(grid);

  return container;
}

function onMount() {
  // Refresh status text when page loads
  const statusElements = document.querySelectorAll('.dashboard-card-status');
  statusElements.forEach((el, index) => {
    const cards = [
      'boat', 'engines', 'service', 'navigation', 
      'safety', 'log', 'links', 'account'
    ];
    if (cards[index]) {
      el.textContent = getStatusText(cards[index]);
    }
  });
}

export default {
  render,
  onMount
};

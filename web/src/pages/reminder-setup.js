import { navigate } from '../router.js';
import { createYachtHeader, createBackButton } from '../components/header.js';
import { getBoat, getEngines } from '../lib/dataService.js';
import { boatsStorage } from '../lib/storage.js';

function getBoatType(boat) {
  const raw = (boat?.type || boat?.boat_type || '').toLowerCase().trim();
  if (!raw) return 'motor';
  if (raw === 'sailing' || raw === 'sailboat' || raw === 'sail') return 'sail';
  if (raw === 'rib' || raw === 'rhib') return 'rib';
  if (raw === 'motor' || raw === 'motorboat' || raw === 'powerboat' || raw === 'power') return 'motor';
  return 'motor';
}

function getRelevantServiceTypes(boatType) {
  if (boatType === 'motor') {
    return ['engine_service', 'electrical', 'haulout', 'fuel'];
  }
  if (boatType === 'sail') {
    return [
      'engine_service',
      'electrical',
      'haulout',
      'fuel',
      'winch_service',
      'rigging_inspection',
      'sails'
    ];
  }
  if (boatType === 'rib') {
    return ['engine_service', 'electrical', 'fuel'];
  }
  return [];
}

const SERVICE_OPTION_META = {
  engine_service: { label: 'Engine service', routeKind: 'engine', preset: 'engine_service' },
  electrical: { label: 'Electrical checks', routeKind: 'engine', preset: 'electrical' },
  haulout: { label: 'Haul-out maintenance', routeKind: 'engine', preset: 'haulout' },
  fuel: { label: 'Fuel system checks', routeKind: 'engine', preset: 'fuel' },
  winch_service: { label: 'Winch service', routeKind: 'sail', preset: 'winch' },
  rigging_inspection: { label: 'Rigging inspection', routeKind: 'sail', preset: 'rigging' },
  sails: { label: 'Sails maintenance', routeKind: 'sail', preset: 'sails' }
};

function buttonHtml(label, type) {
  return `<button type="button" class="btn-secondary reminder-setup-option-btn" data-reminder-type="${type}">${label}</button>`;
}

function renderOptionsHtml(boatType) {
  const relevantTypes = getRelevantServiceTypes(boatType);
  if (!relevantTypes.length) {
    return buttonHtml('Engine service', 'engine_service');
  }
  return relevantTypes
    .map((type) => {
      const meta = SERVICE_OPTION_META[type];
      if (!meta) return '';
      return buttonHtml(meta.label, type);
    })
    .join('');
}

function render(params = {}) {
  const boatId = params?.id || window.routeParams?.id;
  const wrapper = document.createElement('div');
  if (!boatId) {
    wrapper.innerHTML = '<div class="page-content"><div class="container"><h1>Error</h1><p>Boat ID required</p></div></div>';
    return wrapper;
  }

  const header = createYachtHeader('Set your first reminder');
  wrapper.appendChild(header);

  const pageContent = document.createElement('div');
  pageContent.className = 'page-content card-color-calendar';
  pageContent.appendChild(createBackButton(`/boat/${boatId}`));

  const container = document.createElement('div');
  container.className = 'container';
  container.innerHTML = `
    <div class="card">
      <h3 style="margin-top:0;">What do you want to track?</h3>
      <p class="text-muted" style="margin-top:0.35rem;">Choose one type to create a maintenance reminder. You can add more later.</p>
      <div id="reminder-setup-options" class="form-actions" style="flex-direction:column;align-items:stretch;gap:0.55rem;">
        ${renderOptionsHtml('motor')}
      </div>
      <p class="text-muted" style="margin-top:0.8rem;font-size:0.9rem;">This creates a schedule reminder only. Service history stays separate.</p>
    </div>
  `;
  pageContent.appendChild(container);
  wrapper.appendChild(pageContent);
  return wrapper;
}

async function onMount(params = {}) {
  const boatId = params?.id || window.routeParams?.id;
  if (!boatId) return;
  try {
    const boat = await getBoat(boatId);
    if (boat) boatsStorage.save(boat);
  } catch (_) {}
  const boat = boatsStorage.get(boatId) || null;
  const boatType = getBoatType(boat);
  const isSailing = boatType === 'sail';
  const engines = await getEngines(boatId);
  const optionsHost = document.getElementById('reminder-setup-options');
  if (optionsHost) {
    optionsHost.innerHTML = renderOptionsHtml(boatType);
  }

  document.querySelectorAll('.reminder-setup-option-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const type = btn.getAttribute('data-reminder-type');
      if (!type) return;
      if (!engines.length) {
        navigate(`/boat/${boatId}/engines/new?from=onboarding_reminder`);
        return;
      }
      const firstEngineId = engines[0]?.id;
      const goEngine = (preset) => navigate(`/boat/${boatId}/engines/${firstEngineId}?onboarding_schedule=${encodeURIComponent(preset)}`);
      const meta = SERVICE_OPTION_META[type];
      if (!meta) return goEngine('custom');
      if (meta.routeKind === 'sail' && isSailing) {
        navigate(`/boat/${boatId}/sails-rigging?onboarding_schedule=${encodeURIComponent(meta.preset)}`);
        return;
      }
      goEngine(meta.preset || 'custom');
    });
  });
}

export default { render, onMount };

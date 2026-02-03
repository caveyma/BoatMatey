/**
 * Engine Edit Page - full-page form for add/edit engine.
 * Cancel or Save returns to the Engines list for the boat.
 */

import { navigate } from '../router.js';
import { renderIcon } from '../components/icons.js';
import { createYachtHeader, createBackButton } from '../components/header.js';
import { isBoatArchived, getEngines, createEngine, updateEngine } from '../lib/dataService.js';

function render(params = {}) {
  const boatId = params?.id || window.routeParams?.id;
  const engineId = params?.engineId || window.routeParams?.engineId;
  const isNew = !engineId || engineId === 'new';

  if (!boatId) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = '<div class="page-content"><div class="container"><h1>Error</h1><p>Boat ID required</p></div></div>';
    return wrapper;
  }

  const wrapper = document.createElement('div');
  const header = createYachtHeader(isNew ? 'Add Engine' : 'Edit Engine');
  wrapper.appendChild(header);

  const pageContent = document.createElement('div');
  pageContent.className = 'page-content card-color-engines';
  pageContent.appendChild(createBackButton());
  const container = document.createElement('div');
  container.className = 'container';

  container.innerHTML = `
    <div class="card" id="engine-form-card">
      <h3>${isNew ? 'Add Engine' : 'Edit Engine'}</h3>
      <p class="text-muted">${isNew ? 'Add a new engine for this boat.' : 'Update engine details below.'}</p>
      <form id="engine-form">
        <div class="form-group">
          <label for="engine_label">Label * (e.g., Port, Starboard, Generator)</label>
          <input type="text" id="engine_label" required placeholder="e.g. Port engine">
        </div>
        <div class="form-group">
          <label for="engine_manufacturer">Manufacturer</label>
          <input type="text" id="engine_manufacturer" placeholder="Manufacturer">
        </div>
        <div class="form-group">
          <label for="engine_model">Model</label>
          <input type="text" id="engine_model" placeholder="Model">
        </div>
        <div class="form-group">
          <label for="engine_serial">Serial Number</label>
          <input type="text" id="engine_serial" placeholder="Serial number">
        </div>
        <div class="form-group">
          <label for="engine_hp">Horsepower</label>
          <input type="number" id="engine_hp" placeholder="Horsepower">
        </div>
        <div class="form-group">
          <label for="engine_fuel_type">Fuel Type</label>
          <select id="engine_fuel_type">
            <option value="">Select...</option>
            <option value="diesel">Diesel</option>
            <option value="petrol">Petrol</option>
            <option value="electric">Electric</option>
          </select>
        </div>
        <div class="form-group">
          <label for="engine_drive_type">Drive Type</label>
          <select id="engine_drive_type">
            <option value="">Select...</option>
            <option value="shaft">Shaft Drive</option>
            <option value="saildrive">Saildrive</option>
            <option value="sterndrive">Sterndrive</option>
            <option value="ips_pod">IPS Pod / Pod Drive</option>
            <option value="jet">Jet Drive</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div class="form-group">
          <label for="engine_install_date">Install Date</label>
          <input type="date" id="engine_install_date">
        </div>
        <div class="form-group">
          <label for="engine_warranty_expiry">Warranty Expiry Date</label>
          <input type="date" id="engine_warranty_expiry">
        </div>
        <div class="form-group">
          <label for="engine_warranty_reminder">Warranty reminder</label>
          <select id="engine_warranty_reminder">
            <option value="0">None</option>
            <option value="1440">1 day before</option>
            <option value="2880">2 days before</option>
            <option value="10080" selected>1 week before</option>
          </select>
        </div>
        <hr />
        <h4>Gearbox</h4>
        <p class="text-muted">Capture gearbox details linked to this engine.</p>
        <div class="form-group">
          <label for="gearbox_manufacturer">Gearbox Manufacturer</label>
          <input type="text" id="gearbox_manufacturer" placeholder="Manufacturer">
        </div>
        <div class="form-group">
          <label for="gearbox_model">Gearbox Model</label>
          <input type="text" id="gearbox_model" placeholder="Model">
        </div>
        <div class="form-group">
          <label for="gearbox_serial_number">Gearbox Serial Number</label>
          <input type="text" id="gearbox_serial_number" placeholder="Serial number">
        </div>
        <div class="form-group">
          <label for="gearbox_ratio">Gearbox Ratio</label>
          <input type="text" id="gearbox_ratio" placeholder="Ratio">
        </div>
        <div class="form-group">
          <label for="gearbox_type">Gearbox Type</label>
          <input type="text" id="gearbox_type" placeholder="Type">
        </div>
        <div class="form-group">
          <label for="gearbox_notes">Gearbox Notes</label>
          <textarea id="gearbox_notes" rows="3" placeholder="Notes"></textarea>
        </div>
        <div class="form-actions">
          <button type="button" class="btn-secondary" id="engine-cancel-btn">Cancel</button>
          <button type="submit" class="btn-primary">Save</button>
        </div>
      </form>
    </div>
  `;

  pageContent.appendChild(container);
  wrapper.appendChild(pageContent);
  return wrapper;
}

async function onMount(params = {}) {
  const boatId = params?.id || window.routeParams?.id;
  const engineId = params?.engineId || window.routeParams?.engineId;
  const isNew = !engineId || engineId === 'new';

  if (!boatId) return;

  const archived = await isBoatArchived(boatId);
  if (archived) {
    const form = document.getElementById('engine-form');
    if (form) form.querySelectorAll('input, select, textarea, button').forEach(el => { el.disabled = true; });
  }

  if (!isNew) {
    const engines = await getEngines(boatId);
    const engine = engines.find((e) => e.id === engineId);
    if (engine) {
      const set = (id, value) => { const el = document.getElementById(id); if (el) el.value = value || ''; };
      set('engine_label', engine.label);
      set('engine_manufacturer', engine.manufacturer);
      set('engine_model', engine.model);
      set('engine_serial', engine.serial_number);
      set('engine_hp', engine.horsepower);
      set('engine_fuel_type', engine.fuel_type);
      set('engine_drive_type', engine.drive_type);
      set('engine_install_date', engine.install_date);
      set('engine_warranty_expiry', engine.warranty_expiry_date);
      const remEl = document.getElementById('engine_warranty_reminder');
      if (remEl) remEl.value = String(engine.warranty_reminder_minutes ?? 10080);
      set('gearbox_manufacturer', engine.gearbox_manufacturer);
      set('gearbox_model', engine.gearbox_model);
      set('gearbox_serial_number', engine.gearbox_serial_number);
      set('gearbox_ratio', engine.gearbox_ratio);
      set('gearbox_type', engine.gearbox_type);
      set('gearbox_notes', engine.gearbox_notes);
    }
  }

  document.getElementById('engine-cancel-btn')?.addEventListener('click', () => {
    navigate(`/boat/${boatId}/engines`);
  });

  document.getElementById('engine-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (archived) return;

    const get = (id) => (document.getElementById(id)?.value || '').trim();
    const engine = {
      id: engineId,
      label: get('engine_label'),
      manufacturer: get('engine_manufacturer'),
      model: get('engine_model'),
      serial_number: get('engine_serial'),
      horsepower: get('engine_hp') ? parseInt(get('engine_hp'), 10) : null,
      fuel_type: get('engine_fuel_type'),
      drive_type: get('engine_drive_type'),
      install_date: get('engine_install_date') || null,
      warranty_expiry_date: get('engine_warranty_expiry') || null,
      warranty_reminder_minutes: parseInt(document.getElementById('engine_warranty_reminder')?.value || '10080', 10) || null,
      gearbox_manufacturer: get('gearbox_manufacturer'),
      gearbox_model: get('gearbox_model'),
      gearbox_serial_number: get('gearbox_serial_number'),
      gearbox_ratio: get('gearbox_ratio'),
      gearbox_type: get('gearbox_type'),
      gearbox_notes: get('gearbox_notes')
    };

    const payload = {
      position: engine.label,
      manufacturer: engine.manufacturer,
      model: engine.model,
      serial_number: engine.serial_number,
      horsepower: engine.horsepower,
      notes: JSON.stringify({
        label: engine.label,
        fuel_type: engine.fuel_type,
        drive_type: engine.drive_type,
        install_date: engine.install_date,
        warranty_expiry_date: engine.warranty_expiry_date,
        warranty_reminder_minutes: engine.warranty_reminder_minutes ?? 10080,
        gearbox_manufacturer: engine.gearbox_manufacturer,
        gearbox_model: engine.gearbox_model,
        gearbox_serial_number: engine.gearbox_serial_number,
        gearbox_ratio: engine.gearbox_ratio,
        gearbox_type: engine.gearbox_type,
        gearbox_notes: engine.gearbox_notes
      })
    };

    if (!isNew) {
      await updateEngine(engineId, payload);
    } else {
      await createEngine(boatId, payload);
    }
    navigate(`/boat/${boatId}/engines`);
  });
}

export default {
  render,
  onMount
};

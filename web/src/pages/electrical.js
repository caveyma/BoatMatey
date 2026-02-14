/**
 * Electrical & Batteries Page
 * Fresh fetch from Supabase on every mount/navigation.
 */

import { navigate } from '../router.js';
import { renderIcon } from '../components/icons.js';
import { createYachtHeader, createBackButton } from '../components/header.js';
import { showToast } from '../components/toast.js';
import { confirmAction } from '../components/confirmModal.js';
import { setSaveButtonLoading } from '../utils/saveButton.js';
import {
  isBoatArchived,
  getBoatElectrical,
  getBatteries,
  upsertBoatElectrical,
  createBattery,
  updateBattery,
  deleteBattery
} from '../lib/dataService.js';

let currentBoatId = null;
let electricalArchived = false;
let editingBatteryId = null;

function render(params = {}) {
  currentBoatId = params?.id || window.routeParams?.id;
  if (!currentBoatId) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = '<div class="page-content"><div class="container"><h1>Error</h1><p>Boat ID required</p></div></div>';
    return wrapper;
  }

  const wrapper = document.createElement('div');
  const header = createYachtHeader('Electrical & Batteries');
  wrapper.appendChild(header);

  const pageContent = document.createElement('div');
  pageContent.className = 'page-content card-color-electrical';
  pageContent.appendChild(createBackButton());

  const container = document.createElement('div');
  container.className = 'container';

  container.innerHTML = `
    <div class="card" id="electrical-system-card">
      <h3>Electrical System</h3>
      <p class="text-muted">Voltage, shore power, inverter, solar, generator.</p>
      <form id="electrical-system-form">
        <div class="form-group">
          <label for="elec_system_voltage">System voltage (V)</label>
          <select id="elec_system_voltage">
            <option value="">—</option>
            <option value="12">12 V</option>
            <option value="24">24 V</option>
            <option value="48">48 V</option>
          </select>
        </div>
        <div class="form-group">
          <label class="checkbox-row">
            <input type="checkbox" id="elec_shore_power">
            <span>Shore power</span>
          </label>
        </div>
        <div class="form-group">
          <label class="checkbox-row">
            <input type="checkbox" id="elec_inverter">
            <span>Inverter</span>
          </label>
        </div>
        <div class="form-group">
          <label for="elec_inverter_brand">Inverter brand</label>
          <input type="text" id="elec_inverter_brand" placeholder="e.g. Victron">
        </div>
        <div class="form-group">
          <label for="elec_charger_brand">Charger brand</label>
          <input type="text" id="elec_charger_brand" placeholder="e.g. Mastervolt">
        </div>
        <div class="form-group">
          <label class="checkbox-row">
            <input type="checkbox" id="elec_solar">
            <span>Solar</span>
          </label>
        </div>
        <div class="form-group">
          <label for="elec_solar_watts">Solar (W)</label>
          <input type="number" id="elec_solar_watts" min="0" step="1" placeholder="e.g. 200">
        </div>
        <div class="form-group">
          <label class="checkbox-row">
            <input type="checkbox" id="elec_generator">
            <span>Generator</span>
          </label>
        </div>
        <div class="form-group">
          <label for="elec_generator_brand">Generator brand</label>
          <input type="text" id="elec_generator_brand" placeholder="e.g. Onan">
        </div>
        <div class="form-group">
          <label for="elec_notes">Notes</label>
          <textarea id="elec_notes" rows="2"></textarea>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn-primary" id="electrical-save-btn">Save</button>
        </div>
      </form>
    </div>

    <div class="card" id="batteries-card">
      <h3>Batteries</h3>
      <div id="battery-form-wrap" style="display: none;">
        <form id="battery-form">
          <div class="form-group">
            <label for="battery_name">Name *</label>
            <input type="text" id="battery_name" required placeholder="e.g. House Bank, Port Start">
          </div>
          <div class="form-group">
            <label for="battery_type">Type</label>
            <select id="battery_type">
              <option value="">—</option>
              <option value="AGM">AGM</option>
              <option value="Gel">Gel</option>
              <option value="Lithium">Lithium</option>
              <option value="Lead-acid">Lead-acid</option>
            </select>
          </div>
          <div class="form-group">
            <label for="battery_capacity_ah">Capacity (Ah)</label>
            <input type="number" id="battery_capacity_ah" min="0" step="1">
          </div>
          <div class="form-group">
            <label for="battery_quantity">Quantity</label>
            <input type="number" id="battery_quantity" min="1" value="1">
          </div>
          <div class="form-group">
            <label for="battery_installed_date">Installed date</label>
            <input type="date" id="battery_installed_date">
          </div>
          <div class="form-group">
            <label for="battery_last_test_date">Last test date</label>
            <input type="date" id="battery_last_test_date">
          </div>
          <div class="form-group">
            <label for="battery_last_test_notes">Last test notes</label>
            <textarea id="battery_last_test_notes" rows="2"></textarea>
          </div>
          <div class="form-group">
            <label for="battery_replaced_date">Replaced date</label>
            <input type="date" id="battery_replaced_date">
          </div>
          <div class="form-group">
            <label for="battery_notes">Notes</label>
            <textarea id="battery_notes" rows="2"></textarea>
          </div>
          <div class="form-actions">
            <button type="button" class="btn-secondary" id="battery-cancel-btn">Cancel</button>
            <button type="submit" class="btn-primary">Save battery</button>
          </div>
        </form>
      </div>
      <div id="battery-add-wrap">
        <button type="button" class="btn-primary" id="battery-add-btn">${renderIcon('plus')} Add battery</button>
      </div>
      <div id="battery-list"></div>
    </div>
  `;

  pageContent.appendChild(container);
  wrapper.appendChild(pageContent);
  return wrapper;
}

async function onMount(params = {}) {
  const boatId = params?.id || window.routeParams?.id;
  if (boatId) currentBoatId = boatId;

  electricalArchived = currentBoatId ? await isBoatArchived(currentBoatId) : false;
  const addBtn = document.getElementById('battery-add-btn');
  const electricalSaveBtn = document.getElementById('electrical-save-btn');
  if (electricalArchived && addBtn) addBtn.style.display = 'none';
  if (electricalArchived && electricalSaveBtn) electricalSaveBtn.style.display = 'none';

  await loadElectrical();
  await loadBatteries();

  const systemForm = document.getElementById('electrical-system-form');
  if (systemForm) {
    systemForm.addEventListener('submit', (e) => {
      e.preventDefault();
      saveElectrical();
    });
  }

  const batteryForm = document.getElementById('battery-form');
  const batteryFormWrap = document.getElementById('battery-form-wrap');
  const batteryAddBtn = document.getElementById('battery-add-btn');
  const batteryCancelBtn = document.getElementById('battery-cancel-btn');

  if (batteryAddBtn) {
    batteryAddBtn.addEventListener('click', () => {
      editingBatteryId = null;
      if (batteryForm) {
        batteryForm.reset();
        document.getElementById('battery_quantity').value = '1';
      }
      if (batteryFormWrap) batteryFormWrap.style.display = 'block';
      if (batteryAddBtn) batteryAddBtn.style.display = 'none';
    });
  }
  if (batteryCancelBtn) {
    batteryCancelBtn.addEventListener('click', () => {
      editingBatteryId = null;
      if (batteryFormWrap) batteryFormWrap.style.display = 'none';
      if (batteryAddBtn) batteryAddBtn.style.display = electricalArchived ? 'none' : 'block';
    });
  }
  if (batteryForm) {
    batteryForm.addEventListener('submit', (e) => {
      e.preventDefault();
      saveBatteryEntry();
    });
  }

  window.navigate = navigate;
}

async function loadElectrical() {
  if (!currentBoatId) return;
  const elec = await getBoatElectrical(currentBoatId);
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val ?? '';
  };
  const setCheck = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.checked = !!val;
  };
  setVal('elec_system_voltage', elec?.system_voltage);
  setCheck('elec_shore_power', elec?.shore_power);
  setCheck('elec_inverter', elec?.inverter);
  setVal('elec_inverter_brand', elec?.inverter_brand);
  setVal('elec_charger_brand', elec?.charger_brand);
  setCheck('elec_solar', elec?.solar);
  setVal('elec_solar_watts', elec?.solar_watts);
  setCheck('elec_generator', elec?.generator);
  setVal('elec_generator_brand', elec?.generator_brand);
  setVal('elec_notes', elec?.notes);
}

async function saveElectrical() {
  if (!currentBoatId) return;
  const form = document.getElementById('electrical-system-form');
  setSaveButtonLoading(form, true);
  try {
  const payload = {
    system_voltage: document.getElementById('elec_system_voltage')?.value ? parseInt(document.getElementById('elec_system_voltage').value, 10) : null,
    shore_power: document.getElementById('elec_shore_power')?.checked ?? null,
    inverter: document.getElementById('elec_inverter')?.checked ?? null,
    inverter_brand: document.getElementById('elec_inverter_brand')?.value || null,
    charger_brand: document.getElementById('elec_charger_brand')?.value || null,
    solar: document.getElementById('elec_solar')?.checked ?? null,
    solar_watts: document.getElementById('elec_solar_watts')?.value ? parseInt(document.getElementById('elec_solar_watts').value, 10) : null,
    generator: document.getElementById('elec_generator')?.checked ?? null,
    generator_brand: document.getElementById('elec_generator_brand')?.value || null,
    notes: document.getElementById('elec_notes')?.value || null
  };
  await upsertBoatElectrical(currentBoatId, payload);
  await loadElectrical();
  showToast('Electrical system saved.', 'success');
  } finally {
    setSaveButtonLoading(form, false);
  }
}

function openEditBattery(battery) {
  editingBatteryId = battery.id;
  document.getElementById('battery_name').value = battery.battery_name || '';
  document.getElementById('battery_type').value = battery.battery_type || '';
  document.getElementById('battery_capacity_ah').value = battery.capacity_ah ?? '';
  document.getElementById('battery_quantity').value = battery.quantity ?? 1;
  document.getElementById('battery_installed_date').value = battery.installed_date || '';
  document.getElementById('battery_last_test_date').value = battery.last_test_date || '';
  document.getElementById('battery_last_test_notes').value = battery.last_test_notes || '';
  document.getElementById('battery_replaced_date').value = battery.replaced_date || '';
  document.getElementById('battery_notes').value = battery.notes || '';
  document.getElementById('battery-form-wrap').style.display = 'block';
  document.getElementById('battery-add-btn').style.display = 'none';
}

async function saveBatteryEntry() {
  const form = document.getElementById('battery-form');
  setSaveButtonLoading(form, true);
  const nameEl = document.getElementById('battery_name');
  if (!nameEl?.value?.trim()) {
    showToast('Battery name is required.', 'error');
    setSaveButtonLoading(form, false);
    return;
  }
  try {
  const payload = {
    battery_name: nameEl.value.trim(),
    battery_type: document.getElementById('battery_type')?.value || null,
    capacity_ah: document.getElementById('battery_capacity_ah')?.value ? parseInt(document.getElementById('battery_capacity_ah').value, 10) : null,
    quantity: document.getElementById('battery_quantity')?.value ? parseInt(document.getElementById('battery_quantity').value, 10) : 1,
    installed_date: document.getElementById('battery_installed_date')?.value || null,
    last_test_date: document.getElementById('battery_last_test_date')?.value || null,
    last_test_notes: document.getElementById('battery_last_test_notes')?.value || null,
    replaced_date: document.getElementById('battery_replaced_date')?.value || null,
    notes: document.getElementById('battery_notes')?.value || null
  };
  if (editingBatteryId) {
    await updateBattery(editingBatteryId, payload);
  } else {
    await createBattery(currentBoatId, payload);
  }
  editingBatteryId = null;
  document.getElementById('battery-form-wrap').style.display = 'none';
  document.getElementById('battery-add-btn').style.display = electricalArchived ? 'none' : 'block';
  await loadBatteries();
  } finally {
    setSaveButtonLoading(form, false);
  }
}

async function loadBatteries() {
  const listEl = document.getElementById('battery-list');
  if (!listEl || !currentBoatId) return;

  const batteries = await getBatteries(currentBoatId);

  if (batteries.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${renderIcon('battery')}</div>
        <p>No batteries added yet</p>
        ${!electricalArchived ? `<div class="empty-state-actions"><button type="button" class="btn-primary" onclick="event.preventDefault(); document.getElementById('battery-add-btn')?.click()">${renderIcon('plus')} Add Battery</button></div>` : ''}
      </div>
    `;
    attachBatteryHandlers();
    return;
  }

  listEl.innerHTML = batteries.map((b) => `
    <div class="card battery-item" data-battery-id="${b.id}">
      <div class="card-header">
        <div>
          <h3 class="card-title">${(b.battery_name || 'Battery').replace(/</g, '&lt;')}</h3>
          <p class="text-muted">
            ${b.battery_type || ''}
            ${b.capacity_ah != null ? ' • ' + b.capacity_ah + ' Ah' : ''}
            ${b.quantity > 1 ? ' × ' + b.quantity : ''}
          </p>
        </div>
        <div>
          ${!electricalArchived ? `
            <a href="#" class="btn-link battery-edit-btn" data-battery-id="${b.id}">${renderIcon('edit')}</a>
            <button type="button" class="btn-link btn-danger battery-delete-btn" data-battery-id="${b.id}">${renderIcon('trash')}</button>
          ` : ''}
        </div>
      </div>
      <div>
        ${b.installed_date ? `<p><strong>Installed:</strong> ${new Date(b.installed_date).toLocaleDateString()}</p>` : ''}
        ${b.last_test_date ? `<p><strong>Last test:</strong> ${new Date(b.last_test_date).toLocaleDateString()}</p>` : ''}
        ${b.notes ? `<p><strong>Notes:</strong> ${b.notes}</p>` : ''}
      </div>
    </div>
  `).join('');

  attachBatteryHandlers();
}

function attachBatteryHandlers() {
  document.querySelectorAll('.battery-edit-btn').forEach((btn) => {
    const clone = btn.cloneNode(true);
    btn.replaceWith(clone);
  });
  document.querySelectorAll('.battery-delete-btn').forEach((btn) => {
    const clone = btn.cloneNode(true);
    btn.replaceWith(clone);
  });

  document.querySelectorAll('.battery-edit-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      getBatteries(currentBoatId).then((batteries) => {
        const found = batteries.find((b) => b.id === btn.dataset.batteryId);
        if (found) openEditBattery(found);
      });
    });
  });

  document.querySelectorAll('.battery-delete-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const ok = await confirmAction({
        title: 'Delete this battery?',
        message: 'This cannot be undone.',
        confirmLabel: 'Delete',
        cancelLabel: 'Cancel',
        danger: true
      });
      if (!ok) return;
      await deleteBattery(btn.dataset.batteryId);
      await loadBatteries();
      showToast('Battery removed', 'info');
    });
  });
}

export default {
  render,
  onMount
};

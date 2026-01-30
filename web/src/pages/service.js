/**
 * Service History Page
 */

import { navigate } from '../router.js';
import { renderIcon } from '../components/icons.js';
import { createYachtHeader } from '../components/header.js';
import { isBoatArchived, getServiceEntries, createServiceEntry, updateServiceEntry, deleteServiceEntry, getEngines } from '../lib/dataService.js';
import { getUploads, saveUpload, deleteUpload, openUpload, formatFileSize, getUpload, LIMITED_UPLOAD_SIZE_BYTES, LIMITED_UPLOADS_PER_ENTITY, saveLinkAttachment } from '../lib/uploads.js';

let editingId = null;
let serviceArchived = false;
let filterEngineId = null;
let currentBoatId = null;
let serviceFileInput = null;
let currentServiceIdForUpload = null;

// DIY checklist definition – grouped by section
// Each item will become a checkbox the user can tick
const DIY_CHECKLIST_SECTIONS = [
  {
    id: 'engine_oil_lubrication',
    title: 'Engine oil & lubrication',
    items: [
      { id: 'warm_engine_before_draining_oil', label: 'Warm engine before draining oil' },
      { id: 'engine_oil_drained_completely', label: 'Engine oil drained completely' },
      { id: 'oil_filter_replaced', label: 'Oil filter replaced' },
      { id: 'correct_oil_grade_used', label: 'Correct oil grade used (record type & quantity)' },
      { id: 'oil_level_checked_after_run_up', label: 'Oil level checked after run-up' },
      { id: 'no_oil_leaks_present', label: 'No oil leaks present' }
    ]
  },
  {
    id: 'fuel_system',
    title: 'Fuel system',
    items: [
      { id: 'primary_fuel_filter_replaced', label: 'Primary fuel filter / water separator replaced' },
      { id: 'secondary_fuel_filter_replaced', label: 'Secondary (engine-mounted) fuel filter replaced' },
      { id: 'fuel_system_bled_if_required', label: 'Fuel system bled (if required)' },
      { id: 'fuel_lines_cracks', label: 'Fuel lines inspected for cracks' },
      { id: 'fuel_lines_chafe', label: 'Fuel lines inspected for chafe' },
      { id: 'fuel_lines_leaks', label: 'Fuel lines inspected for leaks' },
      { id: 'injector_leak_off_pipes_checked', label: 'Injector leak-off pipes checked' },
      { id: 'no_diesel_smells_or_seepage', label: 'No diesel smells or seepage' }
    ]
  },
  {
    id: 'cooling_raw_water',
    title: 'Cooling system – raw water side',
    items: [
      { id: 'raw_water_intake_seacock_operated', label: 'Raw water intake seacock opened and closed' },
      { id: 'seacock_lubricated_and_operational', label: 'Seacock lubricated and left operational' },
      { id: 'raw_water_strainer_cleaned', label: 'Raw water strainer cleaned' },
      { id: 'impeller_inspected_or_replaced', label: 'Impeller inspected or replaced' },
      { id: 'impeller_housing_checked_for_wear', label: 'Impeller housing checked for wear' },
      { id: 'raw_water_hoses_inspected', label: 'Raw water hoses inspected' },
      { id: 'raw_water_hose_clips_checked', label: 'Hose clips checked and tightened' }
    ]
  },
  {
    id: 'cooling_fresh_water',
    title: 'Cooling system – fresh water side',
    items: [
      { id: 'coolant_level_checked', label: 'Coolant level checked' },
      { id: 'coolant_condition_checked', label: 'Coolant condition checked' },
      { id: 'coolant_strength_tested', label: 'Coolant strength tested (if applicable)' },
      { id: 'heat_exchanger_inspected_externally', label: 'Heat exchanger inspected externally' },
      { id: 'no_coolant_leaks_present', label: 'No coolant leaks present' },
      { id: 'expansion_tank_cap_checked', label: 'Expansion tank cap checked' }
    ]
  },
  {
    id: 'belts_pulleys',
    title: 'Belts & pulleys',
    items: [
      { id: 'alternator_belt_inspected', label: 'Alternator belt inspected' },
      { id: 'water_pump_belt_inspected', label: 'Water pump belt inspected (if separate)' },
      { id: 'belt_tension_correct', label: 'Belt tension correct' },
      { id: 'no_belt_cracking_or_fraying', label: 'No cracking, glazing or fraying' }
    ]
  },
  {
    id: 'air_intake',
    title: 'Air intake',
    items: [
      { id: 'air_filter_cleaned_or_replaced', label: 'Air filter cleaned or replaced' },
      { id: 'air_intake_free_from_obstruction', label: 'Air intake free from obstruction' },
      { id: 'turbo_hoses_inspected', label: 'Turbo hoses (if fitted) inspected' }
    ]
  },
  {
    id: 'electrical_charging',
    title: 'Electrical & charging',
    items: [
      { id: 'battery_terminals_clean_and_tight', label: 'Battery terminals clean and tight' },
      { id: 'engine_earth_connections_checked', label: 'Engine earth connections checked' },
      { id: 'wiring_corrosion', label: 'Wiring loom inspected for corrosion' },
      { id: 'wiring_heat_damage', label: 'Wiring loom inspected for heat damage' },
      { id: 'wiring_chafe', label: 'Wiring loom inspected for chafe' },
      { id: 'starter_motor_operation_checked', label: 'Starter motor operation checked' },
      { id: 'alternator_charging_confirmed', label: 'Alternator charging confirmed' }
    ]
  },
  {
    id: 'engine_mounts_alignment',
    title: 'Engine mounts & alignment',
    items: [
      { id: 'engine_mounts_inspected', label: 'Engine mounts inspected' },
      { id: 'mount_rubbers_good_condition', label: 'Mount rubbers in good condition' },
      { id: 'mount_bolts_tight', label: 'Mount bolts tight' },
      { id: 'no_excessive_engine_movement', label: 'No excessive engine movement' },
      { id: 'visual_shaft_alignment_check', label: 'Visual shaft alignment check' }
    ]
  },
  {
    id: 'gearbox_transmission',
    title: 'Gearbox / transmission',
    items: [
      { id: 'gearbox_oil_drained_or_sampled', label: 'Gearbox oil drained or sampled' },
      { id: 'gearbox_oil_replaced', label: 'Gearbox oil replaced (record type & quantity)' },
      { id: 'gearbox_oil_level_correct', label: 'Gearbox oil level correct' },
      { id: 'gearbox_oil_clean', label: 'Gearbox oil clean (no water/milky appearance)' },
      { id: 'forward_reverse_engagement_checked', label: 'Forward and reverse engagement checked' },
      { id: 'gearbox_cooler_inspected', label: 'Gearbox cooler inspected (if fitted)' }
    ]
  },
  {
    id: 'shaft_seal_stern_gear',
    title: 'Shaft, seal & stern gear',
    items: [
      { id: 'shaft_seal_inspected', label: 'Shaft seal / stern gland inspected' },
      { id: 'no_water_ingress', label: 'No water ingress' },
      { id: 'no_abnormal_heat_at_seal', label: 'No abnormal heat at seal' },
      { id: 'shaft_coupling_bolts_secure', label: 'Shaft coupling bolts secure' },
      { id: 'no_unusual_vibration', label: 'No unusual vibration' }
    ]
  },
  {
    id: 'exhaust_system',
    title: 'Exhaust system',
    items: [
      { id: 'exhaust_hose_inspected', label: 'Exhaust hose inspected' },
      { id: 'exhaust_hose_clips_secure', label: 'Hose clips secure' },
      { id: 'water_injection_elbow_inspected', label: 'Water injection elbow inspected (externally)' },
      { id: 'no_exhaust_leaks', label: 'No exhaust leaks' },
      { id: 'exhaust_water_flow_confirmed', label: 'Exhaust water flow confirmed' }
    ]
  },
  {
    id: 'anodes_corrosion',
    title: 'Anodes & corrosion protection',
    items: [
      { id: 'engine_anodes_inspected', label: 'Engine anodes inspected' },
      { id: 'anodes_replaced_if_required', label: 'Anodes replaced if required' },
      { id: 'bonding_cables_checked', label: 'Bonding cables checked' },
      { id: 'no_excessive_corrosion_present', label: 'No excessive corrosion present' }
    ]
  },
  {
    id: 'controls_safety',
    title: 'Controls & safety',
    items: [
      { id: 'throttle_cable_smooth', label: 'Throttle cable smooth operation' },
      { id: 'gear_selector_cable_smooth', label: 'Gear selector cable smooth operation' },
      { id: 'emergency_stop_tested', label: 'Emergency stop tested' },
      { id: 'engine_stop_works_correctly', label: 'Engine stop works correctly' }
    ]
  },
  {
    id: 'engine_run_operational',
    title: 'Engine run & operational checks',
    items: [
      { id: 'engine_started_from_cold', label: 'Engine started from cold' },
      { id: 'oil_pressure_normal', label: 'Oil pressure normal' },
      { id: 'coolant_temperature_normal', label: 'Coolant temperature normal' },
      { id: 'charging_voltage_normal', label: 'Charging voltage normal' },
      { id: 'no_abnormal_noise', label: 'No abnormal noise' },
      { id: 'no_excessive_vibration', label: 'No excessive vibration' },
      { id: 'exhaust_smoke_cold_start', label: 'Exhaust smoke checked – cold start' },
      { id: 'exhaust_smoke_warm_running', label: 'Exhaust smoke checked – warm running' }
    ]
  },
  {
    id: 'sea_trial',
    title: 'Sea trial (if applicable)',
    items: [
      { id: 'engine_reaches_operating_temperature', label: 'Engine reaches operating temperature' },
      { id: 'full_rpm_achieved_under_load', label: 'Full RPM achieved under load' },
      { id: 'gearbox_operates_smoothly', label: 'Gearbox operates smoothly' },
      { id: 'no_alarms_triggered', label: 'No alarms triggered' }
    ]
  },
  {
    id: 'final_checks',
    title: 'Final checks',
    items: [
      { id: 'engine_bay_clean_and_dry', label: 'Engine bay clean and dry' },
      { id: 'all_tools_removed', label: 'All tools removed' },
      { id: 'seacocks_position_confirmed', label: 'Seacocks left in correct position' },
      { id: 'service_notes_recorded', label: 'Service notes recorded' }
    ]
  },
  {
    id: 'service_notes_advisories',
    title: 'Service notes & advisories',
    items: [
      { id: 'items_requiring_future_attention_noted', label: 'Items requiring future attention noted' },
      { id: 'parts_replaced_listed', label: 'Parts replaced listed' },
      { id: 'next_service_due_recorded', label: 'Next service due recorded' }
    ]
  }
];

// Map service type -> which checklist sections should be shown.
// If a type is not listed here (or mapped to null), behaviour is:
// - "Annual Service"  -> all sections
// - Anything else     -> no checklist (notes only)
const SERVICE_TYPE_SECTION_MAP = {
  'Oil Change': [
    'engine_oil_lubrication',
    'belts_pulleys',
    'engine_run_operational',
    'final_checks',
    'service_notes_advisories'
  ],
  'Filter Change': [
    'fuel_system',
    'air_intake',
    'engine_run_operational',
    'final_checks',
    'service_notes_advisories'
  ],
  'Winterization': [
    'cooling_raw_water',
    'cooling_fresh_water',
    'fuel_system',
    'anodes_corrosion',
    'final_checks',
    'service_notes_advisories'
  ]
};

function getDIYChecklistStats(entry) {
  const checklist = entry?.diy_checklist || {};
  let total = 0;
  let completed = 0;

  DIY_CHECKLIST_SECTIONS.forEach(section => {
    section.items.forEach(item => {
      const key = `${section.id}.${item.id}`;
      total += 1;
      if (checklist[key]) completed += 1;
    });
  });

  return { total, completed };
}

function render(params = {}) {
  // Get boat ID from route params
  currentBoatId = params?.id || window.routeParams?.id;
  if (!currentBoatId) {
    const wrapperError = document.createElement('div');
    wrapperError.innerHTML = '<div class="page-content"><div class="container"><h1>Error</h1><p>Boat ID required</p></div></div>';
    return wrapperError;
  }

  const wrapper = document.createElement('div');

  // Yacht header with back arrow that uses browser history
  const yachtHeader = createYachtHeader('Service History', true, () => window.history.back());
  wrapper.appendChild(yachtHeader);

  // Page content with service color theme
  const pageContent = document.createElement('div');
  pageContent.className = 'page-content card-color-service';

  const container = document.createElement('div');
  container.className = 'container';

  const filterContainer = document.createElement('div');
  filterContainer.className = 'page-actions';
  filterContainer.id = 'service-filter';

  const addBtn = document.createElement('button');
  addBtn.className = 'btn-primary';
  addBtn.id = 'service-add-btn';
  addBtn.innerHTML = `${renderIcon('plus')} Add Service Entry`;
  addBtn.onclick = () => showServiceForm();

  const listContainer = document.createElement('div');
  listContainer.id = 'service-list';

  // Single hidden file input reused for per-entry attachments
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.id = 'service-file-input';
  fileInput.multiple = true;
  fileInput.accept = '.pdf,.jpg,.jpeg,.png';
  fileInput.style.display = 'none';

  container.appendChild(filterContainer);
  container.appendChild(addBtn);
  container.appendChild(fileInput);
  container.appendChild(listContainer);

  pageContent.appendChild(container);
  wrapper.appendChild(pageContent);

  return wrapper;
}

async function onMount(params = {}) {
  const boatId = params?.id || window.routeParams?.id;
  if (boatId) {
    currentBoatId = boatId;
  }

  serviceArchived = currentBoatId ? await isBoatArchived(currentBoatId) : false;
  const addBtn = document.getElementById('service-add-btn');
  if (addBtn && serviceArchived) addBtn.style.display = 'none';

  window.navigate = navigate;

  serviceFileInput = document.getElementById('service-file-input');

  loadFilters();

  if (serviceFileInput) {
    serviceFileInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      if (!files.length || !currentBoatId || !currentServiceIdForUpload) return;

      const existing = getUploads('service', currentServiceIdForUpload, currentBoatId);
      const remainingSlots = LIMITED_UPLOADS_PER_ENTITY - existing.length;

      if (remainingSlots <= 0) {
        alert(`You can only upload up to ${LIMITED_UPLOADS_PER_ENTITY} files for this service entry.`);
        serviceFileInput.value = '';
        return;
      }

      const validFiles = [];
      let oversizedCount = 0;

      files.forEach(file => {
        if (file.size > LIMITED_UPLOAD_SIZE_BYTES) {
          oversizedCount++;
        } else {
          validFiles.push(file);
        }
      });

      if (oversizedCount > 0) {
        alert('Some files were larger than 2 MB and were skipped.');
      }

      if (!validFiles.length) {
        serviceFileInput.value = '';
        return;
      }

      const filesToUpload = validFiles.slice(0, remainingSlots);
      if (validFiles.length > remainingSlots) {
        alert(`Only ${remainingSlots} more file(s) can be uploaded for this service entry (max ${LIMITED_UPLOADS_PER_ENTITY}).`);
      }

      for (const file of filesToUpload) {
        await saveUpload(file, 'service', currentServiceIdForUpload, currentBoatId);
      }

      serviceFileInput.value = '';
      loadServices();
    });
  }

  loadServices();
}

function loadFilters() {
  const filterContainer = document.getElementById('service-filter');
  const engines = enginesStorage.getAll(currentBoatId);
  
  filterContainer.innerHTML = `
    <select id="engine-filter" class="form-control" style="max-width: 300px;">
      <option value="">All Engines</option>
      ${engines.map(e => `<option value="${e.id}">${e.label || 'Unnamed'}</option>`).join('')}
    </select>
  `;

  document.getElementById('engine-filter').addEventListener('change', (e) => {
    filterEngineId = e.target.value || null;
    loadServices();
  });
}

async function loadServices() {
  const listContainer = document.getElementById('service-list');
  let services = currentBoatId ? await getServiceEntries(currentBoatId) : [];

  if (filterEngineId) {
    services = services.filter(s => s.engine_id === filterEngineId);
  }

  if (services.length === 0) {
    listContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${renderIcon('wrench')}</div>
        <p>No service entries yet</p>
      </div>
    `;
    attachHandlers();
    return;
  }

  const engines = currentBoatId ? await getEngines(currentBoatId) : [];
  const getEngineLabel = (id) => {
    const engine = engines.find(e => e.id === id);
    return engine ? engine.label : 'Unknown Engine';
  };

  listContainer.innerHTML = services.map(service => {
    const enginesLabel = getEngineLabel(service.engine_id);
    const modeLabel = service.mode === 'DIY'
      ? 'DIY Service'
      : (service.mode === 'Professional' ? 'Professional Service' : 'Service');

    let diySummary = '';
    if (service.mode === 'DIY') {
      const stats = getDIYChecklistStats(service);
      if (stats.total > 0) {
        diySummary = `<p class="text-muted">DIY checklist: ${stats.completed}/${stats.total} items ticked</p>`;
      }
    }

    return `
    <div class="card">
      <div class="card-header">
        <div>
          <h3 class="card-title">${new Date(service.date).toLocaleDateString()}</h3>
          <p class="text-muted">${enginesLabel} • ${service.service_type || 'Service'} • ${modeLabel}</p>
        </div>
        <div>
          ${!serviceArchived ? `<button class="btn-link" onclick="servicePageEdit('${service.id}')">${renderIcon('edit')}</button>
          <button class="btn-link btn-danger" onclick="servicePageDelete('${service.id}')">${renderIcon('trash')}</button>` : ''}
        </div>
      </div>
      <div>
        <p><strong>Engine Hours:</strong> ${service.engine_hours || 'N/A'}</p>
        ${diySummary}
        ${service.notes ? `<p><strong>Notes:</strong> ${service.notes}</p>` : ''}
        <div class="service-attachments" data-service-id="${service.id}">
          <h4 style="margin-top: 0.75rem; margin-bottom: 0.25rem;">Attachments</h4>
          <div class="attachment-list" id="service-attachments-list-${service.id}"></div>
          <button type="button" class="btn-link" onclick="servicePageAddAttachment('${service.id}')">
            ${renderIcon('plus')} Add Attachment (max ${LIMITED_UPLOADS_PER_ENTITY}, 2 MB each)
          </button>
        </div>
      </div>
    </div>
  `;
  }).join('');

  attachHandlers();
  loadServiceAttachments(services);
}

function attachHandlers() {
  window.servicePageEdit = (id) => {
    editingId = id;
    showServiceForm();
  };

  window.servicePageDelete = async (id) => {
    if (confirm('Delete this service entry?')) {
      await deleteServiceEntry(id);
      loadServices();
    }
  };

  window.servicePageAddAttachment = (serviceId) => {
    currentServiceIdForUpload = serviceId;
    if (serviceFileInput) {
      serviceFileInput.click();
    }
  };
}

function loadServiceAttachments(services) {
  if (!currentBoatId) return;

  services.forEach(service => {
    const attachmentsList = document.getElementById(`service-attachments-list-${service.id}`);
    if (!attachmentsList) return;

    const attachments = getUploads('service', service.id, currentBoatId);
    attachmentsList.innerHTML = '';

    if (attachments.length === 0) {
      attachmentsList.innerHTML = `<p class="text-muted">No attachments.</p>`;
      return;
    }

    attachments.forEach(upload => {
      const item = document.createElement('div');
      item.className = 'attachment-item';
      item.innerHTML = `
        <div class="attachment-info">
          <div class="attachment-icon">${renderIcon('file')}</div>
          <div class="attachment-details">
            <div class="attachment-name">${upload.filename}</div>
            <div class="attachment-meta">${formatFileSize(upload.size)} • ${upload.mime_type}</div>
          </div>
        </div>
        <div>
          <button type="button" class="btn-link service-open-attachment-btn" data-upload-id="${upload.id}">
            Open
          </button>
          <button type="button" class="btn-link btn-danger service-delete-attachment-btn" data-upload-id="${upload.id}">
            ${renderIcon('trash')}
          </button>
        </div>
      `;
      attachmentsList.appendChild(item);
    });
  });

  attachServiceAttachmentHandlers();
}

function attachServiceAttachmentHandlers() {
  document.querySelectorAll('.service-open-attachment-btn').forEach(btn => {
    const clone = btn.cloneNode(true);
    btn.replaceWith(clone);
  });
  document.querySelectorAll('.service-delete-attachment-btn').forEach(btn => {
    const clone = btn.cloneNode(true);
    btn.replaceWith(clone);
  });

  document.querySelectorAll('.service-open-attachment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const uploadId = btn.dataset.uploadId;
      const upload = getUpload(uploadId);
      if (upload) {
        openUpload(upload);
      }
    });
  });

  document.querySelectorAll('.service-delete-attachment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const uploadId = btn.dataset.uploadId;
      if (confirm('Delete this attachment?')) {
        deleteUpload(uploadId);
        loadServices();
      }
    });
  });
}

async function showServiceForm() {
  const services = currentBoatId ? await getServiceEntries(currentBoatId) : [];
  const existingEntry = editingId ? services.find((s) => s.id === editingId) : null;
  if (!editingId) {
    editingId = `service_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  const entry = existingEntry;
  const mode = entry?.mode || 'Professional';
  const engines = currentBoatId ? await getEngines(currentBoatId) : [];
  const serviceTypes = ['Oil Change', 'Filter Change', 'Annual Service', 'Winterization', 'Other'];

  const selectedEngine = entry?.engine_id ? engines.find(e => e.id === entry.engine_id) : null;

  const formHtml = `
    <div class="card" id="service-form-card">
      <h3>${editingId ? 'Edit Service Entry' : 'Add Service Entry'}</h3>
      <form id="service-form">
        <div class="form-group">
          <label>Service carried out by</label>
          <div>
            <label class="inline-choice" style="margin-right: 1rem;">
              <input type="radio" name="service_mode" value="DIY" ${mode === 'DIY' ? 'checked' : ''}>
              DIY / Self service
            </label>
            <label class="inline-choice">
              <input type="radio" name="service_mode" value="Professional" ${mode !== 'DIY' ? 'checked' : ''}>
              Professional / Mechanic
            </label>
          </div>
        </div>
        <div class="form-group">
          <label for="service_date">Date *</label>
          <input type="date" id="service_date" required value="${entry?.date || new Date().toISOString().split('T')[0]}">
        </div>
        <div class="form-group">
          <label for="service_engine">Engine *</label>
          <select id="service_engine" required>
            <option value="">Select engine...</option>
            ${engines.map(e => `<option value="${e.id}" ${entry?.engine_id === e.id ? 'selected' : ''}>${e.label || 'Unnamed'}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label for="service_type">Service Type</label>
          <select id="service_type">
            <option value="">Select...</option>
            ${serviceTypes.map(t => `<option value="${t}" ${entry?.service_type === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
          <input type="text" id="service_type_custom" placeholder="Or enter custom type" value="${entry?.service_type && !serviceTypes.includes(entry.service_type) ? entry.service_type : ''}" style="margin-top: 0.5rem;">
        </div>
        <div class="form-group">
          <label for="service_hours">Engine Hours</label>
          <input type="number" id="service_hours" step="0.1" value="${entry?.engine_hours || ''}">
        </div>
        <div class="card" id="service-diy-card" style="margin-top: 1rem; ${mode === 'DIY' ? '' : 'display: none;'}">
          <h4>DIY Boat Engine & Gearbox Service Checklist</h4>
          <p class="text-muted">Tick each item as you complete it.</p>
          <div class="form-group">
            <label for="diy_engine_make_model">Engine make & model</label>
            <input
              type="text"
              id="diy_engine_make_model"
              value="${entry?.diy_meta?.engine_make_model || (selectedEngine ? `${(selectedEngine.manufacturer || '')} ${(selectedEngine.model || '')}`.trim() : '')}"
              readonly
            >
          </div>
          <div class="form-group">
            <label for="diy_engine_serial_number">Engine serial number</label>
            <input
              type="text"
              id="diy_engine_serial_number"
              value="${entry?.diy_meta?.engine_serial_number || (selectedEngine?.serial_number || '')}"
              readonly
            >
          </div>
          <div class="form-group">
            <label for="diy_gearbox_make_model">Gearbox make & model</label>
            <input
              type="text"
              id="diy_gearbox_make_model"
              value="${entry?.diy_meta?.gearbox_make_model || (selectedEngine ? `${(selectedEngine.gearbox_manufacturer || '')} ${(selectedEngine.gearbox_model || '')}`.trim() : '')}"
              readonly
            >
          </div>
          <div class="form-group">
            <label for="diy_person_carrying_out_service">Person carrying out service</label>
            <input type="text" id="diy_person_carrying_out_service" value="${entry?.diy_meta?.person_carrying_out_service || ''}">
          </div>

          <div id="service-diy-checklist"></div>

          <div class="form-group" style="margin-top: 1rem;">
            <label>Seacocks left in correct position</label>
            <div>
              <label class="inline-choice" style="margin-right: 1rem;">
                <input type="radio" name="diy_seacocks_position" value="Open" ${entry?.seacocks_position === 'Open' ? 'checked' : ''}>
                Open
              </label>
              <label class="inline-choice" style="margin-right: 1rem;">
                <input type="radio" name="diy_seacocks_position" value="Closed" ${entry?.seacocks_position === 'Closed' ? 'checked' : ''}>
                Closed
              </label>
              <label class="inline-choice">
                <input type="radio" name="diy_seacocks_position" value="Mixed" ${entry?.seacocks_position === 'Mixed' ? 'checked' : ''}>
                Mixed
              </label>
            </div>
          </div>

          <div class="form-group">
            <label for="diy_future_items_notes">Items requiring future attention (notes)</label>
            <textarea id="diy_future_items_notes" rows="3">${entry?.future_items_notes || ''}</textarea>
          </div>
          <div class="form-group">
            <label for="diy_parts_replaced_notes">Parts replaced (notes)</label>
            <textarea id="diy_parts_replaced_notes" rows="3">${entry?.parts_replaced_notes || ''}</textarea>
          </div>
          <div class="form-group">
            <label for="diy_next_service_due">Next service due</label>
            <input type="date" id="diy_next_service_due" value="${entry?.next_service_due || ''}">
          </div>
        </div>

        <div class="card" id="service-pro-card" style="margin-top: 1rem; ${mode === 'DIY' ? 'display: none;' : ''}">
          <h4>Professional / Mechanic Details</h4>
          <div class="form-group">
            <label for="pro_workshop_name">Workshop / company name</label>
            <input type="text" id="pro_workshop_name" value="${entry?.pro_meta?.workshop_name || ''}">
          </div>
          <div class="form-group">
            <label for="pro_mechanic_name">Mechanic name</label>
            <input type="text" id="pro_mechanic_name" value="${entry?.pro_meta?.mechanic_name || ''}">
          </div>
          <div class="form-group">
            <label for="pro_invoice_number">Invoice number</label>
            <input type="text" id="pro_invoice_number" value="${entry?.pro_meta?.invoice_number || ''}">
          </div>
          <div class="form-group">
            <label for="pro_service_description">Service description</label>
            <textarea id="pro_service_description" rows="3">${entry?.pro_meta?.service_description || ''}</textarea>
          </div>
        </div>

        <div class="form-group">
          <label for="service_notes">Notes</label>
          <textarea id="service_notes" rows="4">${entry?.notes || ''}</textarea>
        </div>
        <div class="card" id="service-attachments-card" style="margin-top: 1rem;">
          <h4>Attachments & Links</h4>
          <p class="text-muted">Upload up to ${LIMITED_UPLOADS_PER_ENTITY} files (max 2 MB each), or add helpful links for this service entry.</p>
          <div class="attachment-list" id="service-attachments-list-form"></div>
          <input type="file" id="service-file-input-form" multiple accept=".pdf,.jpg,.jpeg,.png" style="display: none;">
          <button type="button" class="btn-secondary" id="service-add-file-btn" style="margin-top: 0.5rem;">
            ${renderIcon('plus')} Add File
          </button>
          <div class="form-group" style="margin-top: 0.75rem;">
            <label>Links</label>
            <input type="text" id="service-link-name" placeholder="Link name (optional)">
            <input type="url" id="service-link-url" placeholder="https://example.com" style="margin-top: 0.5rem;">
            <button type="button" class="btn-secondary" id="service-add-link-btn" style="margin-top: 0.5rem;">
              ${renderIcon('plus')} Add Link
            </button>
          </div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn-secondary" onclick="servicePageCancelForm()">Cancel</button>
          <button type="submit" class="btn-primary">Save</button>
        </div>
      </form>
    </div>
  `;

  const listContainer = document.getElementById('service-list');
  listContainer.insertAdjacentHTML('afterbegin', formHtml);

  const form = document.getElementById('service-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    saveService();
  });

  // Mode toggle – show/hide DIY vs Professional sections
  const modeRadios = document.querySelectorAll('input[name="service_mode"]');
  const diyCard = document.getElementById('service-diy-card');
  const proCard = document.getElementById('service-pro-card');

  modeRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      const selected = document.querySelector('input[name="service_mode"]:checked')?.value;
      if (selected === 'DIY') {
        if (diyCard) diyCard.style.display = '';
        if (proCard) proCard.style.display = 'none';
      } else {
        if (diyCard) diyCard.style.display = 'none';
        if (proCard) proCard.style.display = '';
      }
    });
  });

  // When engine selection changes, refresh DIY engine info from engine record
  const engineSelect = document.getElementById('service_engine');
  if (engineSelect) {
    engineSelect.addEventListener('change', (e) => {
      const engineId = e.target.value;
      const enginesAll = enginesStorage.getAll();
      const eng = enginesAll.find(en => en.id === engineId);
      const makeModelInput = document.getElementById('diy_engine_make_model');
      const serialInput = document.getElementById('diy_engine_serial_number');
      const gearboxInput = document.getElementById('diy_gearbox_make_model');

      if (eng && makeModelInput) {
        makeModelInput.value = `${(eng.manufacturer || '')} ${(eng.model || '')}`.trim();
      }
      if (eng && serialInput) {
        serialInput.value = eng.serial_number || '';
      }
      if (eng && gearboxInput) {
        gearboxInput.value = `${(eng.gearbox_manufacturer || '')} ${(eng.gearbox_model || '')}`.trim();
      }
    });
  }

  // Render DIY checklist with existing values (if any)
  renderDIYChecklist(entry);

  // Handle custom service type
  document.getElementById('service_type').addEventListener('change', (e) => {
    if (e.target.value) {
      document.getElementById('service_type_custom').value = '';
    }
    renderDIYChecklist(entry);
  });

  document.getElementById('service_type_custom').addEventListener('input', (e) => {
    if (e.target.value) {
      document.getElementById('service_type').value = '';
    }
    renderDIYChecklist(entry);
  });

  // Attach per-entry attachments & links handlers for this entry
  initServiceFormAttachments(editingId);

  window.servicePageCancelForm = () => {
    document.getElementById('service-form-card').remove();
    editingId = null;
  };
}

function renderDIYChecklist(entry) {
  const container = document.getElementById('service-diy-checklist');
  if (!container) return;

  const existingChecklist = entry?.diy_checklist || {};
  const currentServiceType = getCurrentServiceTypeFromForm();
  const activeSections = getActiveChecklistSectionsForServiceType(currentServiceType);

  if (!activeSections.length) {
    container.innerHTML = `
      <p class="text-muted" style="margin-top: 0;">
        No checklist items for this service type. Please record details in the notes fields below.
      </p>
    `;
    return;
  }

  container.innerHTML = activeSections.map(section => {
    const itemsHtml = section.items.map(item => {
      const key = `${section.id}.${item.id}`;
      const checked = existingChecklist[key] ? 'checked' : '';
      const inputId = `diy_${section.id}_${item.id}`;
      return `
        <label class="checkbox-row">
          <input type="checkbox" id="${inputId}" data-section="${section.id}" data-item="${item.id}" ${checked}>
          <span>${item.label}</span>
        </label>
      `;
    }).join('');

    return `
      <div class="form-group">
        <h5>${section.title}</h5>
        <div class="diy-checklist-section">
          ${itemsHtml}
        </div>
      </div>
    `;
  }).join('');
}

function getActiveChecklistSectionsForServiceType(serviceType) {
  if (!serviceType) return [];
  if (serviceType === 'Annual Service') {
    // Annual service uses the full checklist
    return DIY_CHECKLIST_SECTIONS;
  }

  const mapped = SERVICE_TYPE_SECTION_MAP[serviceType];
  if (!mapped || !Array.isArray(mapped)) {
    // For "Other" or any custom types, show no checklist – user can use notes only
    return [];
  }

  return DIY_CHECKLIST_SECTIONS.filter(section => mapped.includes(section.id));
}

function getCurrentServiceTypeFromForm() {
  const selectEl = document.getElementById('service_type');
  const customEl = document.getElementById('service_type_custom');
  const selected = (selectEl?.value || '').trim();
  const custom = (customEl?.value || '').trim();
  return selected || custom || '';
}

function initServiceFormAttachments(serviceId) {
  const fileInput = document.getElementById('service-file-input-form');
  const addFileBtn = document.getElementById('service-add-file-btn');
  const addLinkBtn = document.getElementById('service-add-link-btn');

  if (addFileBtn && fileInput) {
    addFileBtn.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      if (!files.length || !currentBoatId) return;

      const existing = getUploads('service', serviceId, currentBoatId);
      const remainingSlots = LIMITED_UPLOADS_PER_ENTITY - existing.length;

      if (remainingSlots <= 0) {
        alert(`You can only upload up to ${LIMITED_UPLOADS_PER_ENTITY} files for this service entry.`);
        fileInput.value = '';
        return;
      }

      const validFiles = [];
      let oversizedCount = 0;

      files.forEach(file => {
        if (file.size > LIMITED_UPLOAD_SIZE_BYTES) {
          oversizedCount++;
        } else {
          validFiles.push(file);
        }
      });

      if (oversizedCount > 0) {
        alert('Some files were larger than 2 MB and were skipped.');
      }

      if (!validFiles.length) {
        fileInput.value = '';
        return;
      }

      const filesToUpload = validFiles.slice(0, remainingSlots);
      if (validFiles.length > remainingSlots) {
        alert(`Only ${remainingSlots} more file(s) can be uploaded for this service entry (max ${LIMITED_UPLOADS_PER_ENTITY}).`);
      }

      for (const file of filesToUpload) {
        await saveUpload(file, 'service', serviceId, currentBoatId);
      }

      fileInput.value = '';
      loadServiceFormAttachments(serviceId);
    });
  }

  if (addLinkBtn) {
    addLinkBtn.addEventListener('click', () => {
      const nameInput = document.getElementById('service-link-name');
      const urlInput = document.getElementById('service-link-url');
      const name = nameInput?.value.trim() || '';
      const url = urlInput?.value.trim();

      if (!url) {
        alert('Please enter a URL.');
        return;
      }

      saveLinkAttachment(name, url, 'service', serviceId, currentBoatId);
      if (nameInput) nameInput.value = '';
      if (urlInput) urlInput.value = '';
      loadServiceFormAttachments(serviceId);
    });
  }

  loadServiceFormAttachments(serviceId);
}

function loadServiceFormAttachments(serviceId) {
  const attachmentsList = document.getElementById('service-attachments-list-form');
  if (!attachmentsList || !currentBoatId) return;

  const attachments = getUploads('service', serviceId, currentBoatId);
  attachmentsList.innerHTML = '';

  if (attachments.length === 0) {
    attachmentsList.innerHTML = `<p class="text-muted">No files or links added yet.</p>`;
    return;
  }

  attachments.forEach(upload => {
    const isLink = upload.storage_type === 'link' || upload.mime_type === 'text/url' || upload.url;
    const item = document.createElement('div');
    item.className = 'attachment-item';
    item.innerHTML = `
      <div class="attachment-info">
        <div class="attachment-icon">${renderIcon(isLink ? 'link' : 'file')}</div>
        <div class="attachment-details">
          <div class="attachment-name">${upload.filename}</div>
          <div class="attachment-meta">
            ${isLink ? (upload.url || '') : `${formatFileSize(upload.size)} • ${upload.mime_type}`}
          </div>
        </div>
      </div>
      <div>
        <button type="button" class="btn-link service-open-attachment-btn" data-upload-id="${upload.id}">
          Open
        </button>
        <button type="button" class="btn-link btn-danger service-delete-attachment-btn" data-upload-id="${upload.id}">
          ${renderIcon('trash')}
        </button>
      </div>
    `;
    attachmentsList.appendChild(item);
  });

  // Reuse existing handlers for open/delete
  attachServiceAttachmentHandlers();
}

async function saveService() {
  const serviceMode = document.querySelector('input[name="service_mode"]:checked')?.value || 'Professional';
  let diyChecklist = null;
  let diyMeta = null;
  let seacocksPosition = null;
  let futureItemsNotes = null;
  let partsReplacedNotes = null;
  let nextServiceDue = null;
  let proMeta = null;

  if (serviceMode === 'DIY') {
    diyChecklist = {};
    DIY_CHECKLIST_SECTIONS.forEach(section => {
      section.items.forEach(item => {
        const key = `${section.id}.${item.id}`;
        const inputId = `diy_${section.id}_${item.id}`;
        const el = document.getElementById(inputId);
        diyChecklist[key] = !!(el && el.checked);
      });
    });

    diyMeta = {
      engine_make_model: document.getElementById('diy_engine_make_model')?.value || '',
      engine_serial_number: document.getElementById('diy_engine_serial_number')?.value || '',
      gearbox_make_model: document.getElementById('diy_gearbox_make_model')?.value || '',
      person_carrying_out_service: document.getElementById('diy_person_carrying_out_service')?.value || ''
    };

    seacocksPosition = document.querySelector('input[name="diy_seacocks_position"]:checked')?.value || null;
    futureItemsNotes = document.getElementById('diy_future_items_notes')?.value || '';
    partsReplacedNotes = document.getElementById('diy_parts_replaced_notes')?.value || '';
    nextServiceDue = document.getElementById('diy_next_service_due')?.value || '';
  } else {
    proMeta = {
      workshop_name: document.getElementById('pro_workshop_name')?.value || '',
      mechanic_name: document.getElementById('pro_mechanic_name')?.value || '',
      invoice_number: document.getElementById('pro_invoice_number')?.value || '',
      service_description: document.getElementById('pro_service_description')?.value || ''
    };
  }

  const serviceType = document.getElementById('service_type').value || document.getElementById('service_type_custom').value;
  
  const entry = {
    id: editingId,
    date: document.getElementById('service_date').value,
    engine_id: document.getElementById('service_engine').value,
    service_type: serviceType,
    engine_hours: document.getElementById('service_hours').value ? parseFloat(document.getElementById('service_hours').value) : null,
    notes: document.getElementById('service_notes').value,
    mode: serviceMode,
    diy_checklist: diyChecklist,
    diy_meta: diyMeta,
    seacocks_position: seacocksPosition,
    future_items_notes: futureItemsNotes,
    parts_replaced_notes: partsReplacedNotes,
    next_service_due: nextServiceDue,
    pro_meta: proMeta
  };

  const payload = {
    date: entry.date,
    service_type: entry.service_type,
    notes: typeof entry.notes === 'string' && !entry.notes.startsWith('{') ? entry.notes : JSON.stringify(entry),
    cost: entry.cost,
    provider: entry.provider,
    engine_id: entry.engine_id
  };
  if (editingId && String(editingId).includes('-')) {
    await updateServiceEntry(editingId, payload);
  } else {
    await createServiceEntry(currentBoatId, payload);
  }
  document.getElementById('service-form-card').remove();
  editingId = null;
  loadServices();
}

export default {
  render,
  onMount
};

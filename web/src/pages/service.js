/**
 * Service History Page
 */

import { navigate } from '../router.js';
import { renderIcon } from '../components/icons.js';
import { createYachtHeader, createBackButton } from '../components/header.js';
import { showToast } from '../components/toast.js';
import { confirmAction } from '../components/confirmModal.js';
import { setSaveButtonLoading } from '../utils/saveButton.js';
import {
  isBoatArchived,
  getServiceEntries,
  createServiceEntry,
  updateServiceEntry,
  deleteServiceEntry,
  getEngines,
  getEngineMaintenanceSchedules,
  getSailsRiggingMaintenanceSchedules,
  getInventory,
  replaceServiceInventoryLinks
} from '../lib/dataService.js';
import { findSchedulesMatchingServiceEntry } from '../lib/engineMaintenanceScheduleDue.js';
import { offerUpdateEngineSchedulesAfterService } from '../lib/offerEngineScheduleAfterService.js';
import { canAddAnotherServiceEntry, SERVICE_HISTORY_UPGRADE_MESSAGE } from '../lib/access.js';
import { hasActiveSubscription } from '../lib/subscription.js';
import { syncCalendarNotifications } from './calendar.js';
import { showServiceHistoryLimitModal } from '../components/subscriptionUpsellModal.js';
import { currencySymbol, CURRENCIES } from '../lib/currency.js';
import {
  enginesStorage,
  engineMaintenanceScheduleStorage,
  sailsRiggingMaintenanceScheduleStorage
} from '../lib/storage.js';
import { getUploads, saveUpload, deleteUpload, openUpload, formatFileSize, getUpload, LIMITED_UPLOAD_SIZE_BYTES, LIMITED_UPLOADS_PER_ENTITY, saveLinkAttachment } from '../lib/uploads.js';
import { enableRecordCardExpand } from '../utils/recordCardExpand.js';
import { buildDueMaintenanceRows, DUE_SOON_DAYS } from '../lib/serviceDueFilter.js';
import {
  LEGACY_SAILING_SERVICE_TYPE,
  SAILING_SERVICE_TYPES,
  ENGINE_SERVICE_TYPES,
  isSailingServiceType,
  SAILING_TARGET_FIELD_BY_TYPE,
  WINCH_PRESET_OPTIONS,
  SAIL_WORKED_ON_OPTIONS,
  getSailingChecklistSectionsForType,
  formatSailingServiceDetailSummary
} from '../lib/sailingServiceEntryConfig.js';
import { inventoryItemTracksStock } from '../lib/inventoryMarine.js';

let editingId = null;
/** Snapshot of the entry being edited (for re-rendering sailing targets after type/area changes). */
let serviceFormEntrySnapshot = null;
let serviceArchived = false;
let filterEngineId = null;
let currentBoatId = null;
/** All service entries (before filter/sort) for list */
let allServiceEntries = [];
let serviceFileInput = null;
let currentServiceIdForUpload = null;
/** Engines used when building the service form; fallback for checklist when storage is empty or out of sync */
let serviceFormEngines = [];
/** Boat inventory rows for the related-inventory picker (current boat). */
let serviceFormInventoryItems = [];
/** Linked inventory usage rows by inventory item id for the open service form */
let serviceFormLinkedInventoryRowsById = new Map();

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
    id: 'drive_system_saildrive_sterndrive_pods',
    title: 'Drive system – saildrive / sterndrive / pods',
    items: [
      { id: 'drive_type_identified', label: 'Drive type confirmed (saildrive, sterndrive, pod)' },
      { id: 'drive_gear_oil_level_checked', label: 'Drive gear oil level checked' },
      { id: 'drive_gear_oil_replaced_if_due', label: 'Drive gear oil replaced if due' },
      { id: 'bellows_or_seals_inspected', label: 'Bellows / seals inspected for cracking or wear' },
      { id: 'bellows_or_seals_replaced_if_due', label: 'Bellows / seals replaced if due' },
      { id: 'drive_anodes_inspected', label: 'Drive anodes inspected' },
      { id: 'drive_anodes_replaced_if_required', label: 'Drive anodes replaced if required' },
      { id: 'propeller_and_legs_cleaned', label: 'Propeller and drive leg cleaned and inspected' }
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
    id: 'diesel_engine_specific',
    title: 'Diesel engine – specific checks',
    items: [
      { id: 'glow_plugs_checked', label: 'Glow plugs and wiring checked (if fitted)' },
      { id: 'injector_pipes_inspected', label: 'Injector pipes and leak-off lines inspected' },
      { id: 'diesel_bug_treatment_considered', label: 'Diesel bug treatment considered / applied if needed' },
      { id: 'fuel_return_lines_secure', label: 'Fuel return lines secure and leak-free' }
    ]
  },
  {
    id: 'petrol_engine_specific',
    title: 'Petrol engine – specific checks',
    items: [
      { id: 'spark_plugs_inspected_or_replaced', label: 'Spark plugs inspected or replaced' },
      { id: 'ignition_leads_and_coils_checked', label: 'Ignition leads, coils / distributor checked' },
      { id: 'flame_arrestor_cleaned', label: 'Flame arrestor / air intake flame trap cleaned' },
      { id: 'engine_space_ventilation_checked', label: 'Engine space ventilation and blower operation checked' },
      { id: 'fuel_vapour_detector_tested', label: 'Fuel vapour detector tested (if fitted)' }
    ]
  },
  {
    id: 'electric_drive_specific',
    title: 'Electric drive – specific checks',
    items: [
      { id: 'high_voltage_cabling_inspected', label: 'High-voltage cabling inspected and secured' },
      { id: 'cooling_system_for_motor_and_controller', label: 'Cooling system for motor / controller checked (if fitted)' },
      { id: 'battery_management_system_status', label: 'Battery management system status checked' },
      { id: 'isolation_switches_tested', label: 'Main isolation / emergency switches tested' },
      { id: 'no_signs_of_overheating_or_arcing', label: 'No signs of overheating or arcing at terminals' }
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

// Map service type -> which checklist sections should be shown (section IDs).
// Actual sections shown are then filtered by selected engine fuel type + drive type.
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

// Which fuel types and drive types each section applies to.
// Only sections matching the selected engine's fuel_type AND drive_type are shown.
const ALL_FUEL = ['diesel', 'petrol', 'electric'];
const ALL_DRIVE = ['shaft', 'saildrive', 'sterndrive', 'ips_pod', 'jet', 'other'];
const SECTION_APPLICABILITY = {
  engine_oil_lubrication: { fuelTypes: ['diesel', 'petrol'], driveTypes: ALL_DRIVE },
  fuel_system: { fuelTypes: ['diesel', 'petrol'], driveTypes: ALL_DRIVE },
  cooling_raw_water: { fuelTypes: ALL_FUEL, driveTypes: ALL_DRIVE },
  cooling_fresh_water: { fuelTypes: ALL_FUEL, driveTypes: ALL_DRIVE },
  belts_pulleys: { fuelTypes: ['diesel', 'petrol'], driveTypes: ALL_DRIVE },
  air_intake: { fuelTypes: ['diesel', 'petrol'], driveTypes: ALL_DRIVE },
  electrical_charging: { fuelTypes: ALL_FUEL, driveTypes: ALL_DRIVE },
  engine_mounts_alignment: { fuelTypes: ALL_FUEL, driveTypes: ALL_DRIVE },
  gearbox_transmission: { fuelTypes: ['diesel', 'petrol'], driveTypes: ['shaft', 'saildrive', 'sterndrive', 'ips_pod'] },
  shaft_seal_stern_gear: { fuelTypes: ['diesel', 'petrol'], driveTypes: ['shaft'] },
  drive_system_saildrive_sterndrive_pods: { fuelTypes: ['diesel', 'petrol'], driveTypes: ['saildrive', 'sterndrive', 'ips_pod'] },
  exhaust_system: { fuelTypes: ['diesel', 'petrol'], driveTypes: ALL_DRIVE },
  anodes_corrosion: { fuelTypes: ALL_FUEL, driveTypes: ALL_DRIVE },
  diesel_engine_specific: { fuelTypes: ['diesel'], driveTypes: ALL_DRIVE },
  petrol_engine_specific: { fuelTypes: ['petrol'], driveTypes: ALL_DRIVE },
  electric_drive_specific: { fuelTypes: ['electric'], driveTypes: ALL_DRIVE },
  controls_safety: { fuelTypes: ALL_FUEL, driveTypes: ALL_DRIVE },
  engine_run_operational: { fuelTypes: ['diesel', 'petrol'], driveTypes: ALL_DRIVE },
  sea_trial: { fuelTypes: ALL_FUEL, driveTypes: ALL_DRIVE },
  final_checks: { fuelTypes: ALL_FUEL, driveTypes: ALL_DRIVE },
  service_notes_advisories: { fuelTypes: ALL_FUEL, driveTypes: ALL_DRIVE }
};

function normaliseFuelType(value) {
  if (!value || typeof value !== 'string') return '';
  const v = value.toLowerCase().replace('gasoline', 'petrol').trim();
  if (v === 'diesel' || v === 'petrol' || v === 'electric') return v;
  return v;
}

function normaliseDriveType(value) {
  if (!value || typeof value !== 'string') return '';
  const v = value.toLowerCase().trim();
  if (v === 'shaft' || v === 'saildrive' || v === 'sterndrive' || v === 'ips_pod' || v === 'jet' || v === 'other') return v;
  if (v === 'pod') return 'ips_pod';
  if (v.includes('shaft')) return 'shaft';
  if (v.includes('sail')) return 'saildrive';
  if (v.includes('stern')) return 'sterndrive';
  if (v.includes('pod') || v.includes('ips')) return 'ips_pod';
  if (v.includes('jet')) return 'jet';
  return v;
}

function formatFuelTypeForDisplay(canonicalValue) {
  if (!canonicalValue) return '';
  switch (String(canonicalValue).toLowerCase()) {
    case 'diesel': return 'Diesel';
    case 'petrol': return 'Petrol';
    case 'electric': return 'Electric';
    default: return canonicalValue;
  }
}

function formatDriveTypeForDisplay(canonicalValue) {
  if (!canonicalValue) return '';
  switch (String(canonicalValue).toLowerCase()) {
    case 'shaft': return 'Shaft Drive';
    case 'saildrive': return 'Saildrive';
    case 'sterndrive': return 'Sterndrive';
    case 'ips_pod': return 'IPS Pod / Pod Drive';
    case 'jet': return 'Jet Drive';
    case 'other': return 'Other';
    default: return canonicalValue;
  }
}

function sectionAppliesToEngine(sectionId, engine) {
  const app = SECTION_APPLICABILITY[sectionId];
  if (!app) return true;

  const fuel = normaliseFuelType(engine?.fuel_type);
  const drive = normaliseDriveType(engine?.drive_type);

  const fuelMatch = fuel ? app.fuelTypes.includes(fuel) : (app.fuelTypes.length === ALL_FUEL.length);
  const driveMatch = drive ? app.driveTypes.includes(drive) : (app.driveTypes.length === ALL_DRIVE.length);

  return fuelMatch && driveMatch;
}

function reminderLeadLabel(minutes) {
  const m = Number(minutes);
  if (!m || m <= 0) return '';
  if (m === 5) return '5 minutes before';
  if (m === 15) return '15 minutes before';
  if (m === 30) return '30 minutes before';
  if (m === 60) return '1 hour before';
  if (m === 120) return '2 hours before';
  if (m === 1440) return '1 day before';
  if (m === 2880) return '2 days before';
  if (m === 10080) return '1 week before';
  return `${m} minutes before`;
}

/** True when "Sail & rigging (boat-level)" is selected — no engine applies. */
function isBoatLevelServiceAreaFromForm() {
  const el = document.getElementById('service_engine');
  return !(el?.value || '').toString().trim();
}

function escapeOptionLabel(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function getSailingTargetModeForType(type) {
  return SAILING_TARGET_FIELD_BY_TYPE[type] || 'none';
}

/**
 * Rebuild service type <select> for engine vs boat-level rigging.
 */
function syncServiceTypeDropdown() {
  const sel = document.getElementById('service_type');
  const customEl = document.getElementById('service_type_custom');
  if (!sel) return;

  const prevEffective =
    (sel.value || '').trim() || (customEl?.value || '').trim();
  const boatLevel = isBoatLevelServiceAreaFromForm();
  const tierTypes = boatLevel
    ? [...SAILING_SERVICE_TYPES, LEGACY_SAILING_SERVICE_TYPE, 'Other']
    : [...ENGINE_SERVICE_TYPES];

  sel.innerHTML =
    '<option value="">Select...</option>' +
    tierTypes.map((t) => `<option value="${escapeOptionLabel(t)}">${escapeOptionLabel(t)}</option>`).join('');

  if (prevEffective && tierTypes.includes(prevEffective)) {
    sel.value = prevEffective;
    if (customEl) customEl.value = '';
  } else if (!boatLevel && prevEffective && isSailingServiceType(prevEffective)) {
    sel.value = 'Other';
    if (customEl) customEl.value = prevEffective;
  } else if (boatLevel && prevEffective && !isSailingServiceType(prevEffective) && prevEffective !== 'Other') {
    sel.value = '';
    if (customEl) customEl.value = '';
  } else if (prevEffective === 'Other' && customEl?.value) {
    sel.value = 'Other';
  } else {
    sel.value = '';
  }
}

function restoreServiceTypeFromEntry(entry) {
  if (!entry?.service_type) return;
  const sel = document.getElementById('service_type');
  const cust = document.getElementById('service_type_custom');
  if (!sel) return;
  const boatLevel = isBoatLevelServiceAreaFromForm();
  const tier = boatLevel
    ? [...SAILING_SERVICE_TYPES, LEGACY_SAILING_SERVICE_TYPE, 'Other']
    : [...ENGINE_SERVICE_TYPES];
  if (tier.includes(entry.service_type)) {
    sel.value = entry.service_type;
    if (cust) cust.value = '';
  } else {
    sel.value = 'Other';
    if (cust) cust.value = entry.service_type;
  }
}

function sailingWinchRowHtml(value = '') {
  const presetValues = WINCH_PRESET_OPTIONS.map((o) => o.value).filter((v) => v && v !== '__custom__');
  const isPreset = value && presetValues.includes(value);
  const selectValue = isPreset ? value : value ? '__custom__' : '';
  const customVal = !isPreset && value ? value : '';
  const showCustom = selectValue === '__custom__' || (!!customVal && !isPreset);

  const opts = WINCH_PRESET_OPTIONS.map((o) => {
    const sel = o.value === selectValue ? ' selected' : '';
    return `<option value="${escapeOptionLabel(o.value)}"${sel}>${escapeOptionLabel(o.label)}</option>`;
  }).join('');

  return `
    <div class="sailing-winch-row form-row" style="align-items: flex-end; gap: 0.5rem; margin-bottom: 0.5rem;">
      <div class="form-group" style="flex: 1; margin-bottom: 0;">
        <label class="text-muted" style="font-size: 0.85rem;">Winch</label>
        <select class="form-control sailing-winch-select">
          ${opts}
        </select>
      </div>
      <div class="form-group sailing-winch-custom-wrap" style="flex: 1; margin-bottom: 0;${showCustom ? '' : ' display: none;'}">
        <label class="text-muted" style="font-size: 0.85rem;">Custom label</label>
        <input type="text" class="form-control sailing-winch-custom" placeholder="e.g. Mid-boom winch" value="${escapeOptionLabel(customVal)}">
      </div>
      <button type="button" class="btn-link btn-danger sailing-winch-remove" style="margin-bottom: 0.25rem;" title="Remove">×</button>
    </div>
  `;
}

function sailingRiggingRowHtml(value = '') {
  return `
    <div class="sailing-rigging-row form-row" style="gap: 0.5rem; margin-bottom: 0.5rem; align-items: center;">
      <input type="text" class="form-control sailing-rigging-input" placeholder="e.g. Main halyard, Forestay" value="${escapeOptionLabel(value)}">
      <button type="button" class="btn-link btn-danger sailing-rigging-remove" title="Remove">×</button>
    </div>
  `;
}

function bindSailingTargetRowEvents(host) {
  if (!host) return;
  host.querySelectorAll('.sailing-winch-select').forEach((select) => {
    select.addEventListener('change', () => {
      const row = select.closest('.sailing-winch-row');
      const customWrap = row?.querySelector('.sailing-winch-custom-wrap');
      const customIn = row?.querySelector('.sailing-winch-custom');
      if (!customWrap || !customIn) return;
      if (select.value === '__custom__') {
        customWrap.style.display = '';
        customIn.value = '';
      } else if (select.value && !WINCH_PRESET_OPTIONS.some((o) => o.value === select.value)) {
        customWrap.style.display = '';
        customIn.value = select.value;
      } else {
        customWrap.style.display = 'none';
        customIn.value = '';
      }
    });
  });
  host.querySelectorAll('.sailing-winch-remove').forEach((btn) => {
    btn.addEventListener('click', () => {
      btn.closest('.sailing-winch-row')?.remove();
    });
  });
  host.querySelectorAll('.sailing-rigging-remove').forEach((btn) => {
    btn.addEventListener('click', () => {
      btn.closest('.sailing-rigging-row')?.remove();
    });
  });
}

function renderSailingTargetFields(entry) {
  const host = document.getElementById('service-sailing-targets');
  if (!host) return;

  if (!isBoatLevelServiceAreaFromForm()) {
    host.hidden = true;
    host.innerHTML = '';
    return;
  }

  host.hidden = false;
  const type = getCurrentServiceTypeFromForm();
  const mode = getSailingTargetModeForType(type);
  const detail = entry?.sailing_service_detail || {};

  if (!type || mode === 'none') {
    host.innerHTML =
      '<p class="text-muted" style="margin: 0; font-size: 0.9rem;">Select a sail & rigging service type to show target fields (winch, sail, line, etc.).</p>';
    return;
  }

  if (mode === 'winches') {
    const ids = Array.isArray(detail.winch_identifiers) ? detail.winch_identifiers.filter(Boolean) : [];
    const rows = ids.length ? ids : [''];
    host.innerHTML = `
      <h4 class="sailing-targets-heading" style="margin-top: 0;">What was serviced</h4>
      <p class="text-muted" style="font-size: 0.875rem; margin-top: 0;">Record one or more winches. Use presets or type a custom label.</p>
      <div id="sailing-winch-rows">${rows.map((v) => sailingWinchRowHtml(v)).join('')}</div>
      <button type="button" class="btn-secondary" id="sailing-add-winch-row">${renderIcon('plus')} Add winch</button>
    `;
    document.getElementById('sailing-add-winch-row')?.addEventListener('click', () => {
      const wrap = document.getElementById('sailing-winch-rows');
      wrap?.insertAdjacentHTML('beforeend', sailingWinchRowHtml(''));
      bindSailingTargetRowEvents(wrap?.parentElement || host);
    });
    bindSailingTargetRowEvents(host);
    return;
  }

  if (mode === 'sail') {
    const sw = detail.sail_worked_on || '';
    const presetVals = SAIL_WORKED_ON_OPTIONS.map((o) => o.value).filter((v) => v && v !== '__custom__');
    const isPreset = sw && presetVals.includes(sw);
    const selVal = isPreset ? sw : sw ? '__custom__' : '';
    const customVal = !isPreset && sw ? sw : '';
    const opts = SAIL_WORKED_ON_OPTIONS.map((o) => {
      const sel = o.value === selVal ? ' selected' : '';
      return `<option value="${escapeOptionLabel(o.value)}"${sel}>${escapeOptionLabel(o.label)}</option>`;
    }).join('');
    host.innerHTML = `
      <h4 class="sailing-targets-heading" style="margin-top: 0;">What was serviced</h4>
      <div class="form-group">
        <label for="sailing_sail_worked_on">Sail worked on</label>
        <select id="sailing_sail_worked_on" class="form-control">${opts}</select>
      </div>
      <div class="form-group" id="sailing_sail_custom_wrap" style="${selVal === '__custom__' || customVal ? '' : 'display: none;'}">
        <label for="sailing_sail_custom">Custom sail name</label>
        <input type="text" id="sailing_sail_custom" class="form-control" value="${escapeOptionLabel(customVal)}" placeholder="e.g. Code 0">
      </div>
    `;
    document.getElementById('sailing_sail_worked_on')?.addEventListener('change', (e) => {
      const wrap = document.getElementById('sailing_sail_custom_wrap');
      if (!wrap) return;
      wrap.style.display = e.target.value === '__custom__' ? '' : 'none';
    });
    return;
  }

  if (mode === 'rigging') {
    const items = Array.isArray(detail.rigging_items) ? detail.rigging_items.filter(Boolean) : [];
    const rows = items.length ? items : [''];
    host.innerHTML = `
      <h4 class="sailing-targets-heading" style="margin-top: 0;">What was serviced</h4>
      <p class="text-muted" style="font-size: 0.875rem; margin-top: 0;">Rigging item(s) — add as many rows as needed.</p>
      <div id="sailing-rigging-rows">${rows.map((v) => sailingRiggingRowHtml(v)).join('')}</div>
      <button type="button" class="btn-secondary" id="sailing-add-rigging-row">${renderIcon('plus')} Add line / stay</button>
    `;
    document.getElementById('sailing-add-rigging-row')?.addEventListener('click', () => {
      const wrap = document.getElementById('sailing-rigging-rows');
      wrap?.insertAdjacentHTML('beforeend', sailingRiggingRowHtml(''));
      bindSailingTargetRowEvents(wrap?.parentElement || host);
    });
    bindSailingTargetRowEvents(host);
    return;
  }

  if (mode === 'component') {
    host.innerHTML = `
      <h4 class="sailing-targets-heading" style="margin-top: 0;">What was serviced</h4>
      <div class="form-group">
        <label for="sailing_component_worked">Component worked on</label>
        <input type="text" id="sailing_component_worked" class="form-control" value="${escapeOptionLabel(detail.component_worked_on || '')}" placeholder="e.g. Furler drum, Gooseneck fitting">
      </div>
      <div class="form-group">
        <label for="sailing_location_fitting">Location / fitting (optional)</label>
        <input type="text" id="sailing_location_fitting" class="form-control" value="${escapeOptionLabel(detail.location_or_fitting || '')}" placeholder="e.g. Mast base, Port side">
      </div>
    `;
    return;
  }

  if (mode === 'general') {
    host.innerHTML = `
      <h4 class="sailing-targets-heading" style="margin-top: 0;">Inspection scope (optional)</h4>
      <div class="form-group">
        <label for="sailing_inspection_scope">Area or focus</label>
        <textarea id="sailing_inspection_scope" class="form-control" rows="2" placeholder="e.g. Full rig check before passage">${escapeOptionLabel(detail.inspection_scope || '')}</textarea>
      </div>
    `;
  }
}

function collectWinchIdentifiersFromForm() {
  const rows = document.querySelectorAll('.sailing-winch-row');
  const out = [];
  rows.forEach((row) => {
    const sel = row.querySelector('.sailing-winch-select');
    const custom = row.querySelector('.sailing-winch-custom')?.value?.trim() || '';
    let v = sel?.value || '';
    if (v === '__custom__' || (v && custom)) v = custom || v;
    if (v && v !== '__custom__') out.push(v);
  });
  return out;
}

function collectRiggingItemsFromForm() {
  const inputs = document.querySelectorAll('.sailing-rigging-input');
  const out = [];
  inputs.forEach((inp) => {
    const t = inp.value?.trim();
    if (t) out.push(t);
  });
  return out;
}

function collectSailingServiceDetailFromForm() {
  if (!isBoatLevelServiceAreaFromForm()) return null;
  const type = getCurrentServiceTypeFromForm();
  const mode = getSailingTargetModeForType(type);
  if (!type || mode === 'none') return null;

  if (mode === 'winches') {
    const winch_identifiers = collectWinchIdentifiersFromForm();
    return winch_identifiers.length ? { winch_identifiers } : {};
  }
  if (mode === 'sail') {
    const sel = document.getElementById('sailing_sail_worked_on')?.value || '';
    const custom = document.getElementById('sailing_sail_custom')?.value?.trim() || '';
    const sail_worked_on = sel === '__custom__' ? custom : sel;
    return sail_worked_on ? { sail_worked_on } : {};
  }
  if (mode === 'rigging') {
    const rigging_items = collectRiggingItemsFromForm();
    return rigging_items.length ? { rigging_items } : {};
  }
  if (mode === 'component') {
    const component_worked_on = document.getElementById('sailing_component_worked')?.value?.trim() || '';
    const location_or_fitting = document.getElementById('sailing_location_fitting')?.value?.trim() || '';
    const o = {};
    if (component_worked_on) o.component_worked_on = component_worked_on;
    if (location_or_fitting) o.location_or_fitting = location_or_fitting;
    return o;
  }
  if (mode === 'general') {
    const inspection_scope = document.getElementById('sailing_inspection_scope')?.value?.trim() || '';
    return inspection_scope ? { inspection_scope } : {};
  }
  return null;
}

/**
 * Show/hide engine-only vs sail–rigging UI. Call after DOM exists and on engine/mode changes.
 */
function applyServiceFormScope() {
  const boatLevel = isBoatLevelServiceAreaFromForm();
  const diyMode = document.querySelector('input[name="service_mode"]:checked')?.value === 'DIY';

  const hoursGroup = document.getElementById('service-engine-hours-group');
  if (hoursGroup) hoursGroup.hidden = boatLevel;

  const engineOnly = document.getElementById('service-diy-engine-only');
  if (engineOnly) engineOnly.hidden = boatLevel;

  const seacocksRow = document.getElementById('service-diy-seacocks-row');
  if (seacocksRow) seacocksRow.hidden = boatLevel;

  const sailNotes = document.getElementById('service-diy-sail-notes');
  if (sailNotes) sailNotes.hidden = !boatLevel || !diyMode;

  const areaHint = document.getElementById('service-area-hint');
  if (areaHint) {
    areaHint.textContent = boatLevel
      ? 'Boat-level sail and rigging — pick a specific service type (winches, sails, rigging, etc.). Use Other only if you need a short custom label.'
      : 'Choose which engine this work applies to (e.g. port, starboard, auxiliary).';
  }

  const personLabel = document.getElementById('diy-person-label');
  if (personLabel) {
    personLabel.textContent = boatLevel
      ? 'Sailmaker / rigger / person carrying out service'
      : 'Person carrying out service';
  }

  const proMechLabel = document.getElementById('pro-mechanic-label');
  if (proMechLabel) {
    proMechLabel.textContent = boatLevel ? 'Contact / technician name' : 'Mechanic name';
  }

  const diyTitle = document.getElementById('service-diy-card-title');
  const diyIntro = document.getElementById('service-diy-card-intro');
  if (diyMode) {
    if (diyTitle) {
      diyTitle.textContent = boatLevel
        ? 'Sail & rigging inspection & service checklist'
        : 'DIY boat engine & gearbox service checklist';
    }
    if (diyIntro) {
      diyIntro.textContent = boatLevel
        ? 'Tick each item as you complete it. Use the notes fields for sail condition, repairs, and work carried out.'
        : 'Tick each item as you complete it.';
    }
  }

  renderSailingTargetFields(serviceFormEntrySnapshot);
}

function getDIYChecklistStats(entry) {
  const checklist = entry?.diy_checklist || {};
  let total = 0;
  let completed = 0;

  let sectionsToCount = [];
  if (!entry?.engine_id && entry?.service_type) {
    if (isSailingServiceType(entry.service_type)) {
      sectionsToCount = getSailingChecklistSectionsForType(entry.service_type);
    } else {
      sectionsToCount = [];
    }
  } else if (entry?.engine_id && entry?.service_type) {
    const eng = enginesStorage.getAll(currentBoatId).find((e) => e.id === entry.engine_id);
    const attrs = eng ? getEngineFuelAndDrive(eng) : { fuel_type: '', drive_type: '' };
    const engineOrAttrs = {
      fuel_type: normaliseFuelType(attrs.fuel_type),
      drive_type: normaliseDriveType(attrs.drive_type)
    };
    sectionsToCount = getActiveChecklistSectionsForServiceType(entry.service_type, engineOrAttrs);
  }

  if (!sectionsToCount.length && entry?.engine_id) sectionsToCount = DIY_CHECKLIST_SECTIONS;

  sectionsToCount.forEach((section) => {
    section.items.forEach((item) => {
      const key = `${section.id}.${item.id}`;
      total += 1;
      if (checklist[key]) completed += 1;
    });
  });

  return { total, completed };
}

function render(params = {}) {
  currentBoatId = params?.id || window.routeParams?.id;
  const entryId = params?.entryId || window.routeParams?.entryId;
  const isEditPage = !!entryId;

  if (!currentBoatId) {
    const wrapperError = document.createElement('div');
    wrapperError.innerHTML = '<div class="page-content"><div class="container"><h1>Error</h1><p>Boat ID required</p></div></div>';
    return wrapperError;
  }

  const wrapper = document.createElement('div');

  const yachtHeader = createYachtHeader(
    isEditPage ? (entryId === 'new' ? 'Add Service Entry' : 'Edit Service Entry') : 'Service History'
  );
  wrapper.appendChild(yachtHeader);

  const pageContent = document.createElement('div');
  pageContent.className = 'page-content card-color-service';
  pageContent.appendChild(createBackButton());

  const container = document.createElement('div');
  container.className = 'container';

  if (isEditPage) {
    container.id = 'service-list';
    pageContent.appendChild(container);
    wrapper.appendChild(pageContent);
    return wrapper;
  }

  const filterContainer = document.createElement('div');
  filterContainer.className = 'page-actions';
  filterContainer.id = 'service-filter';

  const freeLimitBanner = document.createElement('div');
  freeLimitBanner.id = 'service-free-limit-banner';
  freeLimitBanner.className = 'service-free-limit-banner';
  freeLimitBanner.hidden = true;

  const addBtn = document.createElement('button');
  addBtn.className = 'btn-primary';
  addBtn.id = 'service-add-btn';
  addBtn.innerHTML = `${renderIcon('plus')} Add Service Entry`;
  addBtn.onclick = () => {
    void (async () => {
      const list = currentBoatId ? await getServiceEntries(currentBoatId) : [];
      if (!canAddAnotherServiceEntry(list.length)) {
        showServiceHistoryLimitModal();
        return;
      }
      navigate(`/boat/${currentBoatId}/service/new`);
    })();
  };

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
  container.appendChild(freeLimitBanner);
  container.appendChild(addBtn);
  container.appendChild(fileInput);
  container.appendChild(listContainer);

  pageContent.appendChild(container);
  wrapper.appendChild(pageContent);

  return wrapper;
}

async function onMount(params = {}) {
  const boatId = params?.id || window.routeParams?.id;
  const entryId = params?.entryId || window.routeParams?.entryId;
  if (boatId) {
    currentBoatId = boatId;
  }

  window.navigate = navigate;

  serviceArchived = currentBoatId ? await isBoatArchived(currentBoatId) : false;

  if (entryId) {
    editingId = entryId === 'new' ? `service_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` : entryId;
    await showServiceForm();
    return;
  }

  const addBtn = document.getElementById('service-add-btn');
  if (addBtn && serviceArchived) addBtn.style.display = 'none';

  serviceFileInput = document.getElementById('service-file-input');

  loadFilters();

  const hashForQuery = window.location.hash || '';
  const qIdx = hashForQuery.indexOf('?');
  const queryPart = qIdx >= 0 ? hashForQuery.slice(qIdx + 1) : '';
  const dueParam = new URLSearchParams(queryPart).get('due');
  console.log('[BoatMatey] Service History query param due received', dueParam || '');
  if (dueParam === 'overdue' || dueParam === 'due_soon') {
    const dueSel = document.getElementById('service-due-filter');
    if (dueSel) dueSel.value = dueParam;
  }

  if (serviceFileInput) {
    serviceFileInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      if (!files.length || !currentBoatId || !currentServiceIdForUpload) return;

      const existing = getUploads('service', currentServiceIdForUpload, currentBoatId);
      const remainingSlots = LIMITED_UPLOADS_PER_ENTITY - existing.length;

      if (remainingSlots <= 0) {
        showToast(`You can only upload up to ${LIMITED_UPLOADS_PER_ENTITY} files for this service entry.`, 'error');
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
        showToast('Some files were larger than 2 MB and were skipped.', 'info');
      }

      if (!validFiles.length) {
        serviceFileInput.value = '';
        return;
      }

      const filesToUpload = validFiles.slice(0, remainingSlots);
      if (validFiles.length > remainingSlots) {
        showToast(`Only ${remainingSlots} more file(s) can be uploaded for this service entry (max ${LIMITED_UPLOADS_PER_ENTITY}).`, 'info');
      }

      for (const file of filesToUpload) {
        await saveUpload(file, 'service', currentServiceIdForUpload, currentBoatId);
      }

      serviceFileInput.value = '';
      loadServices();
    });
  }

  if (currentBoatId) {
    await Promise.all([
      getEngineMaintenanceSchedules(currentBoatId),
      getSailsRiggingMaintenanceSchedules(currentBoatId)
    ]);
  }
  loadServices();
}

function updateServiceFreeLimitUi() {
  const banner = document.getElementById('service-free-limit-banner');
  const addBtn = document.getElementById('service-add-btn');
  if (!banner || !addBtn) return;

  const atFreeLimit =
    !hasActiveSubscription() && !serviceArchived && allServiceEntries.length >= 1;

  if (atFreeLimit) {
    banner.hidden = false;
    banner.innerHTML = `
      <p class="service-free-limit-banner-message">You've reached your free limit. Upgrade to continue tracking your boat maintenance.</p>
      <button type="button" class="btn-primary service-free-limit-trial-btn">Start 1 Month Free Trial</button>
    `;
    const trialBtn = banner.querySelector('.service-free-limit-trial-btn');
    if (trialBtn) {
      trialBtn.onclick = () => navigate('/subscription');
    }
    addBtn.disabled = true;
    addBtn.setAttribute('aria-disabled', 'true');
    addBtn.title = 'Upgrade to add more service entries';
  } else {
    banner.hidden = true;
    banner.innerHTML = '';
    addBtn.disabled = false;
    addBtn.removeAttribute('aria-disabled');
    addBtn.removeAttribute('title');
  }
}

function loadFilters() {
  const filterContainer = document.getElementById('service-filter');
  const engines = enginesStorage.getAll(currentBoatId);
  filterContainer.className = 'page-actions list-tools';
  filterContainer.innerHTML = `
    <input type="search" id="service-search" class="form-control" placeholder="Search entries..." aria-label="Search service entries">
    <select id="engine-filter" class="form-control" style="max-width: 220px;" aria-label="Filter by service area">
      <option value="">All service areas</option>
      <option value="__boat_level__">Sail & rigging (boat-level)</option>
      ${engines.map(e => `<option value="${e.id}">${e.label || 'Unnamed'}</option>`).join('')}
    </select>
    <select id="service-due-filter" class="form-control" aria-label="Filter by next due date" style="max-width: 200px;">
      <option value="">All entries</option>
      <option value="overdue">Overdue (next due)</option>
      <option value="due_soon">Due in 30 days</option>
    </select>
    <select id="service-sort" class="form-control" aria-label="Sort entries">
      <option value="newest">Newest first</option>
      <option value="oldest">Oldest first</option>
    </select>
  `;

  document.getElementById('engine-filter').addEventListener('change', (e) => {
    filterEngineId = e.target.value || null;
    loadServices();
  });
  document.getElementById('service-due-filter').addEventListener('change', () => loadServices());
  document.getElementById('service-search').addEventListener('input', () => loadServices());
  document.getElementById('service-sort').addEventListener('change', () => loadServices());
}

async function loadServices() {
  const listContainer = document.getElementById('service-list');
  allServiceEntries = currentBoatId ? await getServiceEntries(currentBoatId) : [];
  const q = (document.getElementById('service-search')?.value || '').trim().toLowerCase();
  const sortVal = document.getElementById('service-sort')?.value || 'newest';
  const dueFilter = document.getElementById('service-due-filter')?.value || '';
  const engines = currentBoatId ? await getEngines(currentBoatId) : [];
  const dueRowsAll = currentBoatId
    ? buildDueMaintenanceRows({
        boatId: currentBoatId,
        serviceEntries: allServiceEntries,
        engineSchedules: engineMaintenanceScheduleStorage.getAll(currentBoatId),
        sailsSchedules: sailsRiggingMaintenanceScheduleStorage.getAll(currentBoatId),
        engines
      })
    : [];
  const dueRowsFiltered = dueRowsAll.filter((row) => {
    if (dueFilter && row.status !== dueFilter) return false;
    if (filterEngineId === '__boat_level__') {
      if (row.engineId) return false;
    } else if (filterEngineId && row.engineId !== filterEngineId) return false;
    if (!q) return true;
    const blob = `${row.label || ''} ${row.kind || ''} ${row.dateStr || ''}`.toLowerCase();
    return blob.includes(q);
  });

  if (dueFilter === 'overdue' || dueFilter === 'due_soon') {
    console.log(
      '[BoatMatey] Service History filtered items ids/types/dates',
      dueRowsFiltered.map((row) => ({
        id: row.id || row.sourceId || null,
        type: row.kind || 'unknown',
        status: row.status,
        date: row.dateStr || null,
        label: row.label || ''
      }))
    );
    if (dueRowsFiltered.length === 0) {
      listContainer.innerHTML = allServiceEntries.length === 0
        ? `
      <div class="empty-state">
        <div class="empty-state-icon">${renderIcon('wrench')}</div>
        <p>No service entries yet</p>
        ${!serviceArchived ? `<div class="empty-state-actions"><button type="button" class="btn-primary" onclick="event.preventDefault(); window.servicePageTryAdd()">${renderIcon('plus')} Add Service Entry</button></div>` : ''}
      </div>
    `
        : (dueFilter === 'overdue'
          ? '<p class="text-muted">No maintenance items are currently overdue.</p>'
          : `<p class="text-muted">No maintenance items are due in the next ${DUE_SOON_DAYS} days.</p>`);
      attachHandlers();
      updateServiceFreeLimitUi();
      return;
    }

    listContainer.innerHTML = dueRowsFiltered
      .map((row) => `
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">${new Date((row.dateStr || '') + 'T12:00:00').toLocaleDateString()}</h3>
            <p class="text-muted">${row.status === 'overdue' ? 'Overdue' : 'Due in 30 days'} • ${escapeOptionLabel(row.kind || '')}</p>
          </div>
        </div>
        <div>
          <p><strong>${escapeOptionLabel(row.label || '')}</strong></p>
          <p class="text-muted"><strong>Due date:</strong> ${new Date((row.dateStr || '') + 'T12:00:00').toLocaleDateString()}</p>
          <button type="button" class="btn-link" onclick="event.preventDefault(); window.navigate('${row.path}')">Open item</button>
        </div>
      </div>
    `)
      .join('');
    attachHandlers();
    updateServiceFreeLimitUi();
    return;
  }

  let services = allServiceEntries.filter((s) => {
    if (filterEngineId === '__boat_level__') {
      if (s.engine_id) return false;
    } else if (filterEngineId && s.engine_id !== filterEngineId) return false;
    if (!q) return true;
    const dateStr = s.date ? new Date(s.date).toLocaleDateString().toLowerCase() : '';
    const type = (s.service_type || '').toLowerCase();
    const notes = (s.notes || '').toLowerCase();
    return dateStr.includes(q) || type.includes(q) || notes.includes(q);
  });
  services = [...services].sort((a, b) => {
    const dateA = a.date ? new Date(a.date).getTime() : 0;
    const dateB = b.date ? new Date(b.date).getTime() : 0;
    return sortVal === 'newest' ? dateB - dateA : dateA - dateB;
  });

  if (services.length === 0) {
    listContainer.innerHTML = allServiceEntries.length === 0
      ? `
      <div class="empty-state">
        <div class="empty-state-icon">${renderIcon('wrench')}</div>
        <p>No service entries yet</p>
        ${!serviceArchived ? `<div class="empty-state-actions"><button type="button" class="btn-primary" onclick="event.preventDefault(); window.servicePageTryAdd()">${renderIcon('plus')} Add Service Entry</button></div>` : ''}
      </div>
    `
      : `<p class="text-muted">No service entries match your filters.</p>`;
    attachHandlers();
    updateServiceFreeLimitUi();
    return;
  }

  const getEngineLabel = (id) => {
    if (id == null || id === '') return 'Sail & rigging (boat-level)';
    const engine = engines.find(e => e.id === id);
    return engine ? engine.label : 'Unknown engine';
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
        const checklistLabel =
          !service.engine_id && isSailingServiceType(service.service_type)
            ? 'Sail & rigging checklist'
            : 'Engine DIY checklist';
        diySummary = `<p class="text-muted">${checklistLabel}: ${stats.completed}/${stats.total} items ticked</p>`;
      }
    }

    const sailingExtra = formatSailingServiceDetailSummary(service.sailing_service_detail);
    const sailingExtraHtml = sailingExtra
      ? `<p class="text-muted"><strong>Details:</strong> ${escapeOptionLabel(sailingExtra)}</p>`
      : '';

    const invItems = service.linked_inventory_items;
    const invLinkedHtml =
      Array.isArray(invItems) && invItems.length
        ? `<p class="text-muted"><strong>Related inventory:</strong> ${invItems
            .map((it) => escapeOptionLabel(it.name || 'Item'))
            .join(', ')}</p>`
        : '';

    return `
    <div class="card">
      <div class="card-header">
        <div>
          <h3 class="card-title">${new Date(service.date).toLocaleDateString()}</h3>
          <p class="text-muted">${enginesLabel} • ${service.service_type || 'Service'} • ${modeLabel}</p>
        </div>
        <div>
          ${!serviceArchived ? `<a href="#/boat/${currentBoatId}/service/${service.id}" class="btn-link" onclick="event.preventDefault(); window.navigate('/boat/${currentBoatId}/service/${service.id}')">${renderIcon('edit')}</a>
          <button class="btn-link btn-danger" onclick="servicePageDelete('${service.id}')">${renderIcon('trash')}</button>` : ''}
        </div>
      </div>
      <div>
        ${service.engine_id && service.engine_hours != null ? `<p><strong>Engine hours:</strong> ${service.engine_hours}</p>` : ''}
        ${service.cost != null ? `<p><strong>Cost:</strong> ${currencySymbol(service.cost_currency)}${Number(service.cost).toFixed(2)}</p>` : ''}
        ${sailingExtraHtml}
        ${invLinkedHtml}
        ${diySummary}
        ${service.notes ? `<p><strong>Notes:</strong> ${service.notes}</p>` : ''}
        ${service.next_service_due && service.next_service_reminder_minutes > 0 ? `<p class="service-entry-reminder text-muted"><strong>Reminder:</strong> Next due ${new Date(service.next_service_due + 'T12:00:00').toLocaleDateString()} · ${reminderLeadLabel(service.next_service_reminder_minutes)}</p>` : service.next_service_due ? `<p class="text-muted"><strong>Next due:</strong> ${new Date(service.next_service_due + 'T12:00:00').toLocaleDateString()}</p>` : ''}
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

  enableRecordCardExpand(listContainer);
  attachHandlers();
  loadServiceAttachments(services);
  updateServiceFreeLimitUi();
}

function attachHandlers() {
  window.servicePageTryAdd = async () => {
    const list = currentBoatId ? await getServiceEntries(currentBoatId) : [];
    if (!canAddAnotherServiceEntry(list.length)) {
      showServiceHistoryLimitModal();
      return;
    }
    navigate(`/boat/${currentBoatId}/service/new`);
  };

  window.servicePageDelete = async (id) => {
    const ok = await confirmAction({ title: 'Delete this service entry?', message: 'This cannot be undone.', confirmLabel: 'Delete', cancelLabel: 'Cancel', danger: true });
    if (!ok) return;
    const deleted = await deleteServiceEntry(id);
    if (!deleted) {
      showToast('Could not delete service entry. Try again or check your connection.', 'error');
      return;
    }
    await loadServices();
    showToast('Service entry removed', 'info');
    try {
      await syncCalendarNotifications();
    } catch (e) {
      console.warn('[BoatMatey] Reminder notification sync failed:', e);
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
    btn.addEventListener('click', async () => {
      const uploadId = btn.dataset.uploadId;
      const ok = await confirmAction({ title: 'Delete this attachment?', message: 'This cannot be undone.', confirmLabel: 'Delete', cancelLabel: 'Cancel', danger: true });
      if (!ok) return;
      await deleteUpload(uploadId);
      loadServices();
      showToast('Attachment removed', 'info');
    });
  });
}

const INV_CAT_SAILING_PRIORITY = new Set([
  'Sails',
  'Winches',
  'Running Rigging',
  'Standing Rigging',
  'Deck Hardware'
]);
const INV_CAT_ENGINE_PRIORITY = new Set([
  'Spare Parts',
  'Consumables',
  'Engine',
  'Spares',
  'Electrical',
  'Plumbing'
]);

function getServiceInventoryPickerContext() {
  const engineRaw = document.getElementById('service_engine')?.value?.trim();
  return engineRaw ? 'engine' : 'sailing';
}

function sortInventoryForServicePicker(items, context) {
  const priority = context === 'sailing' ? INV_CAT_SAILING_PRIORITY : INV_CAT_ENGINE_PRIORITY;
  return [...items].sort((a, b) => {
    const ap = priority.has(a.category) ? 0 : 1;
    const bp = priority.has(b.category) ? 0 : 1;
    if (ap !== bp) return ap - bp;
    return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
  });
}

function makeDefaultServiceInventoryLinkRow(item) {
  const stockTracked = inventoryItemTracksStock(item);
  return {
    inventory_item_id: item?.id,
    quantity_used: stockTracked ? 1 : null,
    affects_stock: stockTracked
  };
}

function syncServiceLinkedRowsToHidden() {
  const el = document.getElementById('service-linked-inventory-json');
  if (!el) return;
  const rows = [...serviceFormLinkedInventoryRowsById.values()].map((r) => ({
    inventory_item_id: r.inventory_item_id,
    quantity_used:
      r.quantity_used == null || r.quantity_used === '' ? null : Number(r.quantity_used),
    affects_stock: !!r.affects_stock
  }));
  el.value = JSON.stringify(rows);
}

function renderServiceRelatedInventoryRows() {
  const host = document.getElementById('service-related-inventory-chips');
  if (!host) return;
  const byId = new Map(serviceFormInventoryItems.map((i) => [i.id, i]));
  const rows = [...serviceFormLinkedInventoryRowsById.values()];
  if (!rows.length) {
    host.innerHTML = '<p class="text-muted" style="margin:0;font-size:0.9rem;">None selected.</p>';
    return;
  }
  host.innerHTML = rows
    .map((row) => {
      const item = byId.get(row.inventory_item_id);
      const stockTracked = item ? inventoryItemTracksStock(item) : !!row.affects_stock;
      const name = item?.name || 'Item';
      const sub = [item?.category, item?.location].filter(Boolean).join(' · ');
      return `
      <div class="service-inv-link-row" data-inv-id="${escapeOptionLabel(row.inventory_item_id)}">
        <div class="service-inv-link-main">
          <strong>${escapeOptionLabel(name)}</strong>
          ${sub ? `<span class="text-muted"> · ${escapeOptionLabel(sub)}</span>` : ''}
        </div>
        ${
          stockTracked
            ? `<div class="service-inv-link-usage">
                <label>Qty used
                  <input type="number" min="0.01" step="any" class="form-control service-inv-qty" data-inv-id="${escapeOptionLabel(row.inventory_item_id)}" value="${row.quantity_used ?? 1}">
                </label>
                <label class="checkbox-row" style="margin:0;">
                  <input type="checkbox" class="service-inv-affects" data-inv-id="${escapeOptionLabel(row.inventory_item_id)}" ${row.affects_stock ? 'checked' : ''}>
                  <span>Reduce stock</span>
                </label>
              </div>`
            : `<p class="text-muted" style="margin:0.25rem 0 0;font-size:0.85rem;">Asset / non-stock: linked for service history only.</p>`
        }
        <button type="button" class="btn-link btn-danger service-inv-chip-remove" data-inv-id="${escapeOptionLabel(row.inventory_item_id)}" title="Remove">Remove</button>
      </div>`;
    })
    .join('');

  host.querySelectorAll('.service-inv-chip-remove').forEach((btn) => {
    btn.addEventListener('click', (ev) => {
      ev.preventDefault();
      const rid = btn.getAttribute('data-inv-id');
      if (!rid) return;
      serviceFormLinkedInventoryRowsById.delete(rid);
      syncServiceLinkedRowsToHidden();
      renderServiceRelatedInventoryRows();
    });
  });
  host.querySelectorAll('.service-inv-qty').forEach((input) => {
    input.addEventListener('input', () => {
      const rid = input.getAttribute('data-inv-id');
      if (!rid || !serviceFormLinkedInventoryRowsById.has(rid)) return;
      const current = serviceFormLinkedInventoryRowsById.get(rid);
      serviceFormLinkedInventoryRowsById.set(rid, {
        ...current,
        quantity_used: input.value
      });
      syncServiceLinkedRowsToHidden();
    });
  });
  host.querySelectorAll('.service-inv-affects').forEach((cb) => {
    cb.addEventListener('change', () => {
      const rid = cb.getAttribute('data-inv-id');
      if (!rid || !serviceFormLinkedInventoryRowsById.has(rid)) return;
      const current = serviceFormLinkedInventoryRowsById.get(rid);
      serviceFormLinkedInventoryRowsById.set(rid, {
        ...current,
        affects_stock: !!cb.checked
      });
      syncServiceLinkedRowsToHidden();
    });
  });
}

function openServiceInventoryPickerModal() {
  const overlay = document.getElementById('service-inventory-picker-overlay');
  if (!overlay) return;
  const ctx = getServiceInventoryPickerContext();
  const sorted = sortInventoryForServicePicker(serviceFormInventoryItems, ctx);
  const searchEl = document.getElementById('service-inventory-picker-search');
  const listEl = document.getElementById('service-inventory-picker-list');

  function renderList(filterQ) {
    if (!listEl) return;
    const q = (filterQ || '').trim().toLowerCase();
    const rows = !q
      ? sorted
      : sorted.filter((it) => {
          const blob = `${it.name || ''} ${it.category || ''} ${it.part_number || ''} ${it.location || ''}`.toLowerCase();
          return blob.includes(q);
        });
    if (!rows.length) {
      listEl.innerHTML = q
        ? '<p class="text-muted" style="margin:0;">No items match.</p>'
        : '<p class="text-muted" style="margin:0;">No inventory items for this boat yet. Add them from Inventory.</p>';
      return;
    }
    listEl.innerHTML = rows
      .map((it) => {
        const checked = serviceFormLinkedInventoryRowsById.has(it.id) ? 'checked' : '';
        const sub = [it.category, it.location].filter(Boolean).join(' · ');
        return `
          <label class="checkbox-row service-inv-picker-row" style="display:flex;align-items:flex-start;gap:0.5rem;">
            <input type="checkbox" class="service-inv-picker-cb" data-inv-id="${escapeOptionLabel(it.id)}" ${checked}>
            <span><strong>${escapeOptionLabel(it.name || 'Unnamed')}</strong>${sub ? `<br><span class="text-muted" style="font-size:0.85rem;">${escapeOptionLabel(sub)}</span>` : ''}</span>
          </label>`;
      })
      .join('');
    listEl.querySelectorAll('.service-inv-picker-cb').forEach((cb) => {
      cb.addEventListener('change', () => {
        const id = cb.getAttribute('data-inv-id');
        if (!id) return;
        if (cb.checked) {
          if (!serviceFormLinkedInventoryRowsById.has(id)) {
            serviceFormLinkedInventoryRowsById.set(id, makeDefaultServiceInventoryLinkRow(it));
          }
        } else {
          serviceFormLinkedInventoryRowsById.delete(id);
        }
      });
    });
  }

  if (searchEl) searchEl.value = '';
  renderList('');
  if (searchEl) {
    searchEl.oninput = () => renderList(searchEl.value);
  }

  overlay.hidden = false;
  overlay.classList.add('confirm-modal-visible');
  overlay.setAttribute('aria-hidden', 'false');

  const close = () => {
    overlay.hidden = true;
    overlay.classList.remove('confirm-modal-visible');
    overlay.setAttribute('aria-hidden', 'true');
    syncServiceLinkedRowsToHidden();
    renderServiceRelatedInventoryRows();
    overlay.onclick = null;
  };

  const doneBtn = document.getElementById('service-inventory-picker-done');
  const cancelBtn = document.getElementById('service-inventory-picker-cancel');
  if (doneBtn) doneBtn.onclick = () => close();
  if (cancelBtn) cancelBtn.onclick = () => close();
  overlay.onclick = (ev) => {
    if (ev.target === overlay) close();
  };
}

function initServiceRelatedInventorySection(entry) {
  const rows = Array.isArray(entry?.linked_inventory_links) && entry.linked_inventory_links.length
    ? entry.linked_inventory_links
    : Array.isArray(entry?.linked_inventory_item_ids)
      ? entry.linked_inventory_item_ids.map((id) => ({
        inventory_item_id: id,
        quantity_used: null,
        affects_stock: false
      }))
      : [];
  serviceFormLinkedInventoryRowsById = new Map(
    rows
      .filter((r) => r?.inventory_item_id)
      .map((r) => [
        r.inventory_item_id,
        {
          inventory_item_id: r.inventory_item_id,
          quantity_used: r.quantity_used ?? null,
          affects_stock: !!r.affects_stock
        }
      ])
  );
  // Ensure selected rows have defaults consistent with each item's stock behavior.
  for (const [id, row] of serviceFormLinkedInventoryRowsById.entries()) {
    const item = serviceFormInventoryItems.find((x) => x.id === id);
    const stockTracked = inventoryItemTracksStock(item);
    serviceFormLinkedInventoryRowsById.set(id, {
      inventory_item_id: id,
      quantity_used: stockTracked ? (row.quantity_used ?? 1) : null,
      affects_stock: stockTracked ? (typeof row.affects_stock === 'boolean' ? row.affects_stock : true) : false
    });
  }
  syncServiceLinkedRowsToHidden();
  renderServiceRelatedInventoryRows();

  document.getElementById('service-related-inventory-add')?.addEventListener('click', (e) => {
    e.preventDefault();
    openServiceInventoryPickerModal();
  });
}

async function showServiceForm() {
  if (document.getElementById('service-form-card')) return;
  const services = currentBoatId ? await getServiceEntries(currentBoatId) : [];
  const routeEntryId = window.routeParams?.entryId;
  if (routeEntryId === 'new' && !canAddAnotherServiceEntry(services.length)) {
    showServiceHistoryLimitModal();
    navigate(`/boat/${currentBoatId}/service`);
    return;
  }
  const existingEntry = editingId ? services.find((s) => s.id === editingId) : null;
  if (!editingId) {
    editingId = `service_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  const entry = existingEntry;
  serviceFormEntrySnapshot = entry || null;
  const isNewFreeTierEntry = !existingEntry && !hasActiveSubscription();
  const mode = entry?.mode || 'Professional';
  const engines = currentBoatId ? await getEngines(currentBoatId) : [];
  serviceFormEngines = engines;

  const selectedEngine = entry?.engine_id ? engines.find(e => e.id === entry.engine_id) : null;

  const formHtml = `
    <div class="card" id="service-form-card">
      <h3>${editingId ? 'Edit Service Entry' : 'Add Service Entry'}</h3>
      <form id="service-form">
        <div class="form-group">
          <label>Service carried out by</label>
          <div class="radio-option-row">
            <label class="inline-choice">
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
          <label for="service_engine">Service area</label>
          <select id="service_engine" aria-label="Service area">
            <option value="" data-fuel-type="" data-drive-type="" ${entry && !entry.engine_id ? ' selected' : ''}>Sail & rigging (boat-level)</option>
            ${engines.map(e => {
              const attrs = getEngineFuelAndDrive(e);
              const fuel = normaliseFuelType(attrs.fuel_type);
              const drive = normaliseDriveType(attrs.drive_type);
              const sel = entry?.engine_id === e.id ? ' selected' : '';
              const label = (e.label || 'Unnamed').replace(/&/g, '&amp;').replace(/</g, '&lt;');
              return `<option value="${String(e.id)}" data-fuel-type="${(fuel || '').replace(/"/g, '&quot;')}" data-drive-type="${(drive || '').replace(/"/g, '&quot;')}"${sel}>${label}</option>`;
            }).join('')}
          </select>
          <p class="text-muted" id="service-area-hint" style="margin-top: 0.25rem; font-size: 0.875rem;"></p>
        </div>
        <div class="form-group">
          <label for="service_type">Service type${isNewFreeTierEntry ? ' *' : ''}</label>
          <select id="service_type" ${isNewFreeTierEntry ? 'required' : ''}>
            <option value="">Select...</option>
          </select>
          <input type="text" id="service_type_custom" placeholder="Or enter custom type" value="" style="margin-top: 0.5rem;">
        </div>
        <div id="service-sailing-targets" class="card" style="margin-top: 1rem; padding: var(--spacing-md);" hidden></div>
        <div class="form-group" id="service-engine-hours-group">
          <label for="service_hours">Engine hours (meter)</label>
          <input type="number" id="service_hours" step="0.1" value="${entry?.engine_hours || ''}">
        </div>
        <div class="card" id="service-diy-card" style="margin-top: 1rem; ${mode === 'DIY' ? 'display: block;' : 'display: none;'}">
          <h4 id="service-diy-card-title">DIY boat engine & gearbox service checklist</h4>
          <p class="text-muted" id="service-diy-card-intro">Tick each item as you complete it.</p>
          <div id="service-diy-engine-only">
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
            <div class="form-group" id="service-engine-fuel-drive-wrap">
              <p id="service-engine-fuel-drive-display" class="text-muted" style="margin-top: 0.25rem; margin-bottom: 0;">Select an engine under Service area to see fuel type and drive type. The checklist below is filtered by these.</p>
            </div>
          </div>
          <div class="form-group">
            <label for="diy_person_carrying_out_service" id="diy-person-label">Person carrying out service</label>
            <input type="text" id="diy_person_carrying_out_service" value="${entry?.diy_meta?.person_carrying_out_service || ''}">
          </div>
          <div class="form-group" id="service-diy-sail-notes" hidden>
            <label for="diy_sail_condition_notes">Sail condition notes</label>
            <textarea id="diy_sail_condition_notes" rows="2">${entry?.diy_meta?.sail_condition_notes || ''}</textarea>
            <label for="diy_sails_repairs_required" style="margin-top: 0.75rem;">Any repairs required</label>
            <textarea id="diy_sails_repairs_required" rows="2">${entry?.diy_meta?.sails_repairs_required || ''}</textarea>
            <label for="diy_sails_work_carried_out" style="margin-top: 0.75rem;">Work carried out (rigging)</label>
            <textarea id="diy_sails_work_carried_out" rows="2">${entry?.diy_meta?.sails_work_carried_out || ''}</textarea>
          </div>

          <div id="service-diy-checklist"></div>

          <div class="form-group" id="service-diy-seacocks-row" style="margin-top: 1rem;">
            <label>Seacocks left in correct position</label>
            <div class="radio-option-row">
              <label class="inline-choice">
                <input type="radio" name="diy_seacocks_position" value="Open" ${entry?.seacocks_position === 'Open' ? 'checked' : ''}>
                Open
              </label>
              <label class="inline-choice">
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
        </div>

        <div class="card" id="service-pro-card" style="margin-top: 1rem; ${mode === 'DIY' ? 'display: none;' : 'display: block;'}">
          <h4 id="service-pro-card-title">Professional service details</h4>
          <div class="form-group">
            <label for="pro_workshop_name">Workshop / company / rigger</label>
            <input type="text" id="pro_workshop_name" value="${entry?.pro_meta?.workshop_name || ''}">
          </div>
          <div class="form-group">
            <label for="pro_mechanic_name" id="pro-mechanic-label">Mechanic name</label>
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

        <div class="form-section" style="margin-top: 1rem;">
          <h4>Cost (optional)</h4>
          <div class="form-row">
            <div class="form-group">
              <label for="service_cost">Cost</label>
              <input type="number" id="service_cost" step="0.01" min="0" placeholder="0.00" value="${typeof entry?.cost === 'number' ? entry.cost : ''}">
            </div>
            <div class="form-group">
              <label for="service_cost_currency">Currency</label>
              <select id="service_cost_currency">
                ${CURRENCIES.map((c) => `<option value="${c.code}" ${(entry?.cost_currency || 'GBP') === c.code ? 'selected' : ''}>${c.label}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label for="service_notes">Notes</label>
          <textarea id="service_notes" rows="4">${entry?.notes || ''}</textarea>
        </div>
        <div class="card" id="service-related-inventory-card" style="margin-top: 1rem;">
          <h4>Related inventory items</h4>
          <p class="text-muted" style="font-size: 0.875rem; margin-top: 0;">Optional — link gear or parts from Inventory. Stock-tracked items can record quantity used and reduce stock.</p>
          <div id="service-related-inventory-chips" class="service-related-inventory-chips"></div>
          <input type="hidden" id="service-linked-inventory-json" value="">
          <button type="button" class="btn-secondary" id="service-related-inventory-add">${renderIcon('plus')} Add or change…</button>
        </div>
        <div class="card" id="service-next-due-card" style="margin-top: 1rem;">
          <h4>Next service due${isNewFreeTierEntry ? '' : ' (optional)'}</h4>
          <p class="text-muted" style="font-size: 0.875rem;">${isNewFreeTierEntry ? 'Set a due date to create your free reminder (1 day before by default). Full Calendar is a Premium feature.' : `Set a due date to get a reminder on this device before it is due.${!hasActiveSubscription() ? ' Full Calendar &amp; Alerts is a Premium feature.' : ''}`}</p>
          <div class="form-group">
            <label for="service_next_due_shared">Next due date${isNewFreeTierEntry ? ' *' : ''}</label>
            <input type="date" id="service_next_due_shared" value="${entry?.next_service_due || ''}" ${isNewFreeTierEntry ? 'required' : ''}>
          </div>
          <div class="form-group">
            <label for="service_next_reminder_shared">Reminder</label>
            <select id="service_next_reminder_shared">
              <option value="0" ${(entry?.next_service_reminder_minutes ?? 1440) === 0 ? 'selected' : ''}>None</option>
              <option value="5" ${entry?.next_service_reminder_minutes === 5 ? 'selected' : ''}>5 minutes before</option>
              <option value="15" ${entry?.next_service_reminder_minutes === 15 ? 'selected' : ''}>15 minutes before</option>
              <option value="30" ${entry?.next_service_reminder_minutes === 30 ? 'selected' : ''}>30 minutes before</option>
              <option value="60" ${entry?.next_service_reminder_minutes === 60 ? 'selected' : ''}>1 hour before</option>
              <option value="120" ${entry?.next_service_reminder_minutes === 120 ? 'selected' : ''}>2 hours before</option>
              <option value="1440" ${(entry?.next_service_reminder_minutes ?? 1440) === 1440 ? 'selected' : ''}>1 day before</option>
              <option value="2880" ${entry?.next_service_reminder_minutes === 2880 ? 'selected' : ''}>2 days before</option>
              <option value="10080" ${entry?.next_service_reminder_minutes === 10080 ? 'selected' : ''}>1 week before</option>
            </select>
          </div>
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

  const inventoryPickerModalHtml = `
    <div id="service-inventory-picker-overlay" class="confirm-modal-overlay" hidden aria-hidden="true" style="z-index: 1100;">
      <div class="confirm-modal" style="max-width: 420px; max-height: 88vh; display: flex; flex-direction: column;">
        <h4 class="confirm-modal-title" style="margin-top: 0;">Choose inventory items</h4>
        <p class="text-muted" style="font-size: 0.875rem;">Items on this boat only. Sail &amp; rigging services list deck and rigging categories first; engine-area services list spares and consumables first.</p>
        <input type="search" id="service-inventory-picker-search" class="form-control" placeholder="Search…" aria-label="Search inventory" style="margin-bottom: 0.75rem;">
        <div id="service-inventory-picker-list" style="overflow-y: auto; flex: 1; min-height: 120px; max-height: 50vh; margin-bottom: 1rem;"></div>
        <div class="confirm-modal-actions" style="margin-top: 0;">
          <button type="button" class="btn-secondary" id="service-inventory-picker-cancel">Cancel</button>
          <button type="button" class="btn-primary" id="service-inventory-picker-done">Done</button>
        </div>
      </div>
    </div>
  `;

  const listContainer = document.getElementById('service-list');
  listContainer.insertAdjacentHTML('afterbegin', formHtml + inventoryPickerModalHtml);

  serviceFormInventoryItems = currentBoatId ? await getInventory(currentBoatId) : [];
  initServiceRelatedInventorySection(entry);

  syncServiceTypeDropdown();
  restoreServiceTypeFromEntry(entry);

  const form = document.getElementById('service-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    saveService();
  });

  // Mode toggle – show/hide DIY vs Professional sections; when switching to DIY, show checklist for current engine + service type
  const modeRadios = document.querySelectorAll('input[name="service_mode"]');
  const diyCard = document.getElementById('service-diy-card');
  const proCard = document.getElementById('service-pro-card');

  modeRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      const selected = document.querySelector('input[name="service_mode"]:checked')?.value;
      if (selected === 'DIY') {
        if (diyCard) diyCard.style.display = 'block';
        if (proCard) proCard.style.display = 'none';
        applyServiceFormScope();
        renderDIYChecklist(entry);
      } else {
        if (diyCard) diyCard.style.display = 'none';
        if (proCard) proCard.style.display = 'block';
        applyServiceFormScope();
      }
    });
  });

  // When engine selection changes, refresh DIY engine info and re-render checklist for that engine's fuel/drive type
  const engineSelect = document.getElementById('service_engine');
  if (engineSelect) {
    engineSelect.addEventListener('change', (e) => {
      const engineId = e.target.value;
      const enginesAll = enginesStorage.getAll(currentBoatId);
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
      if (!eng) {
        if (makeModelInput) makeModelInput.value = '';
        if (serialInput) serialInput.value = '';
        if (gearboxInput) gearboxInput.value = '';
      }
      const prevType = getCurrentServiceTypeFromForm();
      applyServiceFormScope();
      syncServiceTypeDropdown();
      const boatLevelNow = isBoatLevelServiceAreaFromForm();
      if (!boatLevelNow && prevType && isSailingServiceType(prevType)) {
        const st = document.getElementById('service_type');
        const cu = document.getElementById('service_type_custom');
        if (st) st.value = 'Other';
        if (cu) cu.value = prevType;
      }
      if (boatLevelNow && prevType && ENGINE_SERVICE_TYPES.includes(prevType) && prevType !== 'Other') {
        const st = document.getElementById('service_type');
        const cu = document.getElementById('service_type_custom');
        if (st) st.value = '';
        if (cu) cu.value = '';
      }
      renderSailingTargetFields(serviceFormEntrySnapshot);
      renderDIYChecklist(entry);
    });
  }

  // Render DIY checklist with existing values (if any)
  renderDIYChecklist(entry);
  applyServiceFormScope();

  // Handle custom service type
  document.getElementById('service_type').addEventListener('change', (e) => {
    if (e.target.value) {
      document.getElementById('service_type_custom').value = '';
    }
    if (e.target.value && isSailingServiceType(e.target.value)) {
      const sel = document.getElementById('service_engine');
      if (sel) sel.value = '';
    }
    if (serviceFormEntrySnapshot) {
      serviceFormEntrySnapshot = { ...serviceFormEntrySnapshot, sailing_service_detail: {} };
    }
    applyServiceFormScope();
    renderSailingTargetFields(serviceFormEntrySnapshot);
    renderDIYChecklist(entry);
  });

  document.getElementById('service_type_custom').addEventListener('input', (e) => {
    if (e.target.value) {
      document.getElementById('service_type').value = '';
    }
    applyServiceFormScope();
    renderSailingTargetFields(serviceFormEntrySnapshot);
    renderDIYChecklist(entry);
  });

  // Attach per-entry attachments & links handlers for this entry
  initServiceFormAttachments(editingId);

  window.servicePageCancelForm = () => {
    const card = document.getElementById('service-form-card');
    if (card) card.remove();
    editingId = null;
    const hash = window.location.hash || '';
    if (hash.includes('/service/') && !hash.endsWith('/service')) {
      navigate(`/boat/${currentBoatId}/service`);
    }
  };
}

function getEngineFuelAndDrive(engine) {
  if (!engine) return { fuel_type: '', drive_type: '' };
  let fuel = engine.fuel_type;
  let drive = engine.drive_type;
  try {
    const raw = engine.notes;
    if (raw != null) {
      const parsed = typeof raw === 'string' ? (raw.trim().startsWith('{') ? JSON.parse(raw) : null) : raw;
      if (parsed && typeof parsed === 'object') {
        if (parsed.fuel_type != null && parsed.fuel_type !== '') fuel = parsed.fuel_type;
        if (parsed.drive_type != null && parsed.drive_type !== '') drive = parsed.drive_type;
      }
    }
  } catch (_) {}
  return { fuel_type: fuel ?? '', drive_type: drive ?? '' };
}

function renderDIYChecklist(entry) {
  const container = document.getElementById('service-diy-checklist');
  if (!container) return;

  const existingChecklist = entry?.diy_checklist || {};
  const currentServiceType = getCurrentServiceTypeFromForm();

  const engineSelectEl = document.getElementById('service_engine');
  const selectedOption = engineSelectEl?.options[engineSelectEl.selectedIndex];
  const selectedEngineId = (engineSelectEl?.value || entry?.engine_id || '').toString().trim();

  // Fuel and drive type come from the selected option's data attributes (set when the dropdown was built from engine cards)
  const fuelFromOption = (selectedOption?.getAttribute('data-fuel-type') || '').trim();
  const driveFromOption = (selectedOption?.getAttribute('data-drive-type') || '').trim();

  const displayEl = document.getElementById('service-engine-fuel-drive-display');
  if (displayEl) {
    if (isBoatLevelServiceAreaFromForm() && isSailingServiceType(currentServiceType)) {
      displayEl.textContent = 'Sail & rigging — checklist matches the service type you selected.';
    } else if (selectedEngineId && (fuelFromOption || driveFromOption)) {
      const fuelLabel = formatFuelTypeForDisplay(fuelFromOption) || '—';
      const driveLabel = formatDriveTypeForDisplay(driveFromOption) || '—';
      displayEl.textContent = `Fuel type: ${fuelLabel} • Drive type: ${driveLabel}. Checklist below shows only items for this combination.`;
    } else {
      displayEl.textContent = 'Select an engine above to see fuel type and drive type. The checklist below is filtered by these.';
    }
  }

  // Use only fuel/drive from the dropdown (single source of truth) for filtering
  const engineAttrs = selectedEngineId
    ? { fuel_type: fuelFromOption, drive_type: driveFromOption }
    : null;

  if (isBoatLevelServiceAreaFromForm() && !currentServiceType) {
    container.innerHTML = `
      <p class="text-muted" style="margin-top: 0;">
        Choose a sail & rigging service type above to show the checklist for that task.
      </p>
    `;
    return;
  }

  const activeSections = getActiveChecklistSectionsForServiceType(currentServiceType, engineAttrs);

  if (!activeSections.length) {
    container.innerHTML = `
      <p class="text-muted" style="margin-top: 0;">
        No checklist for this service type. Select a service type above, or record details in the notes below.
      </p>
    `;
    return;
  }

  const noEngineSelected = !selectedEngineId || (!fuelFromOption && !driveFromOption);
  const showEngineTailorNote =
    !isBoatLevelServiceAreaFromForm() &&
    !isSailingServiceType(currentServiceType) &&
    currentServiceType !== LEGACY_SAILING_SERVICE_TYPE &&
    noEngineSelected;
  const tailorNote = showEngineTailorNote
    ? '<p class="text-muted" style="margin-top: 0; margin-bottom: 0.75rem;">Select an engine under Service area to tailor this checklist to your engine (fuel & drive type).</p>'
    : '';

  container.innerHTML = tailorNote + activeSections.map(section => {
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

function getActiveChecklistSectionsForServiceType(serviceType, engineOrAttrs) {
  return getActiveChecklistSectionsForServiceTypeInternal(serviceType, engineOrAttrs ?? null);
}

function getActiveChecklistSectionsForServiceTypeInternal(serviceType, engine) {
  if (!serviceType) return [];

  const boatLevelRigging = !engine;
  if (boatLevelRigging && isSailingServiceType(serviceType)) {
    return getSailingChecklistSectionsForType(serviceType);
  }

  let baseSectionIds;
  if (serviceType === 'Annual Service') {
    baseSectionIds = DIY_CHECKLIST_SECTIONS.map(s => s.id);
  } else {
    const mapped = SERVICE_TYPE_SECTION_MAP[serviceType];
    if (!mapped || !Array.isArray(mapped)) {
      return [];
    }
    baseSectionIds = mapped;
  }

  const baseSections = DIY_CHECKLIST_SECTIONS.filter(section => baseSectionIds.includes(section.id));

  // If no engine selected, show full checklist for this service type so the user always sees items.
  // If engine is selected, filter to sections that match its fuel and drive type.
  if (!engine) {
    return baseSections;
  }

  return baseSections.filter(section => sectionAppliesToEngine(section.id, engine));
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
        showToast(`You can only upload up to ${LIMITED_UPLOADS_PER_ENTITY} files for this service entry.`, 'error');
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
        showToast('Some files were larger than 2 MB and were skipped.', 'info');
      }

      if (!validFiles.length) {
        fileInput.value = '';
        return;
      }

      const filesToUpload = validFiles.slice(0, remainingSlots);
      if (validFiles.length > remainingSlots) {
        showToast(`Only ${remainingSlots} more file(s) can be uploaded for this service entry (max ${LIMITED_UPLOADS_PER_ENTITY}).`, 'info');
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
        showToast('Please enter a URL.', 'error');
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
  const form = document.getElementById('service-form');
  setSaveButtonLoading(form, true);
  const serviceMode = document.querySelector('input[name="service_mode"]:checked')?.value || 'Professional';
  const serviceType = document.getElementById('service_type').value || document.getElementById('service_type_custom').value;
  const engineIdRaw = document.getElementById('service_engine').value;
  const boatLevelServiceArea = !(engineIdRaw || '').toString().trim();

  let diyChecklist = null;
  let diyMeta = null;
  let seacocksPosition = null;
  let futureItemsNotes = null;
  let partsReplacedNotes = null;
  let proMeta = null;

  if (serviceMode === 'DIY') {
    diyChecklist = {};
    let sectionsToSave = DIY_CHECKLIST_SECTIONS;
    if (boatLevelServiceArea && isSailingServiceType(serviceType)) {
      sectionsToSave = getSailingChecklistSectionsForType(serviceType);
    }
    sectionsToSave.forEach(section => {
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
      person_carrying_out_service: document.getElementById('diy_person_carrying_out_service')?.value || '',
      sail_condition_notes: document.getElementById('diy_sail_condition_notes')?.value?.trim() || '',
      sails_repairs_required: document.getElementById('diy_sails_repairs_required')?.value?.trim() || '',
      sails_work_carried_out: document.getElementById('diy_sails_work_carried_out')?.value?.trim() || ''
    };

    seacocksPosition = document.querySelector('input[name="diy_seacocks_position"]:checked')?.value || null;
    futureItemsNotes = document.getElementById('diy_future_items_notes')?.value || '';
    partsReplacedNotes = document.getElementById('diy_parts_replaced_notes')?.value || '';
  } else {
    proMeta = {
      workshop_name: document.getElementById('pro_workshop_name')?.value || '',
      mechanic_name: document.getElementById('pro_mechanic_name')?.value || '',
      invoice_number: document.getElementById('pro_invoice_number')?.value || '',
      service_description: document.getElementById('pro_service_description')?.value || ''
    };
  }

  if (!boatLevelServiceArea && !engineIdRaw) {
    showToast('Please select an engine for this service type.', 'error');
    setSaveButtonLoading(form, false);
    return;
  }

  if (boatLevelServiceArea && !serviceType.trim()) {
    showToast('Choose a sail & rigging service type.', 'error');
    setSaveButtonLoading(form, false);
    return;
  }

  const nextDueVal = document.getElementById('service_next_due_shared')?.value?.trim() || '';
  const reminderSelect = document.getElementById('service_next_reminder_shared');
  let nextReminderMins = nextDueVal
    ? (parseInt(reminderSelect?.value ?? '1440', 10) || 0)
    : null;

  const isCreatingEntry = String(editingId || '').startsWith('service_');
  if (!hasActiveSubscription() && isCreatingEntry) {
    const typeSel = document.getElementById('service_type')?.value?.trim() || '';
    const typeCustom = document.getElementById('service_type_custom')?.value?.trim() || '';
    if (!typeSel && !typeCustom) {
      showToast('Please choose or enter a service type.', 'error');
      setSaveButtonLoading(form, false);
      return;
    }
    if (!nextDueVal) {
      showToast('Please set a next due date so we can create your reminder.', 'error');
      setSaveButtonLoading(form, false);
      return;
    }
  }

  if (!hasActiveSubscription() && nextDueVal && (!nextReminderMins || nextReminderMins === 0)) {
    nextReminderMins = 1440;
  }

  try {

  const sailingDetailRaw = collectSailingServiceDetailFromForm();
  const sailing_service_detail =
    boatLevelServiceArea && sailingDetailRaw && Object.keys(sailingDetailRaw).length
      ? sailingDetailRaw
      : boatLevelServiceArea
        ? {}
        : null;

  const costEl = document.getElementById('service_cost');
  const costVal = costEl?.value?.trim();
  const linkedInvRaw = document.getElementById('service-linked-inventory-json')?.value || '[]';
  let linked_inventory_links = [];
  try {
    linked_inventory_links = JSON.parse(linkedInvRaw);
  } catch (_) {
    linked_inventory_links = [];
  }
  linked_inventory_links = (Array.isArray(linked_inventory_links) ? linked_inventory_links : [])
    .filter((r) => r && r.inventory_item_id)
    .map((r) => ({
      inventory_item_id: r.inventory_item_id,
      quantity_used:
        r.quantity_used == null || r.quantity_used === '' ? null : Number(r.quantity_used),
      affects_stock: !!r.affects_stock
    }));
  const invById = new Map(serviceFormInventoryItems.map((it) => [it.id, it]));
  for (const row of linked_inventory_links) {
    const inv = invById.get(row.inventory_item_id);
    if (!inv) continue;
    const stockTracked = inventoryItemTracksStock(inv);
    if (stockTracked && row.affects_stock) {
      const qty = Number(row.quantity_used);
      if (!Number.isFinite(qty) || qty <= 0) {
        showToast(`Enter quantity used for "${inv.name || 'Item'}".`, 'error');
        setSaveButtonLoading(form, false);
        return;
      }
      const stock = inv.in_stock_level == null || inv.in_stock_level === '' ? 0 : Number(inv.in_stock_level);
      if (qty > stock) {
        showToast(`"${inv.name || 'Item'}" only has ${stock} in stock.`, 'error');
        setSaveButtonLoading(form, false);
        return;
      }
    }
  }

  const entry = {
    id: editingId,
    date: document.getElementById('service_date').value,
    engine_id: engineIdRaw || null,
    service_type: serviceType,
    engine_hours: boatLevelServiceArea
      ? null
      : (document.getElementById('service_hours').value
        ? parseFloat(document.getElementById('service_hours').value)
        : null),
    notes: document.getElementById('service_notes').value,
    cost: costVal ? parseFloat(costVal) : null,
    cost_currency: document.getElementById('service_cost_currency')?.value || 'GBP',
    mode: serviceMode,
    diy_checklist: diyChecklist,
    diy_meta: diyMeta,
    seacocks_position: seacocksPosition,
    future_items_notes: futureItemsNotes,
    parts_replaced_notes: partsReplacedNotes,
    next_service_due: nextDueVal,
    next_service_reminder_minutes: nextReminderMins,
    pro_meta: proMeta,
    sailing_service_detail,
    linked_inventory_links
  };

  // Pass full entry so checklist, DIY/pro meta, and all details are persisted (Supabase description + local storage)
  let resolvedServiceId = null;
  if (editingId && String(editingId).includes('-')) {
    await updateServiceEntry(editingId, entry);
    resolvedServiceId = editingId;
  } else {
    const created = await createServiceEntry(currentBoatId, entry);
    if (created && created._saveFailed) {
      const msg = String(created.message || '');
      const isRlsRecursion =
        created.code === '42P17' || msg.includes('infinite recursion') || msg.includes('infinite recursion detected');
      showToast(
        isRlsRecursion
          ? 'Could not save: the database still has an old security rule. Apply the Supabase migration `20260328130000_service_entries_insert_rls_no_recursion.sql` (includes row_security off on the count helper), then try again.'
          : msg || 'Could not save this entry.',
        'error'
      );
      return;
    }
    if (!created) {
      showToast(SERVICE_HISTORY_UPGRADE_MESSAGE, 'info');
      showServiceHistoryLimitModal();
      return;
    }
    if (created?.currencyFallback) {
      showToast('Entry saved. For currency labels (e.g. USD), run the database migration: add cost_currency to service_entries.', 'info');
    }
    resolvedServiceId =
      created && typeof created === 'object' && created.id ? created.id : entry.id;
  }

  if (resolvedServiceId) {
    try {
      const stockTrackedById = new Map(
        serviceFormInventoryItems.map((item) => [item.id, inventoryItemTracksStock(item)])
      );
      await replaceServiceInventoryLinks(
        resolvedServiceId,
        currentBoatId,
        linked_inventory_links,
        { stockTrackedById }
      );
    } catch (linkErr) {
      showToast(linkErr?.message || 'Could not save related inventory usage.', 'error');
      return;
    }
  }
  try {
    await syncCalendarNotifications();
  } catch (e) {
    console.warn('[BoatMatey] Reminder notification sync failed:', e);
  }

  if (entry.engine_id && entry.service_type) {
    try {
      const schedules = await getEngineMaintenanceSchedules(currentBoatId);
      const matches = findSchedulesMatchingServiceEntry(schedules, {
        engineId: entry.engine_id,
        serviceType: entry.service_type
      });
      if (matches.length) {
        await offerUpdateEngineSchedulesAfterService({
          matches,
          completedDate: entry.date,
          engineHours: entry.engine_hours,
          boatId: currentBoatId
        });
      }
    } catch (e) {
      console.warn('[BoatMatey] Maintenance schedule prompt failed:', e?.message || e);
    }
  }

  const card = document.getElementById('service-form-card');
  if (card) card.remove();
  editingId = null;
  const hash = window.location.hash || '';
  if (hash.includes('/service/') && !hash.endsWith('/service')) {
    navigate(`/boat/${currentBoatId}/service`);
  } else {
    loadServices();
  }
  } finally {
    setSaveButtonLoading(form, false);
  }
}

export default {
  render,
  onMount
};

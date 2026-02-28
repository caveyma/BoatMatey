/**
 * Service History Page
 */

import { navigate } from '../router.js';
import { renderIcon } from '../components/icons.js';
import { createYachtHeader, createBackButton } from '../components/header.js';
import { showToast } from '../components/toast.js';
import { confirmAction } from '../components/confirmModal.js';
import { setSaveButtonLoading } from '../utils/saveButton.js';
import { isBoatArchived, getServiceEntries, createServiceEntry, updateServiceEntry, deleteServiceEntry, getEngines } from '../lib/dataService.js';
import { currencySymbol, CURRENCIES } from '../lib/currency.js';
import { enginesStorage } from '../lib/storage.js';
import { getUploads, saveUpload, deleteUpload, openUpload, formatFileSize, getUpload, LIMITED_UPLOAD_SIZE_BYTES, LIMITED_UPLOADS_PER_ENTITY, saveLinkAttachment } from '../lib/uploads.js';

let editingId = null;
let serviceArchived = false;
let filterEngineId = null;
let currentBoatId = null;
/** All service entries (before filter/sort) for list */
let allServiceEntries = [];
let serviceFileInput = null;
let currentServiceIdForUpload = null;
/** Engines used when building the service form; fallback for checklist when storage is empty or out of sync */
let serviceFormEngines = [];

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

// Sails & Rigging checklist (boat-level; no engine). Used when service type is 'Sails & Rigging'.
const SAILS_RIGGING_CHECKLIST_SECTIONS = [
  {
    id: 'sails_mainsail',
    title: 'Mainsail',
    items: [
      { id: 'mainsail_condition_inspected', label: 'Mainsail condition inspected (cloth, stitching, UV damage)' },
      { id: 'reefing_system_checked', label: 'Reefing system checked (points, lines, slugs)' },
      { id: 'battens_inspected', label: 'Battens inspected and secure' },
      { id: 'sail_cover_condition', label: 'Sail cover / stack pack condition checked' },
      { id: 'mainsheet_traveler_operational', label: 'Mainsheet and traveler operational' }
    ]
  },
  {
    id: 'sails_headsails',
    title: 'Headsails (genoa, jib)',
    items: [
      { id: 'headsail_condition_inspected', label: 'Headsail(s) condition inspected' },
      { id: 'furling_system_checked', label: 'Furling system checked (foil, drum, line)' },
      { id: 'headsail_sheets_checked', label: 'Headsail sheets and cars checked' }
    ]
  },
  {
    id: 'rigging_mast_spar',
    title: 'Mast & spar',
    items: [
      { id: 'mast_inspection_visual', label: 'Mast visual inspection (corrosion, cracks, fittings)' },
      { id: 'spreaders_and_fittings_checked', label: 'Spreaders and fittings checked' },
      { id: 'boom_gooseneck_kicking_strap', label: 'Boom, gooseneck and kicking strap checked' },
      { id: 'mast_boot_seal_checked', label: 'Mast boot / deck seal checked' }
    ]
  },
  {
    id: 'rigging_standing',
    title: 'Standing rigging',
    items: [
      { id: 'shrouds_stay_inspection', label: 'Shrouds and stay(s) inspected (wire/rod, terminals)' },
      { id: 'turnbuckles_lubricated_tight', label: 'Turnbuckles lubricated and secure' },
      { id: 'swage_terminals_cracks', label: 'Swage/terminals checked for cracks or wear' },
      { id: 'forestay_backstay_checked', label: 'Forestay and backstay checked' }
    ]
  },
  {
    id: 'rigging_running',
    title: 'Running rigging',
    items: [
      { id: 'halyards_inspected', label: 'Halyards inspected (wear, UV, splices)' },
      { id: 'sheets_inspected', label: 'Sheets inspected' },
      { id: 'blocks_clutches_checked', label: 'Blocks, clutches and fairleads checked' },
      { id: 'control_lines_checked', label: 'Control lines (vang, cunningham, outhaul) checked' }
    ]
  },
  {
    id: 'winches_sails',
    title: 'Winches',
    items: [
      { id: 'winches_serviced_lubricated', label: 'Winches serviced and lubricated' },
      { id: 'winch_pawls_springs_checked', label: 'Pawls and springs checked' },
      { id: 'winch_mountings_secure', label: 'Winch mountings secure' }
    ]
  },
  {
    id: 'final_checks_sails',
    title: 'Final checks (sails & rigging)',
    items: [
      { id: 'all_pins_split_rings_secure', label: 'All pins and split rings secure' },
      { id: 'no_frayed_or_chafed_lines', label: 'No frayed or chafed lines left in use' },
      { id: 'service_notes_recorded_sails', label: 'Service notes recorded' }
    ]
  },
  {
    id: 'service_notes_advisories_sails',
    title: 'Service notes & advisories',
    items: [
      { id: 'items_requiring_future_attention_noted_sails', label: 'Items requiring future attention noted' },
      { id: 'parts_replaced_listed_sails', label: 'Parts replaced listed' },
      { id: 'next_service_due_recorded_sails', label: 'Next service due recorded' }
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
  ],
  'Sails & Rigging': SAILS_RIGGING_CHECKLIST_SECTIONS.map(s => s.id)
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

function getDIYChecklistStats(entry) {
  const checklist = entry?.diy_checklist || {};
  let total = 0;
  let completed = 0;

  const activeSections = entry?.service_type === 'Sails & Rigging'
    ? SAILS_RIGGING_CHECKLIST_SECTIONS
    : getActiveChecklistSectionsForServiceType(entry.service_type, enginesStorage.getAll(currentBoatId).find(e => e.id === entry.engine_id));
  const sectionsToCount = activeSections.length ? activeSections : DIY_CHECKLIST_SECTIONS;

  sectionsToCount.forEach(section => {
    section.items.forEach(item => {
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

  const addBtn = document.createElement('button');
  addBtn.className = 'btn-primary';
  addBtn.id = 'service-add-btn';
  addBtn.innerHTML = `${renderIcon('plus')} Add Service Entry`;
  addBtn.onclick = () => navigate(`/boat/${currentBoatId}/service/new`);

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

  loadServices();
}

function loadFilters() {
  const filterContainer = document.getElementById('service-filter');
  const engines = enginesStorage.getAll(currentBoatId);
  filterContainer.className = 'page-actions list-tools';
  filterContainer.innerHTML = `
    <input type="search" id="service-search" class="form-control" placeholder="Search entries..." aria-label="Search service entries">
    <select id="engine-filter" class="form-control" style="max-width: 200px;">
      <option value="">All Engines</option>
      ${engines.map(e => `<option value="${e.id}">${e.label || 'Unnamed'}</option>`).join('')}
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
  document.getElementById('service-search').addEventListener('input', () => loadServices());
  document.getElementById('service-sort').addEventListener('change', () => loadServices());
}

async function loadServices() {
  const listContainer = document.getElementById('service-list');
  allServiceEntries = currentBoatId ? await getServiceEntries(currentBoatId) : [];
  const q = (document.getElementById('service-search')?.value || '').trim().toLowerCase();
  const sortVal = document.getElementById('service-sort')?.value || 'newest';
  let services = allServiceEntries.filter(s => {
    if (filterEngineId && s.engine_id !== filterEngineId) return false;
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
        ${!serviceArchived ? `<div class="empty-state-actions"><button type="button" class="btn-primary" onclick="event.preventDefault(); window.navigate('/boat/${currentBoatId}/service/new')">${renderIcon('plus')} Add Service Entry</button></div>` : ''}
      </div>
    `
      : `<p class="text-muted">No service entries match your search.</p>`;
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
          ${!serviceArchived ? `<a href="#/boat/${currentBoatId}/service/${service.id}" class="btn-link" onclick="event.preventDefault(); window.navigate('/boat/${currentBoatId}/service/${service.id}')">${renderIcon('edit')}</a>
          <button class="btn-link btn-danger" onclick="servicePageDelete('${service.id}')">${renderIcon('trash')}</button>` : ''}
        </div>
      </div>
      <div>
        <p><strong>Engine Hours:</strong> ${service.engine_hours || 'N/A'}</p>
        ${service.cost != null ? `<p><strong>Cost:</strong> ${currencySymbol(service.cost_currency)}${Number(service.cost).toFixed(2)}</p>` : ''}
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
      deleteUpload(uploadId);
      loadServices();
      showToast('Attachment removed', 'info');
    });
  });
}

async function showServiceForm() {
  if (document.getElementById('service-form-card')) return;
  const services = currentBoatId ? await getServiceEntries(currentBoatId) : [];
  const existingEntry = editingId ? services.find((s) => s.id === editingId) : null;
  if (!editingId) {
    editingId = `service_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  const entry = existingEntry;
  const mode = entry?.mode || 'Professional';
  const engines = currentBoatId ? await getEngines(currentBoatId) : [];
  serviceFormEngines = engines;
  const serviceTypes = ['Oil Change', 'Filter Change', 'Annual Service', 'Winterization', 'Sails & Rigging', 'Other'];

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
          <label for="service_engine">Engine</label>
          <select id="service_engine">
            <option value="" data-fuel-type="" data-drive-type="" ${entry?.service_type === 'Sails & Rigging' && !entry?.engine_id ? ' selected' : ''}>N/A – Sails & Rigging (boat-level)</option>
            ${engines.map(e => {
              const attrs = getEngineFuelAndDrive(e);
              const fuel = normaliseFuelType(attrs.fuel_type);
              const drive = normaliseDriveType(attrs.drive_type);
              const sel = entry?.engine_id === e.id ? ' selected' : '';
              const label = (e.label || 'Unnamed').replace(/&/g, '&amp;').replace(/</g, '&lt;');
              return `<option value="${String(e.id)}" data-fuel-type="${(fuel || '').replace(/"/g, '&quot;')}" data-drive-type="${(drive || '').replace(/"/g, '&quot;')}"${sel}>${label}</option>`;
            }).join('')}
          </select>
          <p class="text-muted" style="margin-top: 0.25rem; font-size: 0.875rem;">Use &quot;N/A – Sails & Rigging&quot; for sail and rigging service (no engine).</p>
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
        <div class="card" id="service-diy-card" style="margin-top: 1rem; ${mode === 'DIY' ? 'display: block;' : 'display: none;'}">
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
          <div class="form-group" id="service-engine-fuel-drive-wrap">
            <p id="service-engine-fuel-drive-display" class="text-muted" style="margin-top: 0.25rem; margin-bottom: 0;">Select an engine above to see fuel type and drive type. The checklist below is filtered by these.</p>
          </div>
          <div class="form-group">
            <label for="diy_person_carrying_out_service">Person carrying out service</label>
            <input type="text" id="diy_person_carrying_out_service" value="${entry?.diy_meta?.person_carrying_out_service || ''}">
          </div>

          <div id="service-diy-checklist"></div>

          <div class="form-group" style="margin-top: 1rem;">
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
          <div class="form-group">
            <label for="diy_next_service_due">Next service due</label>
            <input type="date" id="diy_next_service_due" value="${entry?.next_service_due || ''}">
          </div>
          <div class="form-group">
            <label for="diy_next_service_reminder">Reminder</label>
            <select id="diy_next_service_reminder">
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

        <div class="card" id="service-pro-card" style="margin-top: 1rem; ${mode === 'DIY' ? 'display: none;' : 'display: block;'}">
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
        renderDIYChecklist(entry);
      } else {
        if (diyCard) diyCard.style.display = 'none';
        if (proCard) proCard.style.display = 'block';
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
      renderDIYChecklist(entry);
    });
  }

  // Render DIY checklist with existing values (if any)
  renderDIYChecklist(entry);

  // Handle custom service type
  document.getElementById('service_type').addEventListener('change', (e) => {
    if (e.target.value) {
      document.getElementById('service_type_custom').value = '';
    }
    if (e.target.value === 'Sails & Rigging') {
      const engineSelect = document.getElementById('service_engine');
      if (engineSelect) engineSelect.value = '';
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
    if (currentServiceType === 'Sails & Rigging') {
      displayEl.textContent = 'Sails & rigging service – use the checklist below.';
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
  const tailorNote = noEngineSelected
    ? '<p class="text-muted" style="margin-top: 0; margin-bottom: 0.75rem;">Select an engine above to tailor this checklist to your engine (fuel & drive type).</p>'
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

  // Sails & Rigging is boat-level; use sailing checklist only (no engine filter).
  if (serviceType === 'Sails & Rigging') {
    return SAILS_RIGGING_CHECKLIST_SECTIONS;
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

  let diyChecklist = null;
  let diyMeta = null;
  let seacocksPosition = null;
  let futureItemsNotes = null;
  let partsReplacedNotes = null;
  let nextServiceDue = null;
  let proMeta = null;

  if (serviceMode === 'DIY') {
    diyChecklist = {};
    const sectionsToSave = serviceType === 'Sails & Rigging' ? SAILS_RIGGING_CHECKLIST_SECTIONS : DIY_CHECKLIST_SECTIONS;
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

  if (serviceType !== 'Sails & Rigging' && !engineIdRaw) {
    showToast('Please select an engine for this service type.', 'error');
    setSaveButtonLoading(form, false);
    return;
  }
  try {

  const costEl = document.getElementById('service_cost');
  const costVal = costEl?.value?.trim();
  const entry = {
    id: editingId,
    date: document.getElementById('service_date').value,
    engine_id: engineIdRaw || null,
    service_type: serviceType,
    engine_hours: document.getElementById('service_hours').value ? parseFloat(document.getElementById('service_hours').value) : null,
    notes: document.getElementById('service_notes').value,
    cost: costVal ? parseFloat(costVal) : null,
    cost_currency: document.getElementById('service_cost_currency')?.value || 'GBP',
    mode: serviceMode,
    diy_checklist: diyChecklist,
    diy_meta: diyMeta,
    seacocks_position: seacocksPosition,
    future_items_notes: futureItemsNotes,
    parts_replaced_notes: partsReplacedNotes,
    next_service_due: nextServiceDue,
    next_service_reminder_minutes: parseInt(document.getElementById('diy_next_service_reminder')?.value || '1440', 10) || null,
    pro_meta: proMeta
  };

  // Pass full entry so checklist, DIY/pro meta, and all details are persisted (Supabase description + local storage)
  if (editingId && String(editingId).includes('-')) {
    await updateServiceEntry(editingId, entry);
  } else {
    const created = await createServiceEntry(currentBoatId, entry);
    if (created?.currencyFallback) {
      showToast('Entry saved. For currency labels (e.g. USD), run the database migration: add cost_currency to service_entries.', 'info');
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

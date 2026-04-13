/**
 * Sail & rigging (boat-level) service entry: service types, checklists, and target field behaviour.
 * Engine-based service types stay in service.js (ENGINE_SERVICE_TYPES).
 */

export const LEGACY_SAILING_SERVICE_TYPE = 'Sails & Rigging';

export const SAILING_SERVICE_TYPES = [
  'Winches',
  'Sails',
  'Running Rigging',
  'Standing Rigging',
  'Furler / Reefing System',
  'Mast & Boom',
  'Deck Hardware / Fittings',
  'General Sail & Rigging Inspection'
];

/** Service types shown when an engine is selected (not boat-level rigging). */
export const ENGINE_SERVICE_TYPES = ['Oil Change', 'Filter Change', 'Annual Service', 'Winterization', 'Other'];

export function isSailingServiceType(type) {
  if (!type || typeof type !== 'string') return false;
  if (type === LEGACY_SAILING_SERVICE_TYPE) return true;
  return SAILING_SERVICE_TYPES.includes(type);
}

/**
 * Target field layout for boat-level rigging entries.
 * @type {Record<string, 'winches' | 'sail' | 'rigging' | 'component' | 'general' | 'none'>}
 */
export const SAILING_TARGET_FIELD_BY_TYPE = {
  Winches: 'winches',
  Sails: 'sail',
  'Running Rigging': 'rigging',
  'Standing Rigging': 'rigging',
  'Furler / Reefing System': 'component',
  'Mast & Boom': 'component',
  'Deck Hardware / Fittings': 'component',
  'General Sail & Rigging Inspection': 'general',
  [LEGACY_SAILING_SERVICE_TYPE]: 'none'
};

/** Preset winch labels (value stored as-is; user can add custom rows). */
export const WINCH_PRESET_OPTIONS = [
  { value: '', label: 'Choose or type custom…' },
  { value: 'Port cockpit winch', label: 'Port cockpit winch' },
  { value: 'Starboard cockpit winch', label: 'Starboard cockpit winch' },
  { value: 'Mast winch', label: 'Mast winch' },
  { value: 'Cabin top port', label: 'Cabin top port' },
  { value: 'Cabin top starboard', label: 'Cabin top starboard' },
  { value: '__custom__', label: 'Custom…' }
];

export const SAIL_WORKED_ON_OPTIONS = [
  { value: '', label: 'Select…' },
  { value: 'Mainsail', label: 'Mainsail' },
  { value: 'Genoa', label: 'Genoa' },
  { value: 'Jib', label: 'Jib' },
  { value: 'Staysail', label: 'Staysail' },
  { value: 'Spinnaker', label: 'Spinnaker' },
  { value: 'Gennaker', label: 'Gennaker' },
  { value: '__custom__', label: 'Other (type below)' }
];

/**
 * Legacy checklist (pre–subtype sailing entries). Preserves keys for existing diy_checklist data.
 */
export const LEGACY_SAILING_CHECKLIST_SECTIONS = [
  {
    id: 'sails_rigging_quick',
    title: 'Sail & rigging — quick checks',
    items: [
      { id: 'mainsail_checked', label: 'Mainsail checked' },
      { id: 'genoa_jib_checked', label: 'Genoa / jib checked' },
      { id: 'running_rigging_checked', label: 'Running rigging checked' },
      { id: 'standing_rigging_checked', label: 'Standing rigging checked' },
      { id: 'sheets_halyards_checked', label: 'Sheets / halyards checked' },
      { id: 'winches_checked_serviced', label: 'Winches checked / serviced' },
      { id: 'furler_reefing_checked', label: 'Furler / reefing system checked' },
      { id: 'mast_boom_visual', label: 'Mast / boom visual inspection' },
      { id: 'rig_tension_checked', label: 'Rig tension checked' },
      { id: 'shackles_split_pins_fittings', label: 'Shackles, split pins & fittings checked' },
      { id: 'repairs_required_identified', label: 'Any repairs required (note below)' }
    ]
  },
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

/** Service type -> DIY checklist sections (single section per type for clarity). */
const SAILING_TYPE_CHECKLISTS = {
  Winches: [
    {
      id: 'sail_winches',
      title: 'Winch service',
      items: [
        { id: 'location_recorded', label: 'Winch location / identifier recorded' },
        { id: 'stripped_down', label: 'Winch stripped down' },
        { id: 'old_grease_removed', label: 'Old grease removed' },
        { id: 'parts_cleaned', label: 'Parts cleaned' },
        { id: 'pawls_checked', label: 'Pawls checked' },
        { id: 'springs_checked', label: 'Springs checked' },
        { id: 'regreased_lubricated', label: 'Re-greased / lubricated correctly' },
        { id: 'reassembled', label: 'Reassembled' },
        { id: 'tested_under_load', label: 'Tested under load' },
        { id: 'notes_issues', label: 'Notes / issues found' }
      ]
    }
  ],
  Sails: [
    {
      id: 'sail_sails',
      title: 'Sail inspection & service',
      items: [
        { id: 'sail_identified', label: 'Sail identified' },
        { id: 'condition_inspected', label: 'Sail condition inspected' },
        { id: 'stitching_checked', label: 'Stitching checked' },
        { id: 'uv_strip_checked', label: 'UV strip checked' },
        { id: 'batten_pockets_checked', label: 'Batten pockets checked' },
        { id: 'tell_tales_checked', label: 'Tell-tales checked' },
        { id: 'repairs_noted', label: 'Repairs required noted' },
        { id: 'cleaned_serviced', label: 'Sail cleaned / serviced if applicable' },
        { id: 'notes_issues', label: 'Notes / issues found' }
      ]
    }
  ],
  'Running Rigging': [
    {
      id: 'sail_running_rig',
      title: 'Running rigging',
      items: [
        { id: 'lines_identified', label: 'Lines identified' },
        { id: 'chafe_checked', label: 'Chafe checked' },
        { id: 'clutches_blocks_checked', label: 'Wear at clutches / blocks checked' },
        { id: 'ends_splices_checked', label: 'Ends / splices checked' },
        { id: 'replaced_cleaned', label: 'Replaced / cleaned if needed' },
        { id: 'notes_issues', label: 'Notes / issues found' }
      ]
    }
  ],
  'Standing Rigging': [
    {
      id: 'sail_standing_rig',
      title: 'Standing rigging',
      items: [
        { id: 'shrouds_stays_visual', label: 'Shrouds / stays visually checked' },
        { id: 'terminals_inspected', label: 'Terminals inspected' },
        { id: 'split_pins_rings', label: 'Split pins / rings checked' },
        { id: 'corrosion_checked', label: 'Corrosion checked' },
        { id: 'tune_tension_checked', label: 'Rig tune / tension checked' },
        { id: 'notes_issues', label: 'Notes / issues found' }
      ]
    }
  ],
  'Furler / Reefing System': [
    {
      id: 'sail_furler_reef',
      title: 'Furler / reefing system',
      items: [
        { id: 'drum_inspected', label: 'Drum inspected' },
        { id: 'foil_inspected', label: 'Foil inspected' },
        { id: 'bearings_checked', label: 'Bearings checked' },
        { id: 'reefing_lines_checked', label: 'Reefing lines checked' },
        { id: 'operation_tested', label: 'Operation tested' },
        { id: 'notes_issues', label: 'Notes / issues found' }
      ]
    }
  ],
  'Mast & Boom': [
    {
      id: 'sail_mast_boom',
      title: 'Mast & boom',
      items: [
        { id: 'mast_inspected', label: 'Mast inspected' },
        { id: 'boom_inspected', label: 'Boom inspected' },
        { id: 'gooseneck_checked', label: 'Gooseneck checked' },
        { id: 'sheaves_checked', label: 'Sheaves checked' },
        { id: 'fittings_checked', label: 'Fittings checked' },
        { id: 'corrosion_cracks_checked', label: 'Corrosion / cracks checked' },
        { id: 'notes_issues', label: 'Notes / issues found' }
      ]
    }
  ],
  'Deck Hardware / Fittings': [
    {
      id: 'sail_deck_hw',
      title: 'Deck hardware / fittings',
      items: [
        { id: 'cleats_checked', label: 'Cleats checked' },
        { id: 'tracks_checked', label: 'Tracks checked' },
        { id: 'blocks_checked', label: 'Blocks checked' },
        { id: 'stanchions_pulpits_checked', label: 'Stanchions / pulpits checked' },
        { id: 'fastenings_checked', label: 'Fastenings checked' },
        { id: 'rebedding_noted', label: 'Rebedding needed noted' },
        { id: 'notes_issues', label: 'Notes / issues found' }
      ]
    }
  ],
  'General Sail & Rigging Inspection': [
    {
      id: 'sail_general_inspection',
      title: 'General sail & rigging inspection',
      items: [
        { id: 'sails_checked', label: 'Sails checked' },
        { id: 'running_checked', label: 'Running rigging checked' },
        { id: 'standing_checked', label: 'Standing rigging checked' },
        { id: 'winches_checked', label: 'Winches checked' },
        { id: 'fittings_checked', label: 'Fittings checked' },
        { id: 'repairs_needed_noted', label: 'Repairs needed noted' }
      ]
    }
  ]
};

/**
 * Checklist sections for a boat-level sailing service type (not legacy).
 * @param {string} serviceType
 * @returns {typeof LEGACY_SAILING_CHECKLIST_SECTIONS}
 */
export function getSailingChecklistSectionsForType(serviceType) {
  if (!serviceType || serviceType === LEGACY_SAILING_SERVICE_TYPE) {
    return LEGACY_SAILING_CHECKLIST_SECTIONS;
  }
  return SAILING_TYPE_CHECKLISTS[serviceType] || [];
}

/**
 * All sailing checklist sections (for saving: scan every possible key — conservative merge).
 */
export function getAllSailingChecklistSectionsFlat() {
  const seen = new Map();
  const add = (sections) => {
    for (const sec of sections) {
      if (!seen.has(sec.id)) seen.set(sec.id, sec);
    }
  };
  add(LEGACY_SAILING_CHECKLIST_SECTIONS);
  for (const t of SAILING_SERVICE_TYPES) {
    add(getSailingChecklistSectionsForType(t));
  }
  return [...seen.values()];
}

/**
 * Human-readable summary of sailing_service_detail for list cards.
 * @param {object|null|undefined} detail
 */
export function formatSailingServiceDetailSummary(detail) {
  if (!detail || typeof detail !== 'object') return '';
  const parts = [];
  if (Array.isArray(detail.winch_identifiers) && detail.winch_identifiers.length) {
    parts.push(`Winches: ${detail.winch_identifiers.join('; ')}`);
  }
  if (detail.sail_worked_on && String(detail.sail_worked_on).trim()) {
    parts.push(`Sail: ${String(detail.sail_worked_on).trim()}`);
  }
  if (Array.isArray(detail.rigging_items) && detail.rigging_items.length) {
    parts.push(`Rigging: ${detail.rigging_items.join('; ')}`);
  }
  if (detail.component_worked_on && String(detail.component_worked_on).trim()) {
    parts.push(`Component: ${String(detail.component_worked_on).trim()}`);
  }
  if (detail.location_or_fitting && String(detail.location_or_fitting).trim()) {
    parts.push(`Location: ${String(detail.location_or_fitting).trim()}`);
  }
  if (detail.inspection_scope && String(detail.inspection_scope).trim()) {
    parts.push(`Scope: ${String(detail.inspection_scope).trim()}`);
  }
  return parts.length ? parts.join(' · ') : '';
}

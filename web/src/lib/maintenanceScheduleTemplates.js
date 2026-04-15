export const MAINTENANCE_TEMPLATE_MAP = {
  Engine: {
    prominentFor: ['motor', 'sailing', 'rib'],
    types: {
      'Oil change': { frequency_mode: 'date_and_hours', interval_months: 12, interval_hours: 100, remind_offset_days: 7 },
      'Fuel filter': { frequency_mode: 'date_and_hours', interval_months: 12, interval_hours: 200, remind_offset_days: 7 },
      Impeller: { frequency_mode: 'date', interval_months: 12, interval_hours: null, remind_offset_days: 7 },
      'Belt inspection': { frequency_mode: 'date_and_hours', interval_months: 12, interval_hours: 100, remind_offset_days: 7 },
      'Cooling system check': { frequency_mode: 'date', interval_months: 12, interval_hours: null, remind_offset_days: 7 },
      'Full service': { frequency_mode: 'date_and_hours', interval_months: 12, interval_hours: 200, remind_offset_days: 14 },
      'Gearbox service': { frequency_mode: 'date_and_hours', interval_months: 12, interval_hours: 200, remind_offset_days: 14 },
      Custom: { frequency_mode: 'date', interval_months: null, interval_hours: null, remind_offset_days: 7 }
    }
  },
  'Sail & Rigging': {
    prominentFor: ['sailing'],
    types: {
      'Rigging inspection': { frequency_mode: 'date', interval_months: 12, interval_hours: null, remind_offset_days: 14 },
      'Standing rigging replacement check': { frequency_mode: 'date', interval_months: 60, interval_hours: null, remind_offset_days: 30 },
      'Running rigging inspection': { frequency_mode: 'date', interval_months: 12, interval_hours: null, remind_offset_days: 14 },
      'Rig tension check': { frequency_mode: 'date', interval_months: 12, interval_hours: null, remind_offset_days: 14 },
      'Turnbuckle / bottle screw inspection': { frequency_mode: 'date', interval_months: 12, interval_hours: null, remind_offset_days: 14 },
      'Mast inspection': { frequency_mode: 'date', interval_months: 12, interval_hours: null, remind_offset_days: 14 },
      'Mast wiring / lights check': { frequency_mode: 'date', interval_months: 12, interval_hours: null, remind_offset_days: 14 },
      'Spreaders inspection': { frequency_mode: 'date', interval_months: 12, interval_hours: null, remind_offset_days: 14 },
      'Sail inspection': { frequency_mode: 'date', interval_months: 12, interval_hours: null, remind_offset_days: 14 },
      'Sail wash / service': { frequency_mode: 'date', interval_months: 12, interval_hours: null, remind_offset_days: 14 },
      'Sail repair check': { frequency_mode: 'date', interval_months: 12, interval_hours: null, remind_offset_days: 14 },
      'UV strip inspection': { frequency_mode: 'date', interval_months: 12, interval_hours: null, remind_offset_days: 14 },
      'Deck fittings inspection': { frequency_mode: 'date', interval_months: 12, interval_hours: null, remind_offset_days: 14 },
      'Blocks & sheaves inspection': { frequency_mode: 'date', interval_months: 12, interval_hours: null, remind_offset_days: 14 },
      Custom: { frequency_mode: 'date', interval_months: null, interval_hours: null, remind_offset_days: 7 }
    }
  },
  Winches: {
    prominentFor: ['sailing'],
    types: {
      'Winch service': { frequency_mode: 'date', interval_months: 12, interval_hours: null, remind_offset_days: 14 },
      'Winch inspection': { frequency_mode: 'date', interval_months: 6, interval_hours: null, remind_offset_days: 7 },
      Custom: { frequency_mode: 'date', interval_months: null, interval_hours: null, remind_offset_days: 7 }
    }
  },
  'Haul-out': {
    prominentFor: ['motor', 'sailing', 'rib'],
    types: {
      'Haul-out': { frequency_mode: 'date', interval_months: 12, interval_hours: null, remind_offset_days: 30 },
      Antifoul: { frequency_mode: 'date', interval_months: 12, interval_hours: null, remind_offset_days: 30 },
      'Anode replacement': { frequency_mode: 'date', interval_months: 12, interval_hours: null, remind_offset_days: 14 },
      'Hull polish': { frequency_mode: 'date', interval_months: 12, interval_hours: null, remind_offset_days: 14 },
      'Through-hull inspection': { frequency_mode: 'date', interval_months: 12, interval_hours: null, remind_offset_days: 14 },
      'Prop inspection': { frequency_mode: 'date', interval_months: 12, interval_hours: null, remind_offset_days: 14 },
      'Cutlass bearing check': { frequency_mode: 'date', interval_months: 24, interval_hours: null, remind_offset_days: 30 },
      Custom: { frequency_mode: 'date', interval_months: null, interval_hours: null, remind_offset_days: 7 }
    }
  },
  Safety: {
    prominentFor: ['motor', 'sailing', 'rib'],
    types: {
      'Lifejacket inspection': { frequency_mode: 'date', interval_months: 12, interval_hours: null, remind_offset_days: 14 },
      'Fire extinguisher check': { frequency_mode: 'date', interval_months: 12, interval_hours: null, remind_offset_days: 14 },
      'Fire extinguisher replacement': { frequency_mode: 'date', interval_months: 60, interval_hours: null, remind_offset_days: 30 },
      'Flares expiry': { frequency_mode: 'date', interval_months: 36, interval_hours: null, remind_offset_days: 30 },
      'EPIRB check': { frequency_mode: 'date', interval_months: 12, interval_hours: null, remind_offset_days: 30 },
      'First aid kit check': { frequency_mode: 'date', interval_months: 12, interval_hours: null, remind_offset_days: 14 },
      'Bilge pump inspection': { frequency_mode: 'date', interval_months: 6, interval_hours: null, remind_offset_days: 7 },
      Custom: { frequency_mode: 'date', interval_months: null, interval_hours: null, remind_offset_days: 7 }
    }
  },
  Electrical: {
    prominentFor: ['motor', 'sailing', 'rib'],
    types: {
      'Battery inspection': { frequency_mode: 'date', interval_months: 6, interval_hours: null, remind_offset_days: 7 },
      'Battery replacement check': { frequency_mode: 'date', interval_months: 36, interval_hours: null, remind_offset_days: 30 },
      'Shore power inspection': { frequency_mode: 'date', interval_months: 12, interval_hours: null, remind_offset_days: 14 },
      'Inverter inspection': { frequency_mode: 'date', interval_months: 12, interval_hours: null, remind_offset_days: 14 },
      'Solar system inspection': { frequency_mode: 'date', interval_months: 12, interval_hours: null, remind_offset_days: 14 },
      Custom: { frequency_mode: 'date', interval_months: null, interval_hours: null, remind_offset_days: 7 }
    }
  },
  Watermaker: {
    prominentFor: ['motor', 'sailing', 'rib'],
    types: {
      'Membrane service': { frequency_mode: 'date', interval_months: 12, interval_hours: null, remind_offset_days: 14 },
      'Prefilter replacement': { frequency_mode: 'date_and_hours', interval_months: 12, interval_hours: 100, remind_offset_days: 7 },
      'Pickling / lay-up': { frequency_mode: 'date', interval_months: 6, interval_hours: null, remind_offset_days: 7 },
      'General inspection': { frequency_mode: 'date', interval_months: 12, interval_hours: null, remind_offset_days: 14 },
      Custom: { frequency_mode: 'date', interval_months: null, interval_hours: null, remind_offset_days: 7 }
    }
  },
  Gas: {
    prominentFor: ['motor', 'sailing', 'rib'],
    types: {
      'Gas system inspection': { frequency_mode: 'date', interval_months: 12, interval_hours: null, remind_offset_days: 30 },
      'Regulator replacement check': { frequency_mode: 'date', interval_months: 60, interval_hours: null, remind_offset_days: 30 },
      'Hose replacement check': { frequency_mode: 'date', interval_months: 60, interval_hours: null, remind_offset_days: 30 },
      'Gas locker inspection': { frequency_mode: 'date', interval_months: 12, interval_hours: null, remind_offset_days: 14 },
      'Gas alarm test': { frequency_mode: 'date', interval_months: 6, interval_hours: null, remind_offset_days: 7 },
      Custom: { frequency_mode: 'date', interval_months: null, interval_hours: null, remind_offset_days: 7 }
    }
  },
  'General Maintenance': {
    prominentFor: ['motor', 'sailing', 'rib'],
    types: {
      'General inspection': { frequency_mode: 'date', interval_months: 12, interval_hours: null, remind_offset_days: 14 },
      'Deep clean': { frequency_mode: 'date', interval_months: 12, interval_hours: null, remind_offset_days: 14 },
      Winterisation: { frequency_mode: 'date', interval_months: 12, interval_hours: null, remind_offset_days: 30 },
      'De-winterisation': { frequency_mode: 'date', interval_months: 12, interval_hours: null, remind_offset_days: 30 },
      Custom: { frequency_mode: 'date', interval_months: null, interval_hours: null, remind_offset_days: 7 }
    }
  },
  Other: {
    prominentFor: ['motor', 'sailing', 'rib'],
    types: {
      Custom: { frequency_mode: 'date', interval_months: null, interval_hours: null, remind_offset_days: 7 }
    }
  }
};

const LEGACY_SCHEDULE_TYPE_ALIASES = {
  'Lewmar / manufacturer service': 'Custom'
};

const CATEGORY_VISIBILITY_BY_BOAT_TYPE = {
  sailing: ['Engine', 'Sail & Rigging', 'Winches', 'Electrical', 'Safety', 'Haul-out', 'Gas', 'General Maintenance', 'Watermaker', 'Other'],
  motor: ['Engine', 'Electrical', 'Safety', 'Haul-out', 'Gas', 'General Maintenance', 'Watermaker', 'Other'],
  rib: ['Engine', 'Electrical', 'Safety', 'General Maintenance', 'Watermaker', 'Other']
};

export function getVisibleCategoriesForBoatType(boatType) {
  const type = (boatType || '').toLowerCase().trim();
  const mapped = CATEGORY_VISIBILITY_BY_BOAT_TYPE[type];
  if (!Array.isArray(mapped) || !mapped.length) {
    return Object.keys(MAINTENANCE_TEMPLATE_MAP);
  }
  return mapped.filter((name) => !!MAINTENANCE_TEMPLATE_MAP[name]);
}

export function getTemplateCategoriesForBoatType(boatType) {
  return getVisibleCategoriesForBoatType(boatType);
}

export function getScheduleTypesForCategory(category) {
  const cat = MAINTENANCE_TEMPLATE_MAP[category] || MAINTENANCE_TEMPLATE_MAP.Other;
  return Object.keys(cat.types);
}

export function normalizeScheduleTypeForCategory(category, scheduleType) {
  const normalized = LEGACY_SCHEDULE_TYPE_ALIASES[scheduleType] || scheduleType;
  const types = getScheduleTypesForCategory(category);
  if (!normalized || !types.includes(normalized)) return 'Custom';
  return normalized;
}

export function getTemplateDefaults(category, scheduleType) {
  const cat = MAINTENANCE_TEMPLATE_MAP[category] || MAINTENANCE_TEMPLATE_MAP.Other;
  const normalizedType = normalizeScheduleTypeForCategory(category, scheduleType);
  const entry = cat.types[normalizedType] || cat.types.Custom || null;
  if (!entry) return null;
  return { ...entry };
}

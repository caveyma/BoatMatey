/**
 * Marine inventory: categories, detail JSON shape, templates, attention helpers.
 * Base boat_inventory row stays stable; sailing-specific fields live in `detail`.
 */

const MS_PER_DAY = 86400000;

export const INVENTORY_CONDITIONS = ['', 'Excellent', 'Good', 'Fair', 'Needs Attention', 'Needs Replacement'];

export const SAIL_TYPES = [
  'Mainsail',
  'Genoa',
  'Jib',
  'Staysail',
  'Spinnaker',
  'Gennaker',
  'Storm Sail',
  'Other'
];

/** Primary categories (motor + sailing). */
export const MARINE_CATEGORIES = [
  { value: 'Spare Parts', label: 'Spare Parts' },
  { value: 'Consumables', label: 'Consumables' },
  { value: 'Sails', label: 'Sails' },
  { value: 'Winches', label: 'Winches' },
  { value: 'Running Rigging', label: 'Running Rigging' },
  { value: 'Standing Rigging', label: 'Standing Rigging' },
  { value: 'Deck Hardware', label: 'Deck Hardware' },
  { value: 'Safety Equipment', label: 'Safety Equipment' },
  { value: 'Electrical', label: 'Electrical' },
  { value: 'Tools', label: 'Tools' },
  { value: 'Miscellaneous', label: 'Miscellaneous' }
];

/** Legacy DB / app values — still valid for existing records. */
export const LEGACY_INVENTORY_CATEGORIES = [
  { value: 'Engine', label: 'Engine' },
  { value: 'Plumbing', label: 'Plumbing' },
  { value: 'Cleaning', label: 'Cleaning' },
  { value: 'Galley', label: 'Galley' },
  { value: 'Spares', label: 'Spares' },
  { value: 'Deck Gear', label: 'Deck Gear' },
  { value: 'Safety', label: 'Safety' }
];

const RIGGING_CATEGORIES = new Set(['Running Rigging', 'Standing Rigging']);

export function categoryUsesStockSection(_category) {
  return true;
}

export function isRiggingCategory(category) {
  return RIGGING_CATEGORIES.has(category || '');
}

export function normalizeInventoryItem(item) {
  if (!item) return item;
  const raw = item.detail;
  const detail =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...raw } : {};
  return { ...item, detail };
}

export function getInventoryDetail(item) {
  if (!item) return emptyDetail();
  return normalizeInventoryItem(item).detail;
}

export function emptyDetail() {
  return {
    track_stock_quantity: true,
    condition: '',
    purchase_date: '',
    installed_date: '',
    last_inspected_date: '',
    last_serviced_date: '',
    last_replaced_date: '',
    recommended_replacement_date: '',
    sail_type: '',
    sailmaker: '',
    sail_material: '',
    stored_location: '',
    winch_size: '',
    self_tailing: false,
    electric_winch: false,
    rigging_purpose: '',
    rigging_use_location: '',
    line_material: '',
    line_diameter: '',
    line_length: '',
    standing_element_type: '',
    standing_location_note: '',
    deck_brand_model: ''
  };
}

export function mergeDetail(existingItem, partial) {
  return { ...emptyDetail(), ...getInventoryDetail(existingItem), ...partial };
}

/**
 * Per-item stock behavior:
 * - explicit detail.track_stock_quantity wins
 * - legacy rows fall back to presence of stock-ish fields on that item
 */
export function inventoryItemTracksStock(item) {
  const row = normalizeInventoryItem(item || {});
  const d = row.detail || {};
  if (typeof d.track_stock_quantity === 'boolean') return d.track_stock_quantity;
  return (
    row.in_stock_level != null ||
    row.required_quantity != null ||
    !!row.unit ||
    !!row.critical_spare
  );
}

function startOfTodayLocal(ref = new Date()) {
  const d = ref instanceof Date ? ref : new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** @param {string|null|undefined} raw */
function toLocalDay(raw) {
  if (raw == null || raw === '') return null;
  const s = String(raw);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/**
 * Days from today to recommended replacement (negative = overdue).
 * @returns {number|null}
 */
export function inventoryRecommendedReplacementOffsetDays(item, refDate = new Date()) {
  const d = getInventoryDetail(item);
  const rec = d.recommended_replacement_date;
  if (!rec) return null;
  const day = toLocalDay(rec);
  if (!day) return null;
  const t0 = startOfTodayLocal(refDate).getTime();
  return Math.round((day.getTime() - t0) / MS_PER_DAY);
}

export function inventoryConditionNeedsReview(item) {
  const c = (getInventoryDetail(item).condition || '').trim();
  return c === 'Needs Attention' || c === 'Needs Replacement';
}

/** Strict "needs attention": bad condition or replacement date already passed. */
export function inventoryNeedsAttentionStrict(item) {
  if (inventoryConditionNeedsReview(item)) return true;
  const off = inventoryRecommendedReplacementOffsetDays(item);
  return off !== null && off < 0;
}

/** Replacement date set and overdue or within 30 days. */
export function inventoryReplacementDueOrSoon(item, windowDays = 30) {
  const off = inventoryRecommendedReplacementOffsetDays(item);
  return off !== null && off <= windowDays;
}

/** Dashboard / tagline: condition issues or replacement due/overdue soon. */
export function inventoryItemNeedsReview(item) {
  return inventoryNeedsAttentionStrict(item) || inventoryReplacementDueOrSoon(item);
}

export function inventorySummaryCounts(items) {
  const list = Array.isArray(items) ? items.map(normalizeInventoryItem) : [];
  let sails = 0;
  let winches = 0;
  let rigging = 0;
  let attention = 0;
  for (const i of list) {
    if (i.category === 'Sails') sails += 1;
    else if (i.category === 'Winches') winches += 1;
    else if (isRiggingCategory(i.category)) rigging += 1;
    if (inventoryItemNeedsReview(i)) attention += 1;
  }
  return { sails, winches, rigging, attention, total: list.length };
}

/**
 * Quick-add templates: only prefill name / type / detail snippets.
 * @type {Record<string, { label: string, name: string, type?: string, detail?: object }[]>}
 */
export const INVENTORY_TEMPLATES = {
  Sails: [
    { label: 'Mainsail', name: 'Mainsail', type: 'Mainsail', detail: { sail_type: 'Mainsail' } },
    { label: 'Genoa', name: 'Genoa', type: 'Genoa', detail: { sail_type: 'Genoa' } },
    { label: 'Jib', name: 'Jib', type: 'Jib', detail: { sail_type: 'Jib' } },
    { label: 'Spinnaker', name: 'Spinnaker', type: 'Spinnaker', detail: { sail_type: 'Spinnaker' } },
    { label: 'Gennaker', name: 'Gennaker', type: 'Gennaker', detail: { sail_type: 'Gennaker' } }
  ],
  Winches: [
    { label: 'Port cockpit winch', name: 'Port cockpit winch' },
    { label: 'Starboard cockpit winch', name: 'Starboard cockpit winch' },
    { label: 'Mast winch', name: 'Mast winch' },
    { label: 'Cabin top port', name: 'Cabin top port winch' },
    { label: 'Cabin top starboard', name: 'Cabin top starboard winch' }
  ],
  'Running Rigging': [
    { label: 'Main halyard', name: 'Main halyard', detail: { rigging_purpose: 'Halyard' } },
    { label: 'Genoa sheet', name: 'Genoa sheet', detail: { rigging_purpose: 'Sheet' } },
    { label: 'Kicker', name: 'Kicker', detail: { rigging_purpose: 'Boom vang / kicker' } },
    { label: 'Reefing line', name: 'Reefing line', detail: { rigging_purpose: 'Reefing' } }
  ],
  'Standing Rigging': [
    { label: 'Forestay', name: 'Forestay', detail: { standing_element_type: 'Forestay' } },
    { label: 'Backstay', name: 'Backstay', detail: { standing_element_type: 'Backstay' } },
    { label: 'Cap shroud', name: 'Cap shroud', detail: { standing_element_type: 'Cap shroud' } },
    { label: 'Lower shroud', name: 'Lower shroud', detail: { standing_element_type: 'Lower shroud' } }
  ]
};

export const INVENTORY_LIST_FILTER = {
  ALL: '',
  NEEDS_ATTENTION: '__attention__',
  REPLACEMENT_DUE: '__replacement_due__',
  RIGGING_ALL: '__rigging_all__'
};

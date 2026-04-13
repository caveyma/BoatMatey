/**
 * Prefill presets for engine maintenance schedules only (not DIY procedure content).
 * @type {{ key: string, task_name: string, category: string, interval_months: number|null, interval_hours: number|null }[]}
 */
export const ENGINE_MAINTENANCE_SCHEDULE_TEMPLATES = [
  { key: 'engine_oil', task_name: 'Engine Oil', category: 'Engine Oil', interval_months: 12, interval_hours: 100 },
  { key: 'oil_filter', task_name: 'Oil Filter', category: 'Oil Filter', interval_months: 12, interval_hours: 100 },
  { key: 'fuel_filter', task_name: 'Fuel Filter', category: 'Fuel Filter', interval_months: 12, interval_hours: 200 },
  { key: 'gearbox_oil', task_name: 'Gearbox Oil', category: 'Gearbox Oil', interval_months: 24, interval_hours: null },
  { key: 'impeller', task_name: 'Impeller', category: 'Impeller', interval_months: 12, interval_hours: 300 },
  { key: 'belts', task_name: 'Belts', category: 'Belts', interval_months: 24, interval_hours: null },
  { key: 'anodes', task_name: 'Anodes', category: 'Anodes', interval_months: 12, interval_hours: null },
  { key: 'raw_water_strainer', task_name: 'Raw Water Strainer', category: 'Raw Water Strainer', interval_months: 6, interval_hours: null },
  { key: 'coolant_check', task_name: 'Coolant Check', category: 'Coolant Check', interval_months: 12, interval_hours: null }
];

export function getTemplateByKey(key) {
  return ENGINE_MAINTENANCE_SCHEDULE_TEMPLATES.find((t) => t.key === key) || null;
}

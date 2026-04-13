/**
 * Starter templates for sails & rigging maintenance schedules (task name + default months only).
 */

export const SAILS_RIGGING_MAINTENANCE_SCHEDULE_TEMPLATES = [
  { key: 'winch_service', task_name: 'Winch service', category: 'Winches', interval_months: 12 },
  { key: 'standing_rigging_inspection', task_name: 'Standing rigging inspection', category: 'Standing rigging', interval_months: 12 },
  { key: 'running_rigging_inspection', task_name: 'Running rigging inspection', category: 'Running rigging', interval_months: 12 },
  { key: 'mainsail_inspection', task_name: 'Mainsail inspection', category: 'Sails', interval_months: 12 },
  { key: 'genoa_jib_inspection', task_name: 'Genoa / jib inspection', category: 'Sails', interval_months: 12 },
  { key: 'furler_inspection', task_name: 'Furler inspection / service', category: 'Rigging', interval_months: 12 },
  { key: 'mast_boom_inspection', task_name: 'Mast and boom inspection', category: 'Spar', interval_months: 12 },
  { key: 'reefing_system_inspection', task_name: 'Reefing system inspection', category: 'Sails', interval_months: 12 },
  { key: 'deck_fittings_inspection', task_name: 'Deck fittings inspection', category: 'Deck', interval_months: 12 },
  { key: 'shackles_split_pins', task_name: 'Shackles / split pins inspection', category: 'Rigging', interval_months: 6 }
];

export function getSailsTemplateByKey(key) {
  return SAILS_RIGGING_MAINTENANCE_SCHEDULE_TEMPLATES.find((t) => t.key === key) || null;
}

-- Passage Log: optional title and per-day structured log for multi-day passages
-- daily_notes: jsonb object. Keys = date strings (YYYY-MM-DD). Values = object with:
--   noon_position, distance_run_24h, distance_to_nm, average_speed_kts, wind, sea, swell,
--   fuel_pct, water_pct, remarks (legacy: value can be a string, treated as remarks)

alter table public.logbook_entries
  add column if not exists daily_notes jsonb null;

comment on column public.logbook_entries.daily_notes is 'Per-day log for multi-day passages; keys are date strings (YYYY-MM-DD), values are objects (noon_position, distance_run_24h, wind, sea, swell, fuel_pct, water_pct, remarks, etc.) or legacy string (treated as remarks)';

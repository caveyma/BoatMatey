alter table if exists public.maintenance_schedules
  add column if not exists frequency_mode text not null default 'date',
  add column if not exists interval_months int null,
  add column if not exists interval_hours int null,
  add column if not exists schedule_type text not null default 'Custom',
  add column if not exists remind_offset_days int not null default 7,
  add column if not exists notification_enabled boolean not null default true,
  add column if not exists notification_id int null;

update public.maintenance_schedules
set remind_offset_days = 7
where remind_offset_days is null;

update public.maintenance_schedules
set notification_enabled = true
where notification_enabled is null;

update public.maintenance_schedules
set schedule_type = 'Custom'
where schedule_type is null or trim(schedule_type) = '';

update public.maintenance_schedules
set frequency_mode = coalesce(nullif(frequency_type, ''), 'date')
where frequency_mode is null or trim(frequency_mode) = '';

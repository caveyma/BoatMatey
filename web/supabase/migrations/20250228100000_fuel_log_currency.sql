-- Add currency support to fuel log entries (default GBP for existing data)
alter table public.boat_fuel_logs
  add column if not exists fuel_currency text not null default 'GBP';

comment on column public.boat_fuel_logs.fuel_currency is 'ISO 4217 code for the currency of fuel_cost (e.g. GBP, USD, EUR).';

-- Haulout: currency for total_cost
alter table public.haulout_entries
  add column if not exists total_cost_currency text not null default 'GBP';

comment on column public.haulout_entries.total_cost_currency is 'ISO 4217 code for the currency of total_cost (e.g. GBP, USD, EUR).';

-- Service entries: currency for cost
alter table public.service_entries
  add column if not exists cost_currency text not null default 'GBP';

comment on column public.service_entries.cost_currency is 'ISO 4217 code for the currency of cost (e.g. GBP, USD, EUR).';

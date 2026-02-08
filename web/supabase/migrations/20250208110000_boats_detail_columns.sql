-- Boat details: fuel_type, home_marina, local registration, insurance, purchase_date
-- Run after fuel_electrical_boats_registration. Extends boats for full form sync.

alter table public.boats add column if not exists fuel_type text null;
alter table public.boats add column if not exists home_marina text null;
alter table public.boats add column if not exists registration_no text null;
alter table public.boats add column if not exists insurance_provider text null;
alter table public.boats add column if not exists insurance_policy_no text null;
alter table public.boats add column if not exists purchase_date date null;

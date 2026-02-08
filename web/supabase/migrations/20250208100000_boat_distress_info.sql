-- Mayday / Distress Call: boat_distress_info table
-- One row per boat. RLS: CRUD where user_id = auth.uid().
-- Requires handle_updated_at() from boatmatey_setup.sql.

create table if not exists public.boat_distress_info (
  boat_id                 uuid primary key references public.boats(id) on delete cascade,
  user_id                 uuid not null references auth.users(id) on delete cascade,

  vessel_name             text not null,
  vessel_name_phonetic    text null,
  callsign                text null,
  callsign_phonetic       text null,
  mmsi                    text null,

  persons_on_board        integer null,
  skipper_name            text null,
  skipper_mobile          text null,
  emergency_contact_name  text null,
  emergency_contact_phone text null,

  vessel_type             text null,
  hull_colour             text null,
  length_m                numeric(6,2) null,
  distinguishing_features text null,

  liferaft                boolean null,
  epirb                   boolean null,
  epirb_hex_id            text null,
  plb                     boolean null,
  ais                     boolean null,

  home_port               text null,
  usual_area              text null,

  notes                   text null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists idx_boat_distress_info_user_id on public.boat_distress_info(user_id);

drop trigger if exists trg_boat_distress_info_updated_at on public.boat_distress_info;
create trigger trg_boat_distress_info_updated_at
  before update on public.boat_distress_info
  for each row
  execute procedure public.handle_updated_at();

alter table public.boat_distress_info enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'boat_distress_info' and policyname = 'boat_distress_info_select_own') then
    create policy boat_distress_info_select_own on public.boat_distress_info for select
      using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'boat_distress_info' and policyname = 'boat_distress_info_insert_own') then
    create policy boat_distress_info_insert_own on public.boat_distress_info for insert
      with check (user_id = auth.uid() and exists (select 1 from public.boats b where b.id = boat_id and b.owner_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'boat_distress_info' and policyname = 'boat_distress_info_update_own') then
    create policy boat_distress_info_update_own on public.boat_distress_info for update
      using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'boat_distress_info' and policyname = 'boat_distress_info_delete_own') then
    create policy boat_distress_info_delete_own on public.boat_distress_info for delete
      using (user_id = auth.uid());
  end if;
end $$;

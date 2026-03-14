-- Pre-signups: web visitors who want to create an account later via the app.
-- No Supabase Auth user is created; record is used for marketing/onboarding.
-- RLS: allow anonymous INSERT only (web form); SELECT/UPDATE/DELETE for service role only.

create table if not exists public.pre_signups (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  source     text not null default 'boatmatey_web',
  created_at timestamptz not null default now(),
  constraint pre_signups_email_unique unique (email)
);

create index if not exists idx_pre_signups_email on public.pre_signups(email);
create index if not exists idx_pre_signups_created_at on public.pre_signups(created_at desc);

alter table public.pre_signups enable row level security;

-- Allow anonymous (and authenticated) clients to insert only; used by web "Create account" form.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'pre_signups' and policyname = 'pre_signups_insert_anon') then
    create policy pre_signups_insert_anon on public.pre_signups for insert
      with check (true);
  end if;
end $$;

-- No SELECT/UPDATE/DELETE for anon or authenticated; use service_role for admin/backoffice.

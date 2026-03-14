# Fix: “Next haul-out due” date not saving

In this project the web app talks **directly to Supabase** (see `web/src/lib/supabaseClient.js` and `DEPLOY.md`). Haul-out updates use `supabase.from('haulout_entries').update(...)` — there is no custom backend or `update_boat_haulout` RPC in this repo.

The 400 error happens because the **Supabase database** is missing the two columns the app sends: `next_haulout_due` and `next_haulout_reminder_minutes`.

**Use the Supabase project that the app actually uses** — the one whose URL is in your build’s `VITE_SUPABASE_URL` (e.g. in Cloudflare env vars). The project name in Supabase (e.g. “Pethub+”, “BoatMatey”) doesn’t need to match the app name; just use the project that backs this app.

---

## What to do (one-time)

### 1. Run the migration on that Supabase project

1. Open the **Supabase Dashboard** and select the project you use for this app (the one whose URL is in `VITE_SUPABASE_URL`).
2. Go to **SQL Editor**.
3. Run the migration that adds the columns. You can either:

**Option A – Run the migration file as-is**

Open `web/supabase/migrations/20250304100000_haulout_next_due_reminder.sql`, copy its contents, and paste them into the SQL Editor, then run.

**Option B – Run this SQL directly**

```sql
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'haulout_entries'
  ) then
    alter table public.haulout_entries add column if not exists next_haulout_due date null;
    alter table public.haulout_entries add column if not exists next_haulout_reminder_minutes int null;
    comment on column public.haulout_entries.next_haulout_due is 'Suggested date for next haul-out; shown on Calendar for reminders.';
    comment on column public.haulout_entries.next_haulout_reminder_minutes is 'Minutes before next_haulout_due to trigger reminder; null = use default (1440).';
  end if;
end $$;
```

4. If the Editor reports success, the table now has the columns. If you get “relation haulout_entries does not exist”, create the table first (e.g. from `web/supabase/sql/boatmatey_setup.sql` or your main schema), then run this again.

### 2. Reload the PostgREST schema (required)

Supabase’s API (PostgREST) caches the database schema. **Until you reload it, new columns are not visible to the API** and updates that send those columns will return 400.

In the same **SQL Editor**, run:

```sql
NOTIFY pgrst, 'reload schema';
```

You should see “Success. No rows returned”. After that, the API will see `next_haulout_due` and `next_haulout_reminder_minutes` and the save should work.

### 3. Redeploy the app (if you changed env or want a fresh build)

From the repo root:

```bash
npm run deploy:cloudflare
```

(or your usual deploy). No code change is required for the fix; the migration is the fix.

---

After the migration has been applied on the Supabase project that your app uses, editing a haul-out and setting “Next haul-out due” and “Reminder” then saving should work, and the reminder will show on the Calendar.

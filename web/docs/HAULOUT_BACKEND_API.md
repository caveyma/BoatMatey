# Haul-out update and calendar reminder (production API)

## What the user expects

When someone **edits a haul-out** and sets or changes **"Next haul-out due"** and **Reminder**, then taps **Save**:

1. The haul-out record is updated (all fields).
2. The **next haul-out due date** and **reminder** are persisted so they appear on the **Calendar** (home) as a reminder.

## How the web app sends data

The app calls **Supabase-style** `PATCH` to update a haul-out (either directly to Supabase or via your proxy). The request body includes all form fields, including:

- `next_haulout_due` (date, e.g. `"2026-03-06"`) – used for the calendar reminder.
- `next_haulout_reminder_minutes` (number, e.g. `1440` for 1 day before) – when to remind.

In production, requests may go to **`/api/v1/rpc/update_boat_haulout`** (or similar). That endpoint must accept and persist these two fields so that:

- The edit save succeeds (no 400).
- After save, `getHaulouts()` can return rows that include `next_haulout_due` and `next_haulout_reminder_minutes`, so the Calendar can show the reminder and the “Next haul-out due” link opens the correct haul-out edit.

## What the backend must do

1. **Accept** `next_haulout_due` and `next_haulout_reminder_minutes` in the update payload (if your DB has these columns).
2. **Persist** them on the `haulout_entries` (or equivalent) row so they are returned on the next fetch.
3. **Return 2xx** on success so the client does not show “Failed to save”.

If the backend does not yet support these columns, you can:

- Add the columns (e.g. run migration `20250304100000_haulout_next_due_reminder.sql` on the DB your API uses), then update the RPC/handler to read and write `next_haulout_due` and `next_haulout_reminder_minutes` from the request and into the table.

## Client fallback

If the update returns 400 (or an error message suggesting a missing column / schema issue), the web app **retries** the update with a payload that **omits** `next_haulout_due`, `next_haulout_reminder_minutes`, and `total_cost_currency`. That way the rest of the haul-out record can still save; only the calendar reminder fields are dropped until the backend supports them.

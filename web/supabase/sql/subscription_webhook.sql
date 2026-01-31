-- RevenueCat Webhook Handler Function
-- This function can be called from a webhook endpoint to sync subscription status from RevenueCat
-- Future enhancement: Create an Edge Function to receive RevenueCat webhooks

-- Function to update subscription status from RevenueCat webhook
create or replace function public.update_subscription_from_webhook(
  p_user_id uuid,
  p_subscription_status text,
  p_product_id text,
  p_expires_at timestamptz
)
returns void
language plpgsql
security definer
as $$
begin
  -- Update the user's profile with the latest subscription status
  update public.profiles
  set
    subscription_status = p_subscription_status,
    subscription_plan = case
      when p_product_id like '%yearly%' then 'BoatMatey Yearly'
      when p_product_id like '%monthly%' then 'BoatMatey Monthly'
      else 'BoatMatey Premium'
    end,
    subscription_expires_at = p_expires_at,
    updated_at = timezone('utc', now())
  where id = p_user_id;

  -- If profile doesn't exist, this won't create one (GDPR compliant)
  -- Profiles should only be created when user signs up with active subscription
end;
$$;

-- Grant execute permission to service role (for webhook endpoint)
-- Note: In production, you'd create a specific service role for webhooks
grant execute on function public.update_subscription_from_webhook(uuid, text, text, timestamptz) to service_role;

-- Example webhook payload processing (for reference):
/*
RevenueCat sends webhooks with this structure:
{
  "event": {
    "type": "INITIAL_PURCHASE" | "RENEWAL" | "CANCELLATION" | "BILLING_ISSUE" | "EXPIRATION",
    "app_user_id": "uuid-here",
    "product_id": "boatmatey_yearly",
    "expires_at_ms": 1234567890000,
    "subscriber_attributes": { ... }
  }
}

To process this, create an Edge Function that:
1. Validates the webhook signature
2. Extracts the relevant data
3. Calls update_subscription_from_webhook()
4. Returns success/error response
*/

-- Index on subscription_status for efficient queries
create index if not exists idx_profiles_subscription_status_expires
on public.profiles(subscription_status, subscription_expires_at)
where subscription_status = 'active';

-- View to easily identify users with expiring subscriptions
create or replace view public.expiring_subscriptions as
select
  id,
  email,
  subscription_plan,
  subscription_expires_at,
  (subscription_expires_at - timezone('utc', now())) as time_until_expiry
from public.profiles
where
  subscription_status = 'active'
  and subscription_expires_at is not null
  and subscription_expires_at > timezone('utc', now())
  and subscription_expires_at < timezone('utc', now()) + interval '7 days'
order by subscription_expires_at asc;

-- View to identify users with lapsed subscriptions
create or replace view public.lapsed_subscriptions as
select
  id,
  email,
  subscription_plan,
  subscription_expires_at,
  (timezone('utc', now()) - subscription_expires_at) as days_since_expiry
from public.profiles
where
  subscription_status = 'active'
  and subscription_expires_at is not null
  and subscription_expires_at < timezone('utc', now())
order by subscription_expires_at desc;

comment on function public.update_subscription_from_webhook is 'Updates user subscription status from RevenueCat webhook events';
comment on view public.expiring_subscriptions is 'Users with subscriptions expiring in the next 7 days';
comment on view public.lapsed_subscriptions is 'Users with expired subscriptions that are still marked as active';

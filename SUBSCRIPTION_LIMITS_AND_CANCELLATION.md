# BoatMatey Subscription Limits & Cancellation

## User Flow (like PetHub+)

```
App Launch
    ↓
Not authenticated? → Welcome Page
    ↓
    Get Started
    ↓
Auth Page (Sign In / Create Account / Promo Code)
    ↓
┌────────────────────┬─────────────────────────────┐
│   Sign In          │      Create Account         │
│   (existing user)  │      (new user)             │
│        ↓           │            ↓                │
│     Home           │    Subscription Page        │
│                    │    (pay £29.99/year)        │
│                    │            ↓                │
│                    │    Account Created          │
│                    │            ↓                │
│                    │         Home                │
└────────────────────┴─────────────────────────────┘
```

## Subscription Limits

### Active Subscription Includes:
- **2 active boats** - Boats in regular use
- **5 archived boats** - Previous boats, sold vessels, etc.
- **Unlimited engines** - Per boat
- **Unlimited service entries** - Complete maintenance history
- **Unlimited equipment** - Navigation & safety gear
- **Unlimited logbook entries** - Trip logs
- **Unlimited attachments** - Photos and documents

### Limit Enforcement
Limits are enforced in `web/src/lib/subscription.js`:

```javascript
const LIMITS = {
  active_boats: 2,
  archived_boats: 5,
  engines: Infinity,
  service_entries: Infinity,
  equipment: Infinity,
  logbook_entries: Infinity,
  attachments: Infinity
};
```

Use the helper functions:
```javascript
import { checkLimit, getLimitInfo, getAllLimits } from './lib/subscription.js';

// Check if user can add another boat
const result = checkLimit('active_boats', currentActiveBoatCount);
if (!result.allowed) {
  alert(`You've reached the limit of ${result.limit} active boats`);
}

// Get limit info for display
const info = getLimitInfo('active_boats');
console.log(info.label); // "2"

// Get all limits
const limits = getAllLimits();
console.log(limits.activeBoats.label); // "2 active boats"
```

## Subscription Cancellation

### How Cancellation Works

1. **User Action**: User cancels subscription via App Store or Google Play
2. **Store Notification**: Store notifies RevenueCat
3. **Webhook**: RevenueCat sends webhook to our Edge Function
4. **Data Action**: Based on event type:
   - `CANCELLATION`: Mark subscription as cancelled (user still has access until expiry)
   - `EXPIRATION`: **DELETE ALL USER DATA** (GDPR compliance)

### GDPR Compliance

When a subscription expires (not just cancelled, but actually expired):

1. **All user data is deleted**:
   - Boats
   - Engines
   - Service entries
   - Equipment
   - Logbook entries
   - Haulout entries
   - Attachments (database records)
   - Profile
   - Auth user

2. **Storage objects deleted**:
   - All files in user's storage folder

3. **Complete removal**:
   - User cannot sign in
   - No data remains in database
   - Compliant with GDPR "right to be forgotten"

### Event Flow

```
User cancels in App Store/Google Play
         ↓
Store processes cancellation
         ↓
RevenueCat receives CANCELLATION event
         ↓
Webhook sent to Supabase Edge Function
         ↓
Profile updated: subscription_status = 'cancelled'
User still has access until subscription_expires_at
         ↓
[Time passes until expiry date]
         ↓
RevenueCat sends EXPIRATION event
         ↓
Webhook triggers delete_user_completely()
         ↓
All user data deleted (GDPR compliant)
         ↓
User account no longer exists
```

## Setup Instructions

### 1. Deploy SQL Functions

Run in Supabase SQL Editor:
```bash
# First, run the main setup
web/supabase/sql/boatmatey_setup.sql

# Then run the cancellation handler
web/supabase/sql/subscription_cancellation.sql
```

### 2. Deploy Edge Function

```bash
cd web/supabase
supabase functions deploy revenuecat-webhook
```

### 3. Configure RevenueCat Webhook

1. Go to RevenueCat Dashboard: https://app.revenuecat.com
2. Navigate to **Project Settings** → **Integrations** → **Webhooks**
3. Click **+ Add Webhook**
4. Configure:
   - **Name**: BoatMatey Supabase
   - **URL**: `https://<your-project-ref>.supabase.co/functions/v1/revenuecat-webhook`
   - **Events**: Select all (or at minimum: CANCELLATION, EXPIRATION, RENEWAL, INITIAL_PURCHASE, BILLING_ISSUE)
5. Save

### 4. (Optional) Set Webhook Secret

For additional security, set a webhook secret:

1. Generate a secret: `openssl rand -hex 32`
2. Set in RevenueCat: Dashboard → Webhooks → Edit → Authorization Header
3. Set in Supabase: 
   ```bash
   supabase secrets set REVENUECAT_WEBHOOK_SECRET=your-secret-here
   ```
4. Uncomment signature validation in `index.ts`

## Testing

### Test Webhook Locally

```bash
# Start Supabase functions locally
supabase functions serve revenuecat-webhook

# Send test webhook
curl -X POST http://localhost:54321/functions/v1/revenuecat-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "api_version": "1.0",
    "event": {
      "type": "CANCELLATION",
      "app_user_id": "test-user-id",
      "product_id": "boatmatey_yearly"
    }
  }'
```

### Verify in Database

```sql
-- Check webhook logs
SELECT * FROM webhook_logs ORDER BY created_at DESC LIMIT 10;

-- Check subscription events view
SELECT * FROM subscription_events ORDER BY created_at DESC LIMIT 10;

-- Check profile status
SELECT id, email, subscription_status, subscription_expires_at 
FROM profiles 
WHERE email = 'test@example.com';
```

### Simulate Expiration (CAREFUL - Deletes Data!)

```sql
-- This will trigger full data deletion
SELECT public.delete_user_completely('user-uuid-here');
```

## Account Page Updates

The account page now includes:

1. **Manage Subscription Button**: Opens App Store / Google Play subscription management
2. **Cancellation Warning**: Explains that cancellation will delete data
3. **Updated Limits Display**: Shows "2 active boats, 5 archived boats, unlimited engines..."

```javascript
// In account.js
<button class="btn-secondary" id="manage-subscription-btn" style="width: 100%;">
  Manage Subscription
</button>
<p class="text-muted" style="font-size: 0.85rem; margin-top: 0.75rem;">
  To cancel your subscription, use the App Store or Google Play subscription management. 
  Note: Cancelling will delete your account and all data to comply with GDPR.
</p>
```

## Subscription States

| State | Meaning | User Access | Data Status |
|-------|---------|-------------|-------------|
| `active` | Subscription is valid | Full access | Retained |
| `cancelled` | User cancelled, but not yet expired | Full access | Retained |
| `billing_issue` | Payment failed | Limited/Warning | Retained |
| `expired` | Subscription ended | No access | **DELETED** |

## Files Modified/Created

### Created
- `web/supabase/sql/subscription_cancellation.sql` - SQL functions for cancellation
- `web/supabase/functions/revenuecat-webhook/index.ts` - Edge Function
- `SUBSCRIPTION_LIMITS_AND_CANCELLATION.md` - This file

### Modified
- `web/src/lib/subscription.js` - Added proper limits (2 active, 5 archived)
- `web/src/pages/subscription.js` - Updated features list
- `web/src/pages/account.js` - Added manage subscription button & warning

## Important Notes

1. **Cancellation ≠ Deletion**: When a user cancels, they keep access until the end of their billing period. Data is only deleted on EXPIRATION.

2. **No Refunds in Code**: Refunds are handled by the stores. Our system just responds to lifecycle events.

3. **Re-subscription**: If a user's data was deleted and they subscribe again, they start fresh with a new account.

4. **Grace Period**: There's typically a short grace period for billing issues before EXPIRATION is triggered.

5. **Audit Trail**: All webhook events are logged in `webhook_logs` table for debugging and compliance.

## Support

If users have questions about cancellation:

1. Direct them to App Store / Google Play subscription management
2. Explain data will be deleted on expiration
3. Recommend exporting any data they want to keep before cancelling
4. Remind them of the billing cycle (yearly)

## Privacy Policy Update

Make sure your privacy policy includes:
- Data deletion on subscription cancellation
- Right to be forgotten (GDPR)
- How to cancel and what happens to data

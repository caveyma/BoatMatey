# BoatMatey Subscription Setup Guide

## Overview

BoatMatey uses a subscription-based access model with the following characteristics:

- **Price**: £29.99/year including VAT
- **Free Trial**: 1 month for new subscribers
- **Platforms**: Google Play Store & Apple App Store
- **Payment Processing**: RevenueCat
- **GDPR Compliance**: No user data stored until subscription is active

## Subscription Flow

### First-Time User Journey (Native Apps)

1. **Open App** → User sees the subscription paywall (`/subscription`)
2. **Choose Plan** → User taps "Start Free Trial"
3. **Complete Purchase** → RevenueCat handles the store transaction
4. **Create Account** → User is redirected to `/auth` to create account
5. **Access App** → User can now access all features

### Returning User Journey

1. **Open App** → System checks for active subscription
2. **If Active** → Check authentication status
   - **Authenticated** → Access granted to app
   - **Not Authenticated** → Redirect to `/auth`
3. **If Inactive** → Redirect to `/subscription`

## Technical Implementation

### Store Configuration

#### Google Play Store
- **Product ID**: `boatmatey_premium_yearly`
- **Base Plan**: yearly (auto-renewing)
- **Offer ID**: `trial-1-month`
- **Price**: £29.99/year
- **Trial**: 1 month free
- **Countries**: 174 regions
- **Status**: ✅ Active

#### Apple App Store
- **Subscription Group**: BoatMatey Pro
- **Product ID**: `boatmatey_yearly`
- **Duration**: 1 year
- **Price**: £29.99/year (needs to be configured in App Store Connect)
- **Trial**: 1 month free (needs to be configured)
- **Status**: ⚠️ Missing Metadata - needs completion

### RevenueCat Configuration

#### Products
- **Google Play**: `boatmatey_premium_yearly:yearly` - Published ✅
- **App Store**: `boatmatey_yearly` - Missing Metadata ⚠️

#### Entitlements
- **Entitlement ID**: `boatmatey_premium`
- Both store products should be mapped to this entitlement

#### Offerings
An offering named "default" or similar should include the yearly package with trial.

#### API Keys
- **Android**: `goog_hSXBDHatzzsPuTlxckgLtXZKGho` (hardcoded in `services/revenuecat.js`)
- **iOS**: Set in `.env.local` as `VITE_REVENUECAT_API_KEY_IOS`

### Code Structure

#### Pages
- `/web/src/pages/subscription.js` - Subscription paywall with pricing & trial info
- `/web/src/pages/auth.js` - Authentication (sign in/sign up) - requires active subscription

#### Services
- `/web/src/lib/subscription.js` - Core subscription logic
  - `initSubscription()` - Initialize RevenueCat
  - `hasActiveSubscription()` - Check if user has active subscription
  - `purchaseSubscription()` - Handle purchase flow
  - `restoreSubscription()` - Restore previous purchase
  - `refreshSubscriptionStatus()` - Sync with RevenueCat

- `/web/src/services/revenuecat.js` - RevenueCat initialization for Android

#### Router Protection
- `/web/src/router.js` - Implements subscription gate via `checkAccess()`
- Protected routes require: Active subscription + Authentication
- Public routes: `/subscription`, `/auth`

#### App Initialization
- `/web/src/app.js` - Main app entry point
  - Initializes RevenueCat on native platforms
  - Checks subscription & auth status
  - Redirects to appropriate page based on status

### Database Schema

#### profiles table
```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text null,
  full_name text null,
  subscription_plan text null,           -- e.g., "BoatMatey Yearly"
  subscription_status text null,         -- "active" or "inactive"
  subscription_expires_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default timezone('utc', now()),
  updated_at timestamptz default timezone('utc', now())
);
```

The profile is only created **after** a user has an active subscription (GDPR compliance).

### GDPR Compliance

BoatMatey follows GDPR requirements by:

1. **No Data Collection Without Subscription**: User accounts are not created in Supabase until after subscription payment is confirmed
2. **Subscription-First Flow**: Native apps require active subscription before allowing account creation
3. **Clear Consent**: Users explicitly agree to subscription terms before data is stored
4. **Profile Sync**: Subscription status is synced to user's profile in Supabase

The flow ensures compliance:
```
Subscribe → Payment Confirmed → Account Created → Data Stored
```

No personal data is stored for users who:
- Browse the subscription page
- Cancel during trial
- Never complete purchase

## Setup Checklist

### App Store Connect (iOS)
- [ ] Complete localization for `boatmatey_yearly` product
- [ ] Set price to £29.99/year (with regional equivalents)
- [ ] Configure 1-month free trial offer
- [ ] Submit subscription with new app version for first-time approval
- [ ] Verify product status shows "Ready to Submit" or "Approved"

### RevenueCat Dashboard
- [ ] Verify "BoatMatey Pro" offering exists with yearly package
- [ ] Ensure both store products are mapped to `boatmatey_premium` entitlement
- [ ] Add iOS API key to project environment variables
- [ ] Test subscription flow in sandbox mode (both platforms)
- [ ] Verify webhooks are configured (if using server-side validation)

### Supabase
- [ ] Run `boatmatey_setup.sql` to create profiles table with subscription fields
- [ ] Verify RLS policies are enabled on profiles table
- [ ] Test profile creation with subscription data
- [ ] Configure auth email templates (if using email verification)

### Environment Variables
Update `web/.env.local`:
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_REVENUECAT_API_KEY_IOS=appl_your_ios_key_here
```

### Testing

#### Web/Dev Mode
- Subscription is bypassed (always active)
- Allows local development without store integration

#### Native Apps (Sandbox)
1. **Android**: Use test account in Google Play Console
2. **iOS**: Use sandbox tester account in App Store Connect
3. Test complete flow:
   - Open app → See subscription page
   - Purchase with test account
   - Create account
   - Verify access to app
   - Sign out and sign back in
   - Test "Restore Purchase"

## Common Issues & Solutions

### "Missing Metadata" in App Store Connect
**Problem**: iOS subscription shows "Missing Metadata" in RevenueCat
**Solution**: 
1. Go to App Store Connect → BoatMatey → Subscriptions
2. Click on "BoatMatey Yearly"
3. Complete all localization fields (name, description)
4. Set pricing for all required regions
5. Configure free trial offer
6. Save and submit

### Subscription Not Detected
**Problem**: User purchases subscription but app doesn't recognize it
**Solution**:
1. Check RevenueCat logs for the user ID
2. Verify product IDs match exactly in code and store
3. Ensure offering is configured in RevenueCat
4. Try "Restore Purchase" button
5. Check entitlement mapping in RevenueCat dashboard

### Web Mode Shows Subscription Page
**Problem**: Development in browser shows subscription paywall
**Solution**: This is expected. Web mode bypasses subscription but the flow is:
1. Subscription page shows info that subscriptions are only in app
2. No purchase possible in web mode
3. Use native app for testing actual subscriptions

### Profile Not Created After Signup
**Problem**: User signs up but profile doesn't appear in Supabase
**Solution**:
1. Check browser console for errors
2. Verify Supabase connection (check .env.local)
3. Ensure RLS policies allow insert on profiles table
4. Check that user has active subscription before signup
5. Review createProfileWithSubscription() function logs

## Support & Documentation

- **RevenueCat Docs**: https://www.revenuecat.com/docs
- **Google Play Billing**: https://developer.android.com/google/play/billing
- **App Store Connect**: https://developer.apple.com/app-store-connect/
- **Supabase Auth**: https://supabase.com/docs/guides/auth

## Next Steps

After completing the setup:

1. **Test thoroughly** in sandbox mode on both platforms
2. **Submit app** for review (Apple requires subscription + new version)
3. **Monitor** RevenueCat dashboard for subscription events
4. **Set up** server-side webhooks for subscription lifecycle events (optional)
5. **Implement** subscription management UI in account page (future enhancement)
6. **Add** subscription renewal reminders (future enhancement)

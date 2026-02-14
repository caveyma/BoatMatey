# BoatMatey Subscription Testing Checklist

## Pre-Testing Setup

### Environment Configuration
- [ ] Copy `web/.env.example` to `web/.env.local`
- [ ] Add Supabase URL and anon key
- [ ] Add iOS RevenueCat API key: `VITE_REVENUECAT_API_KEY_IOS`
- [ ] Verify Android API key is correct in `services/revenuecat.js`

### Store Configuration
- [ ] **Google Play**: Verify yearly subscription is active
- [ ] **App Store**: Complete missing metadata (see APP_STORE_SUBSCRIPTION_SETUP.md)
- [ ] **RevenueCat**: Verify both products are added
- [ ] **RevenueCat**: Create/verify "default" offering with yearly package
- [ ] **RevenueCat**: Map products to `boatmatey_premium` entitlement

### Database Setup
- [ ] Run `boatmatey_setup.sql` in Supabase SQL Editor
- [ ] Run `subscription_webhook.sql` (optional, for webhooks)
- [ ] Verify `profiles` table exists with subscription fields
- [ ] Test RLS policies allow insert/update on profiles

## Web/Development Testing

### Initial Load
- [ ] Run `npm run dev` in `web/` directory
- [ ] Open http://localhost:5173
- [ ] Verify app loads without errors
- [ ] Check browser console for warnings

### Navigation Flow (Web bypasses subscription)
- [ ] App should load to boats list (/)
- [ ] Navigate to /auth - should show auth page
- [ ] Navigate to /subscription - should show info message (subscriptions only in app)
- [ ] Navigate to /account - should show account settings

### Local-Only Mode
- [ ] Create a boat without signing in
- [ ] Add service entry
- [ ] Verify data persists in localStorage
- [ ] Refresh page - data should still be there

## Android Testing (Sandbox)

### Prerequisites
- [ ] Google Play Console test account created
- [ ] Device/emulator signed in with test account
- [ ] App built and deployed: `npm run build && npx cap sync android`

### First Launch (No Subscription)
- [ ] Open app
- [ ] Should immediately show subscription page (`/subscription`)
- [ ] Verify pricing shows: £29.99/year
- [ ] Verify "1 Month Free Trial" badge is visible
- [ ] Verify feature list is displayed
- [ ] Tap "Restore Purchase" - should show "No active subscription found"

### Purchase Flow
- [ ] Tap "Start Free Trial"
- [ ] Google Play billing sheet should appear
- [ ] Complete purchase (free in sandbox)
- [ ] App should show "Subscription activated!" message
- [ ] Should redirect to auth page (`/auth`)

### Account Creation
- [ ] On auth page, tap "Create Account"
- [ ] Enter email and password
- [ ] Tap "Create Account"
- [ ] Should show success message
- [ ] Should redirect to boats list (`/`)

### App Access
- [ ] Verify full access to all features
- [ ] Create a boat
- [ ] Add service entry
- [ ] Navigate to account page
- [ ] Verify subscription shows as "Active"

### Sign Out & Sign In
- [ ] Go to account page
- [ ] Tap "Sign Out"
- [ ] Should redirect to subscription page
- [ ] Subscription should still be active
- [ ] Should automatically redirect to auth page
- [ ] Sign in with same credentials
- [ ] Verify access granted
- [ ] Verify boats and data are synced

### Restore Purchase
- [ ] Uninstall and reinstall app
- [ ] Open app - should show subscription page
- [ ] Tap "Restore Purchase"
- [ ] Should show "Subscription restored!" message
- [ ] Should redirect to auth page
- [ ] Sign in
- [ ] Verify full access

## iOS Testing (Sandbox)

### Prerequisites
- [ ] App Store Connect sandbox tester created
- [ ] iOS device/simulator ready
- [ ] Device signed OUT of App Store
- [ ] App Store Connect subscription metadata completed
- [ ] App built: `npm run build && npx cap sync ios && open ios/App/App.xcworkspace`

### First Launch (No Subscription)
- [ ] Open app from Xcode
- [ ] Should immediately show subscription page (`/subscription`)
- [ ] Verify pricing shows: £29.99/year
- [ ] Verify "1 Month Free Trial" badge is visible
- [ ] Verify feature list is displayed

### Purchase Flow
- [ ] Tap "Start Free Trial"
- [ ] App Store billing sheet should appear
- [ ] Sign in with sandbox tester when prompted
- [ ] Complete purchase (free in sandbox)
- [ ] App should show "Subscription activated!" message
- [ ] Should redirect to auth page (`/auth`)

### Account Creation
- [ ] On auth page, tap "Create Account"
- [ ] Enter email and password
- [ ] Tap "Create Account"
- [ ] Should show success message
- [ ] Should redirect to boats list (`/`)

### App Access
- [ ] Verify full access to all features
- [ ] Create a boat
- [ ] Add service entry
- [ ] Navigate to account page
- [ ] Verify subscription shows as "Active"
- [ ] Verify plan shows "BoatMatey Yearly"

### Sign Out & Sign In
- [ ] Go to account page
- [ ] Tap "Sign Out"
- [ ] Should redirect to subscription page
- [ ] Subscription should still be active
- [ ] Should automatically redirect to auth page
- [ ] Sign in with same credentials
- [ ] Verify access granted
- [ ] Verify boats and data are synced

### Restore Purchase
- [ ] Delete app from device
- [ ] Reinstall from Xcode
- [ ] Open app - should show subscription page
- [ ] Tap "Restore Purchase"
- [ ] Should show "Subscription restored!" message
- [ ] Should redirect to auth page
- [ ] Sign in
- [ ] Verify full access

## Cross-Platform Testing

### Data Sync
- [ ] Create boat on Android
- [ ] Sign in on iOS with same account
- [ ] Verify boat appears
- [ ] Add service entry on iOS
- [ ] Check on Android - should sync
- [ ] Create boat on web (dev mode)
- [ ] Sign in on mobile - should sync

### Subscription Status Sync
- [ ] Purchase on Android
- [ ] Sign in on iOS - should recognize subscription
- [ ] Check account page on both - should show same status

## Edge Cases

### No Internet Connection
- [ ] Disable internet on device
- [ ] Open app
- [ ] Should handle gracefully with error message
- [ ] Enable internet
- [ ] Verify subscription status refreshes

### Expired Subscription (Manual Test)
Note: Hard to test without actual expiry. Can test by:
- [ ] Manually update subscription_expires_at in Supabase to past date
- [ ] Open app
- [ ] Should redirect to subscription page
- [ ] Verify can't access main app

### Billing Issue (Sandbox)
- [ ] In sandbox, cancel subscription from App Store
- [ ] Open app after some time
- [ ] Verify subscription status updates
- [ ] Should block access when expired

### Multiple Devices
- [ ] Sign in on Device A
- [ ] Purchase subscription
- [ ] Sign in on Device B with same account
- [ ] Verify subscription is recognized
- [ ] Create data on Device A
- [ ] Verify syncs to Device B

## Database Verification

### Profile Creation
- [ ] Open Supabase Dashboard
- [ ] Go to Table Editor → profiles
- [ ] Find test user by email
- [ ] Verify fields:
  - `id` matches auth.users.id
  - `email` is correct
  - `subscription_plan` = "BoatMatey Yearly"
  - `subscription_status` = "active"
  - `subscription_expires_at` has future date
  - `metadata` contains platform info

### RLS Policies
- [ ] Create test user A
- [ ] Create boat for user A
- [ ] Create test user B
- [ ] Try to access user A's boat as user B
- [ ] Should be blocked by RLS
- [ ] Verify only own data is visible

## RevenueCat Dashboard

### Transaction Verification
- [ ] Go to RevenueCat Dashboard
- [ ] Customers → Search by email
- [ ] Find test user
- [ ] Verify:
  - Active entitlement: `boatmatey_premium`
  - Product: `boatmatey_yearly` or `boatmatey_premium_yearly:yearly`
  - Status: Active
  - Expiration date set
  - Store: Google Play or App Store

### Charts
- [ ] Check Overview → Active Subscriptions
- [ ] Should show +1 after test purchase
- [ ] Revenue should show $0 (sandbox)

## Performance Testing

### App Launch Speed
- [ ] Time from tap to visible subscription page
- [ ] Should be < 2 seconds
- [ ] Check console for slow operations

### Navigation Speed
- [ ] Navigate between pages
- [ ] Should be instant
- [ ] No visible lag

### Subscription Check
- [ ] Monitor console logs
- [ ] Subscription status refresh should be fast
- [ ] No blocking operations

## Error Handling

### Invalid Credentials
- [ ] Try to sign in with wrong password
- [ ] Should show error message
- [ ] Should not crash app

### Network Error During Purchase
- [ ] Start purchase
- [ ] Disable internet mid-purchase
- [ ] Should handle gracefully
- [ ] Re-enable internet and retry

### Supabase Down
- [ ] Set invalid Supabase URL in .env
- [ ] Open app
- [ ] Should show error but not crash
- [ ] Verify local-only mode works

## Security Testing

### Token Validation
- [ ] Sign in
- [ ] Check localStorage for auth token
- [ ] Verify token is present
- [ ] Sign out
- [ ] Verify token is removed

### RLS Bypass Attempt
- [ ] Try to access other user's data via SQL
- [ ] Should be blocked by RLS policies

### API Key Exposure
- [ ] Check production build
- [ ] Verify API keys are not exposed in source
- [ ] Environment variables should be injected at build time

## Final Verification

### Production Readiness
- [ ] All tests passing
- [ ] No console errors
- [ ] No console warnings (except expected ones)
- [ ] Subscription flow works on both platforms
- [ ] Data syncs correctly
- [ ] GDPR compliance verified (no data before subscription)

### Documentation
- [ ] SUBSCRIPTION_SETUP.md is complete
- [ ] APP_STORE_SUBSCRIPTION_SETUP.md is accurate
- [ ] Code is commented
- [ ] .env.example is updated

### Store Listings
- [ ] Google Play listing mentions subscription
- [ ] App Store listing mentions subscription
- [ ] Privacy policy updated with subscription info
- [ ] Terms of service includes subscription terms

## Sign-Off

- [ ] Developer tested: ___________  Date: _______
- [ ] QA tested: ___________  Date: _______
- [ ] Product owner approved: ___________  Date: _______
- [ ] Ready for production: ___________  Date: _______

## Notes

```
Record any issues found during testing:

```

## Test Results Summary

| Test Category | Pass | Fail | Notes |
|--------------|------|------|-------|
| Web/Dev      |      |      |       |
| Android      |      |      |       |
| iOS          |      |      |       |
| Data Sync    |      |      |       |
| Security     |      |      |       |
| Performance  |      |      |       |

**Overall Status**: [ ] PASS  [ ] FAIL  [ ] NEEDS WORK

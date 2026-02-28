# BoatMatey Subscription Quick Reference

## 🎯 Key Information

**Price**: £29.99/year including VAT  
**Trial**: 1 month free for new subscribers  
**Platforms**: Google Play Store & Apple App Store  
**Payment**: RevenueCat  
**GDPR**: No data stored until subscription paid  

## 📊 Subscription Limits

| Resource | Limit |
|----------|-------|
| **Active Boats** | 2 |
| **Archived Boats** | 5 |
| Engines | Unlimited |
| Service Entries | Unlimited |
| Equipment | Unlimited |
| Logbook Entries | Unlimited |
| Attachments | Unlimited |

## ❌ Cancellation Policy

- User cancels via App Store / Google Play
- **Account is not deleted on cancel.** Access continues: 14 days if cancelled during free trial, otherwise until subscription expires
- **On expiration: ALL DATA DELETED (GDPR)** — RevenueCat webhook triggers data deletion only on EXPIRATION  

## 📱 Product IDs

| Platform | Product ID | Status |
|----------|-----------|--------|
| Google Play | `boatmatey_premium_yearly:yearly` | ✅ Active |
| Apple App Store | `boatmatey_yearly` | ⚠️ Needs metadata |

**RevenueCat Entitlement**: `boatmatey_premium`

## 🔑 API Keys

**Android**: `goog_hSXBDHatzzsPuTlxckgLtXZKGho`  
**iOS**: Set in `.env.local` as `VITE_REVENUECAT_API_KEY_IOS`

## 🗺️ Routes

| Route | Description | Access |
|-------|-------------|--------|
| `/subscription` | Paywall page | Public |
| `/auth` | Sign in/sign up | Public (requires subscription on native) |
| `/` | Boats list | Protected |
| `/boat/:id/*` | All boat pages | Protected |
| `/account` | Settings | Protected |

## 🔒 Access Rules

### Native Apps (Android/iOS)
1. Must have active subscription
2. Must be authenticated
3. Both required to access app

### Web (Development)
- All checks bypassed
- Full access for testing

## 📊 User Flow

```
┌─────────────┐
│  Open App   │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│ Has subscription?│
└─────┬───────┬───┘
      │       │
   NO │       │ YES
      │       │
      ▼       ▼
 /subscription  ┌────────────────┐
      │        │ Authenticated? │
      │        └───┬────────┬───┘
      │            │        │
      │         NO │        │ YES
      │            │        │
      │            ▼        ▼
      └───────►  /auth   Main App
```

## 💾 Database Schema

**profiles table**:
- `id` (uuid) - References auth.users
- `email` (text)
- `subscription_plan` (text) - "BoatMatey Yearly"
- `subscription_status` (text) - "active" or "inactive"
- `subscription_expires_at` (timestamptz) - Renewal date
- `metadata` (jsonb) - Additional data

## 🛠️ Key Functions

**Subscription Management**:
```javascript
import { 
  hasActiveSubscription,
  getSubscriptionStatus,
  purchaseSubscription,
  restoreSubscription,
  refreshSubscriptionStatus
} from './lib/subscription.js';
```

**Profile Management**:
```javascript
// In auth.js
createProfileWithSubscription(userId, email)
syncSubscriptionToProfile(userId)
```

## 📝 To-Do Before Production

### Urgent (Blocks iOS)
- [ ] Complete App Store Connect metadata
- [ ] Set pricing £29.99 in App Store Connect
- [ ] Configure 1-month free trial in App Store Connect
- [ ] Submit app with subscription for review

### Important
- [ ] Configure RevenueCat offering
- [ ] Map both products to entitlement
- [ ] Add iOS API key to environment
- [ ] Test on real devices

### Optional (Future)
- [ ] Set up RevenueCat webhooks
- [ ] Add subscription management UI
- [ ] Implement renewal reminders
- [ ] Add grace period for billing issues

## 🧪 Quick Test Commands

**Development**:
```bash
cd web
npm run dev
# Open http://localhost:5173
```

**Android Build**:
```bash
cd web
npm run build
npx cap sync android
# Open in Android Studio
```

**iOS Build**:
```bash
cd web
npm run build
npx cap sync ios
open ios/App/App.xcworkspace
```

## 🐛 Common Issues

| Issue | Solution |
|-------|----------|
| "Missing Metadata" in RevenueCat | Complete App Store Connect setup |
| Subscription not detected | Check product IDs match exactly |
| Can't purchase in web | Expected - subscriptions only in native apps |
| Profile not created | Ensure subscription is active first |
| Sign-out loops | Clear app data and try again |

## 📞 Support Links

- **RevenueCat Dashboard**: https://app.revenuecat.com
- **Google Play Console**: https://play.google.com/console
- **App Store Connect**: https://appstoreconnect.apple.com
- **Supabase Dashboard**: https://app.supabase.com

## 📚 Documentation Files

- `SUBSCRIPTION_SETUP.md` - Technical overview
- `APP_STORE_SUBSCRIPTION_SETUP.md` - App Store guide
- `SUBSCRIPTION_IMPLEMENTATION.md` - Complete summary
- `SUBSCRIPTION_TESTING.md` - Testing checklist

## 🔍 Debugging

**Check Subscription Status**:
```javascript
// In browser console or app
import { getSubscriptionStatus } from './lib/subscription.js';
console.log(getSubscriptionStatus());
```

**Check RevenueCat**:
- Dashboard → Customers → Search by email
- Verify active entitlement
- Check transaction history

**Check Supabase**:
- Table Editor → profiles
- Find user by email
- Verify subscription fields

## 💡 Tips

1. **Always test in sandbox** before production
2. **Use different test accounts** for each platform
3. **Clear app data** between test runs
4. **Monitor console logs** for errors
5. **Check RevenueCat dashboard** after each test
6. **Verify Supabase profile** is created correctly

## ⚠️ Important Notes

- **GDPR Compliance**: No user data stored without subscription
- **First Submission**: iOS requires subscription + new version together
- **Sandbox vs Production**: Use appropriate test accounts
- **Trial Period**: Only for NEW subscribers
- **Auto-Renewal**: Users must manually cancel

## 🎯 Success Criteria

✅ User can subscribe on both platforms  
✅ Trial period works correctly  
✅ Profile created in Supabase with subscription  
✅ Access granted after subscription  
✅ Access blocked without subscription  
✅ Restore purchase works  
✅ Data syncs across devices  
✅ Sign out/in works correctly  
✅ No GDPR violations  

---

**Version**: 1.0  
**Last Updated**: January 31, 2026  
**Status**: Implementation Complete - Testing Pending

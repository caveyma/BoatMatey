# Fixing the Orphaned Account Issue

## Problem
An account was created via web (rottiracing@gmail.com) without a subscription, violating GDPR compliance. The auth user was created but the profile has no subscription data.

## ✅ Fixed in Code
The following fixes have been applied:

### 1. Web Signup Now Blocked
- **Change**: Added explicit check to block signup on web platforms
- **Effect**: Users on web can only **sign in**, not create new accounts
- **Message**: "Account creation is only available in the BoatMatey mobile app"

### 2. UI Updated
- **Native App**: Shows both "Sign In" and "Create Account" buttons
- **Web**: Only shows "Sign In" button with a warning message about mobile-only signup

### 3. Better Error Handling
- Added try-catch around profile creation
- If profile creation fails, error is logged with user details
- Prevents silent failures

## 🧹 Clean Up the Orphaned Account

You need to manually delete the orphaned account from Supabase:

### Option 1: Using Supabase Dashboard (Easiest)

1. **Go to Supabase Dashboard**: https://app.supabase.com
2. **Select your BoatMatey project**
3. **Navigate to Authentication** → **Users**
4. Find user: `rottiracing@gmail.com`
5. Click **"..."** menu → **"Delete user"**
6. Confirm deletion

This will:
- Delete the auth.users entry
- Automatically cascade delete the profiles entry (due to foreign key)

### Option 2: Using SQL Editor

1. Go to **SQL Editor** in Supabase
2. Run this query:

```sql
-- First, check the user exists
SELECT id, email, created_at 
FROM auth.users 
WHERE email = 'rottiracing@gmail.com';

-- Then delete (this will cascade to profiles due to FK)
DELETE FROM auth.users 
WHERE email = 'rottiracing@gmail.com';

-- Verify deletion
SELECT * FROM public.profiles WHERE email = 'rottiracing@gmail.com';
-- Should return no rows
```

### Option 3: If You Want to Keep the Auth User but Delete Profile

```sql
-- Delete only the profile (keep auth user for potential re-signup)
DELETE FROM public.profiles 
WHERE email = 'rottiracing@gmail.com';
```

## 📋 Verification Checklist

After cleanup:
- [ ] User deleted from `auth.users`
- [ ] Profile deleted from `public.profiles`
- [ ] No orphaned data remaining
- [ ] Test web signup - should show warning and block creation
- [ ] Test mobile signup - should work normally

## 🔒 GDPR Compliance Restored

With these fixes:
- ✅ Web users **cannot** create accounts
- ✅ Only mobile app users with **active subscriptions** can create accounts
- ✅ No data is stored without paid subscription
- ✅ Profile creation is atomic with subscription verification

## 🚀 Going Forward

### For Testing:
- **Web**: Use `npm run dev` - no subscription required, dev mode
- **Mobile**: Test with real subscription flow

### For Production:
- Web users will see clear message directing them to mobile apps
- Only subscribed mobile users can create accounts
- All new accounts will have proper subscription data

## 📝 What Changed in Code

**File**: `web/src/pages/auth.js`

**Changes**:
1. Added `isNative` check at render time
2. Only shows "Create Account" button on native platforms
3. Shows informational warning on web
4. Blocks signup attempt on web with clear error message
5. Always verifies subscription before signup on native
6. Better error handling for profile creation

**Result**: Web signup is now completely blocked at both UI and logic levels.

## ⚠️ Important Note

The orphaned account (`c244f49b-588c-4631-82d8-a66a2c7cdd52`) should be deleted because:
- It was created without a subscription
- It has no subscription data in the profile
- It violates GDPR compliance (data stored without payment)
- The user never completed the purchase flow

Once deleted, if this user wants to try again, they must:
1. Download mobile app
2. Subscribe (£29.99/year with 1-month trial)
3. Create account after subscription is active
4. Profile will be created WITH subscription data

---

**Status**: Web signup is now blocked. Delete the orphaned account to restore full GDPR compliance.

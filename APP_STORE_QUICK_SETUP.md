# App Store Connect - Quick Setup Guide

## 🎯 You're Here Now

Based on your screenshot, you're at:
```
App Store Connect → BoatMatey → Distribution → Subscriptions → BoatMatey Yearly
```

Status: **"Prepare for Submission"** (needs pricing + trial)

## ⚡ Quick Setup (5 Minutes)

### Step 1: Add Subscription Pricing

**You see this section in your current page**: "Subscription Prices"

1. **Expand or click** the "> Current Pricing for New Subscribers" section
   - Or click the **"+"** icon next to "Subscription Prices"

2. **Add Base Price**:
   - Click **"Add Subscription Price"** or **"+"**
   - Territory: **United Kingdom**
   - Price: **£24.99**
   - Duration: Should already show "1 year"
   - Click **"Add"** or **"Next"**

3. **Auto-Fill Other Territories**:
   - Apple will automatically calculate equivalent prices
   - Review but accept defaults for other regions

4. **Save**:
   - Click **"Save"** in the top right
   - The "Missing Metadata" warning should disappear

### Step 2: Add Free Trial Offer

Still on the same page, scroll down or look for:

**Option A**: "Subscription Offers" section
**Option B**: "Introductory Offers" tab/section
**Option C**: Button that says "+ Offer" or "Create Offer"

1. **Create New Offer**:
   - Click **"+"** or **"Create Offer"**
   - Or click **"Add Offer"** button

2. **Configure Trial**:
   ```
   Offer Type: Free Trial
   Duration: 1 Month
   Eligibility: New Subscribers
   Reference Name: 1 Month Free Trial
   Countries: All (default)
   ```

3. **Save Offer**:
   - Click **"Save"** or **"Create"**
   - Offer should now appear in the list

### Step 3: Review & Save All

1. **Check Status**:
   - Status should no longer show "Missing Metadata"
   - Should show "Ready to Submit" or "Waiting for Review"

2. **Final Save**:
   - Click **"Save"** button (top right of page)
   - Wait for confirmation

## 📋 Verification Checklist

After completing the above, verify:

- [ ] Pricing shows £24.99/year
- [ ] 1-month free trial is listed
- [ ] Status is not "Missing Metadata"
- [ ] Localization still shows:
  - Display Name: "BoatMatey Pro - Annual"
  - Description: "Full access to all BoatMatey features"

## 🚀 Next: Add to App Version

### Step 4: Link Subscription to App Version

1. **Navigate to App Version**:
   - Click **"Distribution"** tab (if not already there)
   - Click on your app version (e.g., "1.0.0")
   - Or go to **"TestFlight"** → Select version

2. **Add In-App Purchase**:
   - Scroll to **"In-App Purchases and Subscriptions"** section
   - Click **"+"** or **"Add"**
   - Select **"BoatMatey Yearly"** (`boatmatey_yearly`)
   - Click **"Done"** or **"Add"**

3. **Save Version**:
   - Scroll to top
   - Click **"Save"** button

### Step 5: Submit for Review

1. **Complete Review Information**:
   - Fill in any remaining required fields
   - Add screenshots if needed
   - Add review notes mentioning the subscription

2. **Submit**:
   - Click **"Submit for Review"** button
   - Confirm submission
   - Wait for Apple's review (typically 24-48 hours)

## 🎯 Alternative Path: Current Pricing Section

If you don't see obvious buttons, look for the section that says:

```
> Current Pricing for New Subscribers
```

Click the **">"** arrow to expand it, then:

1. You should see an empty table or a **"+ Add Pricing"** button
2. Click it to add your £24.99 price
3. Follow the pricing dialog

## 💡 Common Screen Locations

Based on your current screenshot, here's where to find things:

**Subscription Prices**:
- Currently visible in your screenshot
- Has a **"+"** icon next to the heading
- Below it says "Below is a summary of your current pricing..."

**Subscription Offers/Introductory Offers**:
- Usually directly below "Subscription Prices"
- Or in a separate tab at the top (next to "Subscription Prices")
- Look for **"+"** or **"Create Offer"** button

**Family Sharing**:
- You can see this in your screenshot
- Below the pricing section
- Not required for basic setup

## ⚠️ Troubleshooting

### Can't find "Add Price" button?
- Try clicking **"All Prices and Currencies"** link (visible in your screenshot)
- Or click the **"+"** icon next to "Subscription Prices"

### Can't find "Offers" section?
- Look for tabs at the top of the page
- May be labeled "Offers", "Introductory Offers", or "Promotional Offers"
- If not visible, scroll down below the pricing section

### "Save" button is grayed out?
- Make sure you've filled in the price
- Try clicking on the page to ensure focus
- Refresh the page and try again

### Still shows "Missing Metadata"?
- Make sure localization is complete (you have this ✓)
- Add the subscription price (main missing item)
- Wait a few minutes after saving

## 🎉 Success Indicators

You'll know you're done when:

1. ✅ No more "Missing Metadata" warning
2. ✅ Pricing table shows £24.99/year
3. ✅ Free trial offer is listed
4. ✅ Status shows "Ready to Submit" or similar
5. ✅ "Save" button is active (not grayed out)

## 📞 Need Help?

If stuck at any point:

1. **Apple Support**: https://developer.apple.com/contact/
2. **Documentation**: Search "App Store Connect subscription pricing"
3. **RevenueCat Docs**: https://www.revenuecat.com/docs/ios-products

## ⏱️ Time Estimate

- **Add Pricing**: 2 minutes
- **Add Free Trial**: 3 minutes
- **Link to Version**: 5 minutes
- **Submit for Review**: 5 minutes

**Total**: ~15 minutes

---

**Current Location**: You're on the right page!  
**Next Action**: Click the "+" next to "Subscription Prices" to add £24.99  
**After That**: Create the 1-month free trial offer  
**Then**: Link to your app version and submit!

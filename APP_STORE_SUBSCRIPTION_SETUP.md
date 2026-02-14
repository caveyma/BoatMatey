# App Store Connect - Complete iOS Subscription Setup

## Issue: "Missing Metadata" Status

Your iOS subscription `boatmatey_yearly` currently shows "Missing Metadata" in both App Store Connect and RevenueCat. This needs to be resolved before the subscription can work.

## Steps to Complete Setup

### 1. Log into App Store Connect
Go to: https://appstoreconnect.apple.com

### 2. Navigate to Your App
- Select **Apps** from the main menu
- Click on **BoatMatey**

### 3. Go to Subscriptions
- Click the **Distribution** tab
- Select **In-App Purchases and Subscriptions** from the left sidebar
- You should see your subscription group: **BoatMatey Pro**

### 4. Complete the Subscription Details

Click on **BoatMatey Yearly** subscription to edit it.

#### A. Add Localization (Required)

Click the **"Create"** button in the Localization section or add localization for each storefront:

**For UK/English:**
- **Subscription Display Name**: BoatMatey Yearly Premium
- **Description**: 
  ```
  Access all BoatMatey features with unlimited boats, complete service history tracking, digital logbook, haul-out records, and cloud sync across all your devices.
  
  • Unlimited boats and equipment
  • Complete service history tracking
  • Haul-out & maintenance records
  • Digital logbook & calendar
  • Cloud sync across all devices
  • Photo attachments & documentation
  
  £29.99 per year including VAT.
  Cancel anytime.
  ```

Repeat for other languages/regions as needed.

#### B. Set Pricing

1. Click **Subscription Pricing** (or similar section)
2. Set the base price:
   - **Territory**: United Kingdom
   - **Price**: £29.99
   - Apple will automatically calculate equivalent prices for other territories
3. Review and confirm pricing for other regions

#### C. Configure Free Trial

1. Look for **Introductory Offers** or **Promotional Offers** section
2. Click **Create Offer** or **Add Offer**
3. Set up the free trial:
   - **Offer Type**: Free Trial
   - **Duration**: 1 Month
   - **Eligibility**: New Subscribers
   - **Reference Name**: 1 Month Free Trial
4. Save the offer

#### D. Subscription Duration
Verify:
- **Duration**: 1 Year
- **Auto-Renewable**: Yes

### 5. Review Information

Before saving, ensure:
- ✅ Localization is complete (at least English)
- ✅ Pricing is set (£29.99 for UK)
- ✅ Free trial offer is configured (1 month)
- ✅ Product ID is correct: `boatmatey_yearly`
- ✅ Subscription group is: BoatMatey Pro

### 6. Save Changes

Click **Save** at the top right.

### 7. Submit for Review (IMPORTANT)

**Note**: Apple requires that your first subscription be submitted with a new app version.

1. Go to your app version under **TestFlight** or **App Store** tab
2. In the **In-App Purchases and Subscriptions** section on the version page, add your `boatmatey_yearly` subscription
3. Submit the new version with the subscription for App Review

### 8. Verify in RevenueCat

After completing the above:

1. Go to RevenueCat Dashboard: https://app.revenuecat.com
2. Navigate to **Project Settings** → **BoatMatey**
3. Go to **Product Catalog** → **Products**
4. Find `boatmatey_yearly` for App Store
5. Status should update from "Missing Metadata" to "Published" or "Ready"

## Testing in Sandbox

Once metadata is complete:

1. **Create Sandbox Test Account** (if not already done):
   - App Store Connect → Users and Access → Sandbox Testers
   - Create a new tester with a test Apple ID

2. **Test the Subscription**:
   - Build and install app on iOS device or simulator
   - Sign out of App Store (Settings → App Store → Sign Out)
   - Open BoatMatey
   - Try to purchase subscription
   - When prompted, sign in with sandbox test account
   - Complete the purchase (will be free in sandbox)
   - Verify subscription is recognized in app

## Troubleshooting

### Still Showing "Missing Metadata"?
- Wait 15-30 minutes after saving changes (Apple's servers sync)
- Clear RevenueCat cache (Project Settings → Clear Cache)
- Verify product ID matches exactly: `boatmatey_yearly`

### Can't Add Subscription to App Version?
- Make sure you have a binary uploaded for the version
- Subscription must have complete metadata first
- Try creating a new version if needed

### Subscription Not Appearing in Sandbox?
- Verify sandbox tester is signed in on the device
- Check that app is using correct RevenueCat API key
- Ensure offering is configured in RevenueCat with the iOS product

## Next Steps After Completion

1. **Test thoroughly** with sandbox account
2. **Update RevenueCat Offering** to include the iOS product
3. **Submit app** for review with subscription included
4. **Monitor** first real transactions once approved

## Need Help?

- **Apple Documentation**: https://developer.apple.com/documentation/storekit/in-app_purchase
- **RevenueCat Docs**: https://www.revenuecat.com/docs/ios-products
- **RevenueCat Support**: support@revenuecat.com

## Summary Checklist

- [ ] Localization added (name + description)
- [ ] Pricing set to £29.99/year
- [ ] 1-month free trial configured
- [ ] Product ID verified: `boatmatey_yearly`
- [ ] Changes saved in App Store Connect
- [ ] Subscription added to app version
- [ ] App version submitted for review
- [ ] RevenueCat shows "Published" status
- [ ] Tested in sandbox mode
- [ ] RevenueCat offering includes iOS product

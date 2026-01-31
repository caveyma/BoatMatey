# BoatMatey

A mobile-first boat maintenance and logbook management app with subscription-based access. Built with Vite + Capacitor for Android and iOS, with Supabase for cloud sync.

## Features

- **Boat Details**: Store comprehensive boat information including registration, insurance, and specifications
- **Engines**: Manage multiple engines (port, starboard, generator) with warranty tracking
- **Service History**: Track engine services with dates, hours, and notes
- **Haul-out Records**: Complete documentation of haul-outs, antifouling, anodes, and hull inspections
- **Navigation Equipment**: Catalog navigation equipment with warranty information
- **Safety Equipment**: Track safety equipment with expiry dates and service intervals
- **Ship's Log**: Record trips with departure/arrival, engine hours, and distance
- **Calendar**: View all maintenance and service dates in calendar format
- **Photo Attachments**: Upload and store photos for boats, equipment, and service records
- **Cloud Sync**: Sync your data across all devices with Supabase
- **Subscription**: £24.99/year with 1-month free trial for new subscribers

## Subscription Model

BoatMatey requires an active subscription to access the app:
- **Price**: £24.99/year including VAT
- **Free Trial**: 1 month for new subscribers
- **Platforms**: Google Play Store & Apple App Store
- **GDPR Compliant**: No data stored until subscription is active

See [SUBSCRIPTION_QUICK_REFERENCE.md](SUBSCRIPTION_QUICK_REFERENCE.md) for details.

## Tech Stack

- **Vite**: Build tool and dev server
- **Capacitor**: Native mobile app wrapper for Android & iOS
- **Vanilla JavaScript**: No heavy frameworks, modular and maintainable
- **Supabase**: PostgreSQL database with authentication and cloud storage
- **RevenueCat**: Subscription management and billing

## Project Structure (same as PetHub+)

```
BoatMatey/
├── web/            # ← Develop here (all web app source)
│   ├── src/
│   │   ├── pages/       # Page modules (home, boat, engines, etc.)
│   │   ├── components/  # Reusable UI components
│   │   ├── styles/     # Global and component styles
│   │   ├── lib/        # Core libraries (storage, uploads, subscription, etc.)
│   │   ├── router.js
│   │   ├── app.js
│   │   └── main.js
│   ├── public/
│   ├── index.html
│   └── package.json
├── android/        # Android native project (updated via cap copy)
├── ios/            # iOS native project when added (updated via cap copy)
├── capacitor.config.json
└── package.json    # Root scripts: build, cap:android, cap:ios
```

- **Develop in** `web/`. Sync to **android/** and **ios/** when you want a new native build (see below).

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. From repo root, install root and web dependencies:
```bash
npm install
cd web && npm install && cd ..
```

2. Run development server (from `web/`):
```bash
cd web
npm run dev
```

The app will be available at `http://localhost:5173` (or the port Vite assigns).

### Building for Production

From repo root (builds the web app into `web/dist`):
```bash
npm run build
```

Or from `web/`: `npm run build` — creates `web/dist`.

### Syncing to Android or iOS

From **repo root** (builds web then copies into native project):

```bash
npm run cap:android
# or
npm run cap:ios
```

Or build once, then copy only: `npm run sync:android` / `npm run sync:ios`.

### Android Development

1. Sync and open Android Studio:
```bash
npx cap copy android
npx cap open android
```

2. Build and run from Android Studio.

### iOS Development (when configured)

1. Add iOS if not yet added: `npx cap add ios`
2. Sync and open Xcode:
```bash
npx cap copy ios
npx cap open ios
```

## Subscription Setup & Usage

### Overview

BoatMatey requires an active subscription to use the app on mobile devices (Android/iOS). Web development mode bypasses these checks for easier testing.

- **Price**: £24.99/year including VAT
- **Free Trial**: 1 month for new subscribers
- **Platforms**: Google Play Store & Apple App Store
- **Payment Processing**: RevenueCat
- **GDPR Compliant**: No user data stored until subscription is confirmed

### Quick Start

1. **Complete Store Configuration**:
   - Google Play: ✅ Active and configured
   - App Store: ⚠️ Needs metadata completion (see [APP_STORE_SUBSCRIPTION_SETUP.md](APP_STORE_SUBSCRIPTION_SETUP.md))

2. **Configure Environment**:
```bash
cd web
cp .env.example .env.local
# Edit .env.local and add:
# - VITE_SUPABASE_URL
# - VITE_SUPABASE_ANON_KEY
# - VITE_REVENUECAT_API_KEY_IOS
```

3. **RevenueCat Configuration**:
   - **Entitlement ID**: `boatmatey_premium`
   - **Google Play Product**: `boatmatey_premium_yearly:yearly`
   - **App Store Product**: `boatmatey_yearly`

### User Flow

```
Open App → Check Subscription → Purchase/Restore → Create Account → Access App
```

On native platforms:
1. User sees subscription paywall on first launch
2. Purchase subscription (or restore existing)
3. Create account or sign in
4. Full app access granted

On web (development):
- All subscription checks bypassed
- Full access for testing

### Documentation

- **[SUBSCRIPTION_QUICK_REFERENCE.md](SUBSCRIPTION_QUICK_REFERENCE.md)** - Quick reference guide
- **[SUBSCRIPTION_SETUP.md](SUBSCRIPTION_SETUP.md)** - Complete technical documentation
- **[APP_STORE_SUBSCRIPTION_SETUP.md](APP_STORE_SUBSCRIPTION_SETUP.md)** - Fix "Missing Metadata" issue
- **[SUBSCRIPTION_TESTING.md](SUBSCRIPTION_TESTING.md)** - Testing checklist
- **[SUBSCRIPTION_IMPLEMENTATION.md](SUBSCRIPTION_IMPLEMENTATION.md)** - Implementation details

### Testing

**Development (Web)**:
```bash
cd web
npm run dev
# No subscription required - full access
```

**Android Sandbox**:
```bash
npm run cap:android
# Sign in with Google Play test account on device
# Test subscription purchase flow
```

**iOS Sandbox**:
```bash
npm run cap:ios
# Sign in with App Store Connect sandbox tester
# Complete App Store Connect setup first!
```

## Development Notes

- The app uses a hash-based router (`#/route`) for SPA behavior
- All data is stored in localStorage (v1) - structure allows easy migration to Supabase
- File uploads store small images as base64; larger files store metadata for future filesystem integration
- Subscription gating is implemented but store purchases are not yet integrated

## Future Enhancements

- Supabase integration for cloud sync
- Native file storage via Capacitor Filesystem
- RevenueCat integration for subscription management
- Real store purchase implementation
- Multi-boat support (currently single boat in v1)
- Export/import functionality
- Offline-first architecture

## License

Private project - All rights reserved

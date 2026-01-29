# BoatMatey

A mobile-first web app for boat maintenance and logbook management. Built with Vite + Capacitor, runs as a website and inside Capacitor shells for Android/iOS.

## Features

- **Boat Details**: Store comprehensive boat information including registration, insurance, and specifications
- **Engines**: Manage multiple engines (port, starboard, generator) with warranty tracking
- **Service History**: Track engine services with dates, hours, and notes
- **Navigation Equipment**: Catalog navigation equipment with warranty information
- **Safety Equipment**: Track safety equipment with expiry dates and service intervals
- **Ship's Log**: Record trips with departure/arrival, engine hours, and distance
- **Links**: Quick access to useful marine links (Navionics, weather, etc.)
- **Account**: Subscription management and usage tracking

## Tech Stack

- **Vite**: Build tool and dev server
- **Capacitor**: Native mobile app wrapper
- **Vanilla JavaScript**: No heavy frameworks, simple modular code
- **Local Storage**: Data persistence (v1) - designed to be easily swapped with Supabase later

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

## Subscription Model

- **Paid Plan**: £24.99/year (including VAT)
  - Unlimited boats
  - Unlimited engines
  - Unlimited service entries
  - Unlimited uploads

### Mobile subscriptions (Android / iOS)

BoatMatey uses **RevenueCat** with the official Capacitor SDK (`@revenuecat/purchases-capacitor`) to manage
subscriptions across Android and iOS.

- **Entitlement ID** in RevenueCat: `boatmatey_premium`
- **Product ID** in both app stores: e.g. `boatmatey_yearly` (auto-renewing yearly subscription at £24.99/year)

Environment variables (configured in your Vite env file, e.g. `.env`):

```bash
VITE_REVENUECAT_API_KEY_ANDROID=rc_XXXXXXXXXXXXXXXXXXXXXXXXXXXX_android
VITE_REVENUECAT_API_KEY_IOS=rc_XXXXXXXXXXXXXXXXXXXXXXXXXXXX_ios
```

On web / dev server, the app keeps the previous behaviour and treats the subscription as **always active**
so you can develop without needing store sandboxes.

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

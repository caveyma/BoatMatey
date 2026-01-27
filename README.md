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

## Project Structure

```
src/
├── pages/          # Page modules (home, boat, engines, etc.)
├── components/     # Reusable UI components
├── styles/         # Global and component styles
├── lib/            # Core libraries
│   ├── storage.js      # Data persistence layer
│   ├── uploads.js      # File attachment handling
│   └── subscription.js # Subscription gating
├── router.js       # Hash-based router
├── app.js          # App bootstrap
└── main.js         # Entry point
```

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Run development server:
```bash
npm run dev
```

The app will be available at `http://localhost:5173` (or the port Vite assigns).

### Building for Production

Build the app for production:
```bash
npm run build
```

This creates a `dist` folder with the production build.

### Android Development

1. Sync Capacitor with your build:
```bash
npx cap sync android
```

2. Open Android Studio:
```bash
npx cap open android
```

3. Build and run from Android Studio

### iOS Development (when configured)

1. Sync Capacitor:
```bash
npx cap sync ios
```

2. Open Xcode:
```bash
npx cap open ios
```

## Subscription Model

- **Free Plan**: Limited features
  - 1 boat
  - 1 engine
  - 10 service history entries
  - 10 file uploads total

- **Paid Plan**: £24.99/year
  - Unlimited boats
  - Unlimited engines
  - Unlimited service entries
  - Unlimited uploads

*Note: Store integration (Google Play / Apple App Store) is placeholder for v1. In development mode, you can simulate an active subscription from the Account page.*

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

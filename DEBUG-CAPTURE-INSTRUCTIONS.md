# Troubleshooting: Capture diagnostic logs for BoatMatey

Diagnostic logging is now added to the app. Follow these steps so we can see exactly where execution stops.

## 1. Sync and run the app

From the project root (BoatMatey):

```bash
npm run build
npx cap sync android
```

Then in **Android Studio**:

- Uninstall the app from the emulator/device (if already installed).
- **Build → Rebuild Project**
- Run the app on the emulator (e.g. Pixel 7 API 33).
- Leave the app open on the white loading screen for **at least 15 seconds**.

## 2. Capture Logcat (diagnostic lines only)

In **Android Studio**, open **Logcat** (bottom panel).

**Option A – Filter by tag (easiest)**  
In the Logcat filter box enter:

```
BM-DBG
```

Then use the dropdown next to the filter to choose **“Regex”** (or keep “Show only selected application” and add a second filter for the text `BM-DBG` if your version supports it).

**Option B – Filter by package**  
Set the Logcat dropdown to show **“com.boatmatey.app”** only, then in the search/filter box search for:

```
BM-DBG
```

**Option C – No filter**  
Leave Logcat unfiltered, run the app, then after 15 seconds copy the full Logcat output and search in a text editor for `BM-DBG`.

## 3. Copy and share the `[BM-DBG]` lines

Copy **every line that contains `[BM-DBG]`** from the moment you launch the app until ~15 seconds after the loading screen appears.

Paste those lines here (or into a file and share). The order of these lines will show:

- Whether `main.js` runs and calls `init()`
- Whether `app.js init()` runs and reaches `initRouter()`
- Whether the router runs and what `pathname` / `hash` it sees
- Whether `loadRoute()` is called and with which path
- Whether `checkAccess()` runs and whether `getSessionWithTimeout` completes or times out
- Whether we redirect to `/welcome` and whether we try to render the page
- Any **UNCAUGHT ERROR** or **UNHANDLED REJECTION** (these are critical)

## 4. Optional: full Logcat for your app

If you can, also capture a **full Logcat** for the app (no text filter, but package filter **com.boatmatey.app**) from app launch until ~15 seconds on the loading screen. That helps spot any native or Capacitor errors that don’t use the `[BM-DBG]` prefix.

---

After you share the `[BM-DBG]` lines (and optionally the full app Logcat), we can pinpoint where the flow stops and fix it.

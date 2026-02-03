# BoatMatey – Git sync (Windows ↔ Mac Mini)

Same folder structure as PetHub+: **web/** (develop here), **android/** (Android build), **ios/** (iOS build). Push from Windows, pull on Mac Mini, then sync to native folders when you want a new build.

---

## Folder structure

| Folder     | Purpose |
|------------|--------|
| **web/**   | All web app source. You develop here: run `npm run dev`, edit code, commit. |
| **android/** | Android native project. Gets updated when you run `npm run cap:android` (or `npx cap copy android`) from repo root. |
| **ios/**   | iOS native project (when added). Gets updated when you run `npm run cap:ios` (or `npx cap copy ios`) from repo root. **The `ios/` folder must be created once on the Mac Mini** — see [IOS_SETUP.md](IOS_SETUP.md). |

- **Develop in** `web/` (run `cd web && npm run dev`, edit files in `web/src`, etc.).
- **Sync to native** when you want a new Android/iOS build: from repo root run `npm run cap:android` or `npm run cap:ios` (builds web then copies into android/ or ios/).
- **Git**: push and pull from the **repo root** (BoatMatey). Your commits include `web/`, `android/`, and `ios/`; after pull on the other machine, run sync again if you need a fresh native build there.

**Important:** The built web app (`web/dist` and `ios/App/App/public`) is **not** in Git (gitignored). So after every pull on the Mac you **must** run `npm run cap:ios` from the repo root to build the web app and copy it into the iOS project. Otherwise the Mac will still be serving an old build.

---

## On Windows (this machine)

### 1. Work in web/

```powershell
cd c:\Users\marti\DevProjects\AndroidStudioProjects\BoatMatey\web
npm install
npm run dev
# Edit code in web/src, etc.
```

### 2. When ready to sync to Android (or iOS)

From repo root:

```powershell
cd c:\Users\marti\DevProjects\AndroidStudioProjects\BoatMatey
npm install
npm run cap:android
# Or: npm run cap:ios
```

### 3. Stage, commit, push

```powershell
cd c:\Users\marti\DevProjects\AndroidStudioProjects\BoatMatey
git add -A
git status
git commit -m "Your message"
git push origin main
```

---

## On Mac Mini (first time – clone)

```bash
cd ~/DevProjects
git clone https://github.com/caveyma/BoatMatey.git
cd BoatMatey
npm install
cd web && npm install && cd ..
```

Then run/build the app as you normally do. When you want a native build: from repo root run `npm run cap:android` or `npm run cap:ios`.

---

## On Mac Mini (already cloned – pull)

**Do this every time** so the app build is up to date (the built app is not in Git):

```bash
cd /path/to/BoatMatey
git pull origin main
npm install
cd web && npm install && cd ..
# Required: build web and copy into iOS (otherwise you'll see an old build)
npm run cap:ios
```

Then in Xcode: **Product → Clean Build Folder** (Shift+Cmd+K), then build/run. If the app still looks old on device/simulator, delete the app and reinstall.

**Or run the script** (after pulling at least once so the script exists): from repo root run `bash scripts/mac-pull-and-build.sh` — it does pull, install, and `cap:ios` for you.

---

## Quick reference

| Action           | Where / Command |
|------------------|-----------------|
| Develop          | `cd web` → `npm run dev` |
| Build web        | From root: `npm run build` (or from web: `npm run build`) |
| Sync to Android  | From root: `npm run cap:android` |
| Sync to iOS      | From root: `npm run cap:ios` |
| Send changes     | From root: `git add -A` → `git commit -m "..."` → `git push origin main` |
| Get changes (Mac) | From root: `git pull origin main` → `npm install` → `cd web && npm install` → **`npm run cap:ios`** (required; built app not in Git) |

Remote: **https://github.com/caveyma/BoatMatey.git**

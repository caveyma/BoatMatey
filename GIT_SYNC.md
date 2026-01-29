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

```bash
cd /path/to/BoatMatey
git pull origin main
npm install
cd web && npm install
```

If you need a fresh Android or iOS build after pull, from repo root run:

```bash
npm run cap:android
# or
npm run cap:ios
```

---

## Quick reference

| Action           | Where / Command |
|------------------|-----------------|
| Develop          | `cd web` → `npm run dev` |
| Build web        | From root: `npm run build` (or from web: `npm run build`) |
| Sync to Android  | From root: `npm run cap:android` |
| Sync to iOS      | From root: `npm run cap:ios` |
| Send changes     | From root: `git add -A` → `git commit -m "..."` → `git push origin main` |
| Get changes      | From root: `git pull origin main` then `npm install` (and `cd web && npm install` if needed) |

Remote: **https://github.com/caveyma/BoatMatey.git**

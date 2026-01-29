# iOS folder – one-time setup on Mac Mini

You **cannot** create the `ios/` folder on Windows. Capacitor requires macOS (Xcode) to add the iOS platform. Do this once on the Mac Mini, then both machines will have the same folder structure via Git.

---

## One-time: on Mac Mini

1. Open the repo and install deps if needed:
   ```bash
   cd /path/to/BoatMatey
   npm install
   cd web && npm install && cd ..
   ```

2. Build web and add the iOS platform:
   ```bash
   npm run build
   npx cap add ios
   ```

3. Commit and push so the `ios/` folder is in the repo:
   ```bash
   git add -A
   git commit -m "Add iOS platform (ios/ folder)"
   git push origin main
   ```

---

## After that: on Windows

1. Pull so you get the `ios/` folder:
   ```bash
   cd c:\Users\marti\DevProjects\AndroidStudioProjects\BoatMatey
   git pull origin main
   npm install
   ```

2. You now have **web/**, **android/**, and **ios/** on both machines.

3. On Windows you can run **`npm run cap:ios`** (or `npx cap copy ios`) to copy the built web app into `ios/`. You can’t build or run the iOS app on Windows, but the folder stays in sync. When you push and the Mac pulls, the Mac has the latest web content inside `ios/` and can build in Xcode.

---

## Summary

| Action              | Windows                    | Mac Mini                          |
|---------------------|----------------------------|-----------------------------------|
| Create `ios/`       | ❌ Not possible            | ✅ Once: `npx cap add ios` then push |
| Copy web into `ios/`| ✅ `npm run cap:ios`       | ✅ `npm run cap:ios`              |
| Build / run iOS app | ❌ Need Xcode (Mac only)   | ✅ Open `ios/` in Xcode, build    |

After the one-time add on the Mac and a push/pull, the folder structure is the same on both: **web/**, **android/**, **ios/**.

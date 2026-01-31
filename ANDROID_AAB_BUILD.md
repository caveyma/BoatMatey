# Building the Android App Bundle (AAB) for Google Play

Use this to produce a **release AAB** for upload to Google Play (e.g. Closed testing). The app includes RevenueCat and Google Play Billing so subscriptions can be created in Play Console.

## Prerequisites

- **Node.js** (v16+)
- **Java 17** (for Android build; Android Studio installs it)
- **Android SDK** (via Android Studio or command-line tools)

## Important: run from repo root

All commands below must be run from the **repo root** (the folder that contains `web/`, `android/`, and the root `package.json`). If you run `npm run build` from inside `web/` or another folder, you may see **"Missing script: build"** — fix it by `cd`-ing to the repo root first.

## Commands to generate the AAB (from repo root)

**Bash / CMD (one command per line, or use `&&` to chain):**

```bash
# 1. Install dependencies (root + web)
npm install
cd web; npm install; cd ..

# 2. Build the web app (must be from root — runs "cd web && npm run build")
npm run build

# 3. Sync Capacitor (copies web/dist to Android and registers RevenueCat plugin)
npx cap sync android

# 4. Build the release AAB
cd android
./gradlew bundleRelease
```

**PowerShell (Windows):** PowerShell does not support `&&`. Use `;` to chain, or run one command at a time:

```powershell
npm install
cd web; npm install; cd ..
npm run build
npx cap sync android
cd android
.\gradlew.bat bundleRelease
```

On **Windows** use `gradlew.bat` (and `.\gradlew.bat` in PowerShell):

```powershell
cd android
.\gradlew.bat bundleRelease
```

## Output path of the AAB

After a successful build:

- **Path:** `android/app/build/outputs/bundle/release/app-release.aab`
- **Full path (example):**  
  `BoatMatey/android/app/build/outputs/bundle/release/app-release.aab`

Upload this `.aab` file in Google Play Console → Your app → **Production** or **Testing** → **Create new release** → upload the AAB.

## One-liner (from repo root)

**Bash / CMD:**
```bash
npm install && cd web && npm install && cd .. && npm run build && npx cap sync android && cd android && gradlew.bat bundleRelease
```

**PowerShell:** use `;` instead of `&&`:
```powershell
npm install; cd web; npm install; cd ..; npm run build; npx cap sync android; cd android; .\gradlew.bat bundleRelease
```

(Use `./gradlew bundleRelease` on macOS/Linux.)

## Using Android Studio instead

1. Open the Android project:  
   `npx cap open android`  
   (or open the `android` folder in Android Studio.)
2. **Build → Generate Signed Bundle / APK** → **Android App Bundle** → **release**.
3. Follow the wizard (create or choose keystore, then build).  
   The AAB will be written to the path above (or the location you chose in the wizard).

## Troubleshooting

- **"The token '&&' is not a valid statement separator"**  
  You're in **PowerShell**. Use `;` instead of `&&` to chain commands, or run each command on its own line (see PowerShell block above).

- **"Missing script: build"**  
  You're not in the **repo root**. Change to the folder that contains `web/` and `android/` (and the root `package.json` that has `"build": "cd web && npm run build"`), then run `npm run build` again.

## Version (for this build)

- **versionCode:** 5  
- **versionName:** 4.0.1  

Defined in `android/app/build.gradle`. Bumped so Play Console accepts a new upload and can detect billing.

# BoatMatey – Git sync (Windows ↔ Mac Mini)

Same workflow as PetHub+: **push** on Windows, **pull** on Mac Mini.

---

## On Windows (this machine)

### 1. Stage and commit your work

```powershell
cd c:\Users\marti\DevProjects\AndroidStudioProjects\BoatMatey

# Stage everything (modified + new files)
git add -A

# Check what will be committed
git status

# Commit with a message
git commit -m "Sync to Mac: latest changes, privacy, calendar, guide, haulout, assets"
```

### 2. Push to GitHub

```powershell
git push origin main
```

If you use another branch, replace `main` with that branch name.

---

## On Mac Mini (first time – clone)

If BoatMatey is **not** on the Mac yet:

```bash
cd ~/DevProjects   # or wherever you keep projects
git clone https://github.com/caveyma/BoatMatey.git
cd BoatMatey
npm install
```

Then run/build the app as you normally do on Mac.

---

## On Mac Mini (already cloned – pull)

If you already have the repo on the Mac:

```bash
cd /path/to/BoatMatey   # e.g. ~/DevProjects/BoatMatey
git pull origin main
npm install   # if package.json or package-lock.json changed
```

---

## Quick reference

| Action        | Windows                    | Mac Mini                          |
|---------------|----------------------------|-----------------------------------|
| Send changes  | `git add -A` → `git commit -m "..."` → `git push origin main` | —                                 |
| Get changes   | —                          | `git pull origin main` then `npm install` if needed |

Remote: **https://github.com/caveyma/BoatMatey.git**

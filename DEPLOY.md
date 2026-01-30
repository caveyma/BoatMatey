# Deploying BoatMatey to Cloudflare Pages

The web app is deployed as a static site to **Cloudflare Pages**. The site will be available at `https://boatmatey.pages.dev` (or your custom domain if configured).

## One-time setup

1. **Log in to Cloudflare** (creates a session for Wrangler):
   ```bash
   npx wrangler login
   ```
   A browser window will open to authenticate with your Cloudflare account.

2. **Create the Pages project** (only if this is the first deploy):
   ```bash
   npx wrangler pages project create boatmatey
   ```
   If you use a different project name, change `--project-name=boatmatey` in the deploy script in `package.json` to match.

## Deploy

From the **repository root**:

```bash
npm run deploy:cloudflare
```

This will:

1. Run `npm run build:cloudflare` (same as Cloudflare: `cd web && npm ci && npm run build`, output `web/dist`)
2. Deploy `web/dist` to Cloudflare Pages with project name `boatmatey`

After a successful deploy, Wrangler prints the live URL (e.g. `https://boatmatey.pages.dev`).

## Environment variables (required for Supabase)

The app bakes `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` into the build at **build time**. If these are missing, the live site will show "Supabase is not configured."

### If you deploy with Wrangler (`npm run deploy:cloudflare`)

Put the variables in `web/.env.local` (see `web/.env.example`). The build runs on your machine and will read that file. Then run:

```bash
npm run deploy:cloudflare
```

### If you deploy via Git (Cloudflare connected to your repo)

The build runs on Cloudflare’s servers and **does not** see your local `web/.env.local` (it’s gitignored). You must set them in the dashboard:

1. Open **Cloudflare Dashboard** → **Workers & Pages** → **Pages** → your project (e.g. **boatmatey**).
2. Go to **Settings** → **Environment variables**.
3. Under **Build configuration** (or **Production** / **Preview**), click **Add variable**.
4. Add:
   - **Variable name:** `VITE_SUPABASE_URL`  
     **Value:** `https://YOUR-PROJECT-REF.supabase.co`
   - **Variable name:** `VITE_SUPABASE_ANON_KEY`  
     **Value:** your Supabase anon key (JWT starting with `eyJ...` from **Supabase** → Project Settings → API → anon public).
5. **Save** and trigger a new deploy (e.g. push a commit or **Create deployment** from the **Deployments** tab).

Without these Build env vars, the deployed app will always show "Supabase is not configured."

## Optional: Git-based deployments

Instead of `deploy:cloudflare`, you can connect the repo in the Cloudflare dashboard:

1. **Pages** → **Create a project** → **Connect to Git** → select this repo.
2. **Build settings**:
   - **Build command:** `cd web && npm install && npm run build`
   - **Build output directory:** `web/dist`
3. **Environment variables:** Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under Build (see **Environment variables** above). Without these, the deployed app will show "Supabase is not configured."
4. Save; each push to the selected branch will trigger a build and deploy.

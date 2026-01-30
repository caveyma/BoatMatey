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

## Environment variables

If the app needs env vars at build time (e.g. `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`), set them in your shell or in a `.env` file in `web/` before running `npm run deploy:cloudflare`. For Cloudflare Pages you can also configure **Build environment variables** in the dashboard (Cloudflare Dashboard → Pages → your project → Settings → Environment variables) if you switch to Git-based deployments.

## Optional: Git-based deployments

Instead of `deploy:cloudflare`, you can connect the repo in the Cloudflare dashboard:

1. **Pages** → **Create a project** → **Connect to Git** → select this repo.
2. **Build settings**:
   - **Build command:** `cd web && npm install && npm run build`
   - **Build output directory:** `web/dist`
3. Save; each push to the selected branch will trigger a build and deploy.

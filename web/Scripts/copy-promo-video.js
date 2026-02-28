/**
 * Copy promo video from web/assets to web/public/assets with a hyphenated filename.
 * Hyphenated name avoids HTTP 416 (Range Not Satisfiable) on Cloudflare/static hosts.
 * Cloudflare Pages allows files up to 25 MiB; we fail if the video is >= 25 MiB.
 */
import { copyFileSync, existsSync, mkdirSync, statSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Use 24 MiB to stay under Cloudflare's 25 MiB limit (Windows "23.9 MB" can be 23.9 MiB ≈ 25.06 MiB and get rejected).
const MAX_SIZE_MIB = 24;
const MAX_SIZE_BYTES = MAX_SIZE_MIB * 1024 * 1024;

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const assetsDir = join(root, 'assets');
// Try both names so the script finds the file whether it's "Creating a new Boat.mp4" or "creating-a-new-boat.mp4"
const src = existsSync(join(assetsDir, 'Creating a new Boat.mp4'))
  ? join(assetsDir, 'Creating a new Boat.mp4')
  : join(assetsDir, 'creating-a-new-boat.mp4');
const dest = join(root, 'public', 'assets', 'creating-a-new-boat.mp4');

if (existsSync(src)) {
  const size = statSync(src).size;
  if (size >= MAX_SIZE_BYTES) {
    const sizeMiB = (size / 1024 / 1024).toFixed(2);
    console.error(
      `BoatMatey: promo video is ${sizeMiB} MiB. Cloudflare Pages allows files up to 25 MiB; this script allows up to ${MAX_SIZE_MIB} MiB to stay under that. ` +
      'Compress the video (e.g. with FFmpeg: lower bitrate or 720p) so it is under 24 MiB, then rebuild.'
    );
    process.exit(1);
  }
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  console.log('BoatMatey: copied promo video to public/assets/creating-a-new-boat.mp4');
} else {
  console.warn('BoatMatey: promo video not found at web/assets/ (looked for "Creating a new Boat.mp4" or "creating-a-new-boat.mp4") (optional)');
}

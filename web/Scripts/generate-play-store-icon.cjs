/**
 * Generates a 512x512 PNG app icon for Google Play Store.
 * Requirements: PNG or JPEG, up to 1 MB, 512 x 512 px.
 * Run from repo root: node web/scripts/generate-play-store-icon.cjs
 */

const { createCanvas, loadImage } = require('canvas');
const path = require('path');
const fs = require('fs');

const SIZE = 512;

// Paths relative to project root (where we run the script from)
const projectRoot = path.resolve(__dirname, '..', '..');
const sourceIcon = path.join(projectRoot, 'android', 'app', 'src', 'main', 'assets', 'public', 'icon.png');
const outputDir = path.join(projectRoot, 'store-assets');
const outputPath = path.join(outputDir, 'icon-512.png');

async function main() {
  if (!fs.existsSync(sourceIcon)) {
    console.error('Source icon not found at:', sourceIcon);
    process.exit(1);
  }

  const img = await loadImage(sourceIcon);
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, SIZE, SIZE);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const buf = canvas.toBuffer('image/png', { compressionLevel: 6 });
  fs.writeFileSync(outputPath, buf);

  const sizeKB = (buf.length / 1024).toFixed(1);
  const maxMB = 1;
  if (buf.length > maxMB * 1024 * 1024) {
    console.warn(`Warning: file size ${sizeKB} KB exceeds ${maxMB} MB. Consider reducing quality.`);
  }
  console.log(`Created ${outputPath} (512×512, ${sizeKB} KB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import sharp from 'sharp';
import { mkdirSync } from 'fs';

const SRC = '/Users/uhayato/Documents/workspace/TimeLaminator/dev/assets/icon-source/app-icon-master.png';
const OUT = '/Users/uhayato/Documents/workspace/TimeLaminator/dev/public/icons';
const BG = '#ffffff';

// SRC is a 1024x1024 export from a macOS .icns, which already follows the
// mac icon grid convention (~80% content within the canvas, transparent
// margin around it) — that happens to match the PWA maskable safe-zone, so
// no extra inset is needed here.

mkdirSync(OUT, { recursive: true });

async function transparent(size, name) {
  await sharp(SRC).resize(size, size).png().toFile(`${OUT}/${name}`);
}

// apple-touch-icon and maskable icons must be opaque: iOS renders
// transparent areas as black, and OS adaptive-icon masks expect full bleed.
async function opaque(size, name) {
  const iconBuf = await sharp(SRC).resize(size, size).toBuffer();

  await sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: iconBuf, gravity: 'center' }])
    .png()
    .toFile(`${OUT}/${name}`);
}

await transparent(192, 'icon-192.png');
await transparent(512, 'icon-512.png');
await opaque(180, 'apple-touch-icon.png');
await opaque(512, 'icon-maskable-512.png');
await transparent(32, 'favicon-32.png');

console.log('done');

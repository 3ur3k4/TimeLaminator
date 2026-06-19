import sharp from 'sharp';
import { mkdirSync } from 'fs';

const SRC = '/Users/uhayato/Documents/workspace/TimeLaminator/dev/assets/icon-source/app-icon-master.png';
const OUT = '/Users/uhayato/Documents/workspace/TimeLaminator/dev/public/icons';
const BG = '#ffffff';

// SRC is a 1024x1024 export from a macOS .icns. Measured directly: its
// content is full-bleed (opaque edge-to-edge except for the rounded corner
// curvature) with no built-in safe margin. Every consumer (Android adaptive
// mask, iOS, macOS Dock via Chrome's PWA install) crops/rounds on top of
// whatever we hand it, so we inset the artwork ourselves to leave a safe
// margin — otherwise it gets double-rounded and the edges look cropped/zoomed.
const SAFE_ZONE = 0.8;

mkdirSync(OUT, { recursive: true });

async function transparent(size, name, scale = SAFE_ZONE) {
  const inner = Math.round(size * scale);
  const iconBuf = await sharp(SRC)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: iconBuf, gravity: 'center' }])
    .png()
    .toFile(`${OUT}/${name}`);
}

// apple-touch-icon and maskable icons must be opaque: iOS renders
// transparent areas as black, and OS adaptive-icon masks expect full bleed.
async function opaque(size, name, scale = SAFE_ZONE) {
  const inner = Math.round(size * scale);
  const iconBuf = await sharp(SRC)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

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
await transparent(32, 'favicon-32.png', 0.9);

console.log('done');

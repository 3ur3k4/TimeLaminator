import sharp from 'sharp';
import { mkdirSync } from 'fs';

const SRC = '/Users/uhayato/Documents/workspace/TimeLaminator/dev/public/favicon.svg';
const OUT = '/Users/uhayato/Documents/workspace/TimeLaminator/dev/public/icons';
const BG = '#ffffff';

mkdirSync(OUT, { recursive: true });

async function plain(size, name) {
  await sharp(SRC, { density: 384 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(`${OUT}/${name}`);
}

// apple-touch-icon must be opaque: iOS renders transparent areas as black.
async function appleTouchIcon(size, name) {
  const inner = Math.round(size * 0.82);
  const iconBuf = await sharp(SRC, { density: 384 })
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: iconBuf, gravity: 'center' }])
    .png()
    .toFile(`${OUT}/${name}`);
}

// Maskable icons need the artwork inset into a safe zone (~80% of canvas)
// since OS masks can crop up to ~20% from any edge.
async function maskable(size, name) {
  const inner = Math.round(size * 0.7);
  const iconBuf = await sharp(SRC, { density: 384 })
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: iconBuf, gravity: 'center' }])
    .png()
    .toFile(`${OUT}/${name}`);
}

await plain(192, 'icon-192.png');
await plain(512, 'icon-512.png');
await appleTouchIcon(180, 'apple-touch-icon.png');
await maskable(512, 'icon-maskable-512.png');

console.log('done');

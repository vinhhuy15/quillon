// Renders the SciForge app icon (1024×1024 PNG) without any image library.
// Usage: node scripts/make-icon.mjs  → apps/desktop/src-tauri/icons/source.png
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SIZE = 1024;
const S = SIZE / 64; // design grid is 64×64 (same as public/favicon.svg)
const BG = [0x43, 0x38, 0xca];
const SIGMA = [[18, 16], [46, 16], [46, 22], [27, 22], [39, 32], [27, 42], [46, 42], [46, 48], [18, 48], [18, 43], [31, 32], [18, 21]];

function inRoundRect(x, y, r = 14) {
  const cx = Math.min(Math.max(x, r), 64 - r);
  const cy = Math.min(Math.max(y, r), 64 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

function inPolygon(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const SS = 4; // supersampling per axis
const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
for (let py = 0; py < SIZE; py++) {
  raw[py * (SIZE * 4 + 1)] = 0; // filter: none
  for (let px = 0; px < SIZE; px++) {
    let cover = 0, white = 0;
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const x = (px + (sx + 0.5) / SS) / S;
        const y = (py + (sy + 0.5) / SS) / S;
        if (!inRoundRect(x, y)) continue;
        cover++;
        if (inPolygon(x, y, SIGMA)) white++;
      }
    }
    const n = SS * SS;
    const a = cover / n;
    const w = cover ? white / cover : 0;
    const o = py * (SIZE * 4 + 1) + 1 + px * 4;
    raw[o] = Math.round(BG[0] + (255 - BG[0]) * w);
    raw[o + 1] = Math.round(BG[1] + (255 - BG[1]) * w);
    raw[o + 2] = Math.round(BG[2] + (255 - BG[2]) * w);
    raw[o + 3] = Math.round(255 * a);
  }
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // RGBA
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'desktop', 'src-tauri', 'icons', 'source.png');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, png);
console.log('Wrote', out);

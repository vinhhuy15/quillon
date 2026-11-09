/**
 * Read/write UTF-8 text chunks (iTXt) in PNG files. Quillon stores the
 * equation source in exported PNGs so they can be re-opened and edited.
 */

const SIG = [137, 80, 78, 71, 13, 10, 26, 10];

let CRC_TABLE: Uint32Array | null = null;
function crc32(bytes: Uint8Array): number {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function isPng(bytes: Uint8Array): boolean {
  return bytes.length > 8 && SIG.every((b, i) => bytes[i] === b);
}

interface Chunk {
  type: string;
  start: number; // offset of length field
  dataStart: number;
  length: number;
}

function chunks(png: Uint8Array): Chunk[] {
  if (!isPng(png)) throw new Error('Not a PNG file');
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const out: Chunk[] = [];
  let p = 8;
  while (p + 12 <= png.length) {
    const length = view.getUint32(p);
    const type = String.fromCharCode(...png.subarray(p + 4, p + 8));
    out.push({ type, start: p, dataStart: p + 8, length });
    p += 12 + length;
    if (type === 'IEND') break;
  }
  return out;
}

/** Insert (or replace) an iTXt chunk with the given keyword, right after IHDR. */
export function setPngText(png: Uint8Array, keyword: string, value: string): Uint8Array {
  const enc = new TextEncoder();
  const list = chunks(png).filter((c) => !(c.type === 'iTXt' && readITxt(png, c)?.keyword === keyword));
  const kw = enc.encode(keyword);
  const txt = enc.encode(value);
  // keyword \0 compressionFlag(0) compressionMethod(0) languageTag \0 translatedKeyword \0 text
  const data = new Uint8Array(kw.length + 5 + txt.length);
  data.set(kw, 0);
  data.set(txt, kw.length + 5);
  const typeAndData = new Uint8Array(4 + data.length);
  typeAndData.set(enc.encode('iTXt'), 0);
  typeAndData.set(data, 4);
  const chunk = new Uint8Array(12 + data.length);
  const dv = new DataView(chunk.buffer);
  dv.setUint32(0, data.length);
  chunk.set(typeAndData, 4);
  dv.setUint32(8 + data.length, crc32(typeAndData));

  const parts: Uint8Array[] = [png.subarray(0, 8)];
  for (const c of list) {
    parts.push(png.subarray(c.start, c.dataStart + c.length + 4));
    if (c.type === 'IHDR') parts.push(chunk);
  }
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function readITxt(png: Uint8Array, c: Chunk): { keyword: string; text: string } | null {
  const d = png.subarray(c.dataStart, c.dataStart + c.length);
  const z1 = d.indexOf(0);
  if (z1 < 0) return null;
  const keyword = new TextDecoder('latin1').decode(d.subarray(0, z1));
  const compressed = d[z1 + 1];
  if (compressed) return null; // we never write compressed chunks
  const z2 = d.indexOf(0, z1 + 3);
  const z3 = d.indexOf(0, z2 + 1);
  if (z2 < 0 || z3 < 0) return null;
  return { keyword, text: new TextDecoder().decode(d.subarray(z3 + 1)) };
}

/** All uncompressed iTXt/tEXt entries in a PNG. */
export function getPngTexts(png: Uint8Array): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of chunks(png)) {
    if (c.type === 'iTXt') {
      const r = readITxt(png, c);
      if (r) out[r.keyword] = r.text;
    } else if (c.type === 'tEXt') {
      const d = png.subarray(c.dataStart, c.dataStart + c.length);
      const z = d.indexOf(0);
      if (z > 0) {
        const dec = new TextDecoder('latin1');
        out[dec.decode(d.subarray(0, z))] = dec.decode(d.subarray(z + 1));
      }
    }
  }
  return out;
}

/** Set the physical resolution (pHYs chunk) so Word, Illustrator and journals size the image correctly. */
export function setPngDpi(png: Uint8Array, dpi: number): Uint8Array {
  const ppm = Math.round(dpi / 0.0254);
  const typeAndData = new Uint8Array(4 + 9);
  typeAndData.set([0x70, 0x48, 0x59, 0x73], 0); // "pHYs"
  const dv = new DataView(typeAndData.buffer);
  dv.setUint32(4, ppm);
  dv.setUint32(8, ppm);
  typeAndData[12] = 1; // unit: metre
  const chunk = new Uint8Array(12 + 9);
  const cv = new DataView(chunk.buffer);
  cv.setUint32(0, 9);
  chunk.set(typeAndData, 4);
  cv.setUint32(17, crc32(typeAndData));
  const list = chunks(png).filter((c) => c.type !== 'pHYs');
  const parts: Uint8Array[] = [png.subarray(0, 8)];
  for (const c of list) {
    parts.push(png.subarray(c.start, c.dataStart + c.length + 4));
    if (c.type === 'IHDR') parts.push(chunk);
  }
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** DPI from a PNG's pHYs chunk, or null. */
export function getPngDpi(png: Uint8Array): number | null {
  const c = chunks(png).find((x) => x.type === 'pHYs');
  if (!c || c.length < 9) return null;
  const dv = new DataView(png.buffer, png.byteOffset + c.dataStart, 9);
  return dv.getUint8(8) === 1 ? Math.round(dv.getUint32(0) * 0.0254) : null;
}

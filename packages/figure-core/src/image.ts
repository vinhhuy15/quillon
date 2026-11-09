/**
 * Embedded images: crop, colour adjustments and scale bars, rendered as plain SVG
 * (clipPath + filter) so the canvas, SVG/PNG export and Word figures all match.
 */
import type { ImageCrop, ImageNode, ScaleBar } from '@quillon/doc-model';
import { escapeXml } from '@quillon/math-core';
import { fmt } from './geom';

const FULL: ImageCrop = { x: 0, y: 0, width: 1, height: 1 };

export const cropOf = (n: Pick<ImageNode, 'crop'>): ImageCrop => n.crop ?? FULL;

/** Display pixels per natural image pixel, horizontally and vertically. */
export function imageScale(n: Pick<ImageNode, 'crop' | 'width' | 'height' | 'naturalWidth' | 'naturalHeight'>): { sx: number; sy: number } {
  const c = cropOf(n);
  return { sx: n.width / (c.width * n.naturalWidth), sy: n.height / (c.height * n.naturalHeight) };
}

/** Linear transfer for brightness, then contrast around mid-grey, then optional inversion. */
export function toneTransfer(n: Pick<ImageNode, 'brightness' | 'contrast' | 'invert'>): { slope: number; intercept: number } | null {
  const b = n.brightness / 100, c = n.contrast / 100;
  let slope = b * c, intercept = 0.5 * (1 - c);
  if (n.invert) {
    slope = -slope;
    intercept = 1 - intercept;
  }
  return slope === 1 && intercept === 0 ? null : { slope, intercept };
}

export function hasAdjustments(n: ImageNode): boolean {
  return n.brightness !== 100 || n.contrast !== 100 || n.saturation !== 100 || !!n.grayscale || !!n.invert;
}

/** Safe fragment for SVG ids. */
const idPart = (id: string) => id.replace(/[^A-Za-z0-9_-]/g, '_');

function filterMarkup(n: ImageNode, id: string): string {
  const parts: string[] = [];
  const sat = n.grayscale ? 0 : n.saturation / 100;
  if (sat !== 1) parts.push(`<feColorMatrix type="saturate" values="${fmt(sat)}"/>`);
  const tone = toneTransfer(n);
  if (tone) {
    const f = (ch: string) => `<feFunc${ch} type="linear" slope="${fmt(tone.slope)}" intercept="${fmt(tone.intercept)}"/>`;
    parts.push(`<feComponentTransfer>${f('R')}${f('G')}${f('B')}</feComponentTransfer>`);
  }
  return parts.length ? `<filter id="${id}" color-interpolation-filters="sRGB" x="0" y="0" width="1" height="1">${parts.join('')}</filter>` : '';
}

/** Format a scale-bar length: "10 µm", "0.5 mm". */
export function scaleBarText(b: Pick<ScaleBar, 'length' | 'unit'>): string {
  const v = Number(b.length.toPrecision(4));
  return `${v} ${b.unit}`.trim();
}

/** Bar geometry inside the image box (local coordinates). */
export function scaleBarGeometry(n: ImageNode, b: ScaleBar): { x: number; y: number; width: number; thickness: number; fontSize: number; labelY: number } {
  const { sx } = imageScale(n);
  const width = (b.length / b.unitsPerPixel) * sx;
  const short = Math.min(n.width, n.height);
  const margin = Math.max(6, short * 0.04);
  const thickness = Math.max(2, Math.min(8, short * 0.018));
  const fontSize = Math.max(9, Math.min(28, short * 0.06));
  const labelH = b.showLabel ? fontSize * 1.25 : 0;
  const x = b.position.endsWith('l') ? margin : n.width - margin - width;
  const top = b.position.startsWith('t');
  const y = top ? margin + labelH : n.height - margin - thickness;
  return { x, y, width, thickness, fontSize, labelY: y - fontSize * 0.35 };
}

function scaleBarMarkup(n: ImageNode, b: ScaleBar): string {
  const g = scaleBarGeometry(n, b);
  if (!(g.width > 0) || !Number.isFinite(g.width)) return '';
  const color = escapeXml(b.color);
  let s = `<rect x="${fmt(g.x)}" y="${fmt(g.y)}" width="${fmt(g.width)}" height="${fmt(g.thickness)}" fill="${color}"/>`;
  if (b.showLabel) {
    s += `<text x="${fmt(g.x + g.width / 2)}" y="${fmt(g.labelY)}" text-anchor="middle" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-weight="600" font-size="${fmt(g.fontSize)}" fill="${color}">${escapeXml(scaleBarText(b))}</text>`;
  }
  return `<g class="scale-bar">${s}</g>`;
}

/** SVG for an image node in its local frame (0,0)–(width,height). */
export function imageMarkup(n: ImageNode): string {
  const id = idPart(n.id);
  const c = cropOf(n);
  const { sx, sy } = imageScale(n);
  const fw = n.naturalWidth * sx, fh = n.naturalHeight * sy;
  const clipId = `qclip-${id}`, fxId = `qfx-${id}`;
  const filter = filterMarkup(n, fxId);
  const cropped = !!n.crop;
  const defs = (cropped ? `<clipPath id="${clipId}"><rect width="${fmt(n.width)}" height="${fmt(n.height)}"/></clipPath>` : '') + filter;
  const attrs = [
    `x="${fmt(-c.x * fw)}"`,
    `y="${fmt(-c.y * fh)}"`,
    `width="${fmt(fw)}"`,
    `height="${fmt(fh)}"`,
    'preserveAspectRatio="none"',
    filter ? `filter="url(#${fxId})"` : '',
    n.opacity < 1 ? `opacity="${fmt(n.opacity)}"` : '',
    // Both forms: href for modern renderers, xlink:href for Word/Inkscape-era readers.
    `href="${n.src}" xlink:href="${n.src}"`,
  ].filter(Boolean).join(' ');
  let s = defs ? `<defs>${defs}</defs>` : '';
  const img = `<image ${attrs}/>`;
  s += cropped ? `<g clip-path="url(#${clipId})">${img}</g>` : img;
  if (n.border !== 'none' && n.borderWidth > 0) {
    const w = n.borderWidth;
    s += `<rect x="${fmt(w / 2)}" y="${fmt(w / 2)}" width="${fmt(Math.max(0, n.width - w))}" height="${fmt(Math.max(0, n.height - w))}" fill="none" stroke="${escapeXml(n.border)}" stroke-width="${fmt(w)}"/>`;
  }
  if (n.scaleBar) s += scaleBarMarkup(n, n.scaleBar);
  return s;
}

/** Crop that keeps the current zoom: returns the new display size for the visible region. */
export function sizeForCrop(n: ImageNode, crop: ImageCrop): { width: number; height: number } {
  const { sx, sy } = imageScale(n);
  return { width: crop.width * n.naturalWidth * sx, height: crop.height * n.naturalHeight * sy };
}

/** Fit natural dimensions into a box without upscaling. */
export function fitSize(w: number, h: number, maxW: number, maxH: number): { width: number; height: number } {
  const s = Math.min(1, maxW / w, maxH / h);
  return { width: Math.max(1, Math.round(w * s)), height: Math.max(1, Math.round(h * s)) };
}

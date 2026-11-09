import { describe, expect, it } from 'vitest';
import {
  addNodes,
  createDocument,
  createImageNode,
  createPlotNode,
  createPlotFunction,
  createScaleBar,
  createShapeNode,
  cleanCrop,
  parseDocument,
  serializeDocument,
  updateNodes,
  SCHEMA_VERSION,
} from '@quillon/doc-model';
import { parseXml } from '@quillon/math-core';
import {
  confusablePairs,
  cvdFilterValues,
  defaultColumns,
  deltaE,
  figureColors,
  fitSize,
  gridPositions,
  imageMarkup,
  imageScale,
  insetRegion,
  layoutNode,
  panelLabel,
  readingOrderBoxes,
  resolveInsets,
  scaleBarGeometry,
  scaleBarText,
  sceneToSvg,
  sceneToTikz,
  simulateColor,
  sizeForCrop,
  tikzImageFile,
  toneTransfer,
} from '../src';

const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const img = (extra: Parameters<typeof createImageNode>[0] extends infer T ? Partial<T> : never = {}) =>
  createImageNode({ id: 'im', src: PIXEL, naturalWidth: 400, naturalHeight: 200, width: 200, height: 100, ...extra });

describe('image nodes', () => {
  it('creates with defaults and normalizes through parseDocument', () => {
    const n = img();
    expect(n).toMatchObject({ brightness: 100, contrast: 100, saturation: 100, opacity: 1, border: 'none' });
    expect(n.crop).toBeUndefined();
    const doc = parseDocument(JSON.parse(serializeDocument(addNodes(createDocument(), [n]))));
    expect(doc.version).toBe(SCHEMA_VERSION);
    expect(doc.nodes[0]).toEqual(n);
  });

  it('rejects images that are not embedded data URLs', () => {
    const raw = { ...createDocument(), nodes: [{ ...img(), src: 'https://example.com/x.png' }, { ...img(), id: 'b', src: 'javascript:alert(1)' }] };
    expect(parseDocument(raw).nodes).toHaveLength(0);
  });

  it('opens v2 documents and clamps bad values', () => {
    const raw = { ...createDocument(), version: 2, nodes: [{ ...img(), brightness: 9999, opacity: -1, crop: { x: -1, y: 0, width: 5, height: 1 } }] };
    const n = parseDocument(raw).nodes[0];
    expect(n.type === 'image' && [n.brightness, n.opacity, n.crop]).toEqual([400, 0, undefined]);
  });

  it('stores a full crop as no crop', () => {
    expect(cleanCrop({ x: 0, y: 0, width: 1, height: 1 })).toBeUndefined();
    expect(cleanCrop({ x: 0.5, y: 0.5, width: 0.9, height: 0.2 })).toEqual({ x: 0.5, y: 0.5, width: 0.5, height: 0.2 });
  });

  it('renders cropped, adjusted, framed images as valid SVG', () => {
    const n = img({ crop: { x: 0.25, y: 0, width: 0.5, height: 1 }, width: 200, height: 200, contrast: 150, grayscale: true, border: '#000000', borderWidth: 2 });
    const m = imageMarkup(n);
    expect(m).toContain('clip-path="url(#qclip-im)"');
    expect(m).toContain('<feColorMatrix type="saturate" values="0"/>');
    expect(m).toContain('feComponentTransfer');
    // full image is 400 natural px at scale 1 → offset −100
    expect(m).toContain('x="-100"');
    const { svg } = sceneToSvg([n]);
    expect(() => parseXml(svg)).not.toThrow();
    expect(layoutNode(n).bounds).toEqual({ x: 0, y: 0, width: 200, height: 200 });
  });

  it('skips the filter when nothing is adjusted', () => {
    expect(imageMarkup(img())).not.toContain('<filter');
    expect(toneTransfer({ brightness: 100, contrast: 100, invert: false })).toBeNull();
    expect(toneTransfer({ brightness: 100, contrast: 200, invert: false })).toEqual({ slope: 2, intercept: -0.5 });
    expect(toneTransfer({ brightness: 100, contrast: 100, invert: true })).toEqual({ slope: -1, intercept: 1 });
  });

  it('keeps the zoom when cropping', () => {
    const n = img();
    expect(imageScale(n)).toEqual({ sx: 0.5, sy: 0.5 });
    expect(sizeForCrop(n, { x: 0, y: 0, width: 0.5, height: 0.5 })).toEqual({ width: 100, height: 50 });
  });

  it('fits without upscaling', () => {
    expect(fitSize(100, 50, 480, 360)).toEqual({ width: 100, height: 50 });
    expect(fitSize(4000, 2000, 480, 360)).toEqual({ width: 480, height: 240 });
  });
});

describe('scale bars', () => {
  it('converts the calibrated length to display pixels', () => {
    // 0.5 µm per natural pixel, 400 px wide shown at 200 px → a 50 µm bar is 100 natural px = 50 display px.
    const bar = createScaleBar({ unitsPerPixel: 0.5, length: 50, position: 'bl' });
    const n = img({ scaleBar: bar });
    const g = scaleBarGeometry(n, bar);
    expect(g.width).toBeCloseTo(50);
    expect(g.x).toBeLessThan(20);
    expect(imageMarkup(n)).toContain('50 µm');
    expect(scaleBarText({ length: 0.30000000000000004, unit: 'mm' })).toBe('0.3 mm');
  });

  it('exports to TikZ with the image file referenced', () => {
    const n = img({ name: 'cells 01.tif.png', scaleBar: createScaleBar({ unitsPerPixel: 1, length: 20 }), crop: { x: 0, y: 0, width: 0.5, height: 1 } });
    const tex = sceneToTikz([n]);
    expect(tex).toContain('\\usepackage{graphicx}');
    expect(tex).toContain('{cells-01-tif.png}');
    expect(tex).toContain('\\clip');
    expect(tex).toContain('{\\bfseries 20 µm}');
    expect(tikzImageFile(img({ src: 'data:image/jpeg;base64,AAAA' }), 3)).toBe('image-3.jpg');
  });
});

describe('figure composer', () => {
  it('labels panels', () => {
    expect(['A', 'a', '(a)', 'a)', 'A.'].map((s) => panelLabel(1, s as never))).toEqual(['B', 'b', '(b)', 'b)', 'B.']);
    expect(panelLabel(26, 'A')).toBe('AA');
  });

  it('orders panels row by row', () => {
    const items = [
      { id: 'd', box: { x: 210, y: 205, width: 100, height: 100 } },
      { id: 'a', box: { x: 0, y: 10, width: 100, height: 100 } },
      { id: 'c', box: { x: 0, y: 200, width: 100, height: 100 } },
      { id: 'b', box: { x: 200, y: 0, width: 100, height: 100 } },
    ];
    expect(readingOrderBoxes(items).map((i) => i.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('lays out a grid with column widths and row heights', () => {
    const boxes = [
      { x: 0, y: 0, width: 100, height: 50 },
      { x: 0, y: 0, width: 60, height: 80 },
      { x: 0, y: 0, width: 120, height: 40 },
    ];
    expect(gridPositions(boxes, { columns: 2, gap: 10, origin: { x: 5, y: 5 } })).toEqual([
      { x: 5, y: 5 },
      { x: 135, y: 5 },
      { x: 5, y: 95 },
    ]);
    expect(defaultColumns(4)).toBe(2);
    expect(defaultColumns(6)).toBe(3);
  });

  it('keeps an inset marker on the region the inset shows', () => {
    const src = img({ id: 'src', x: 100, y: 50 });
    const marker = createShapeNode({ id: 'mk', x: 0, y: 0, width: 1, height: 1 });
    const inset = img({ id: 'in', x: 400, crop: { x: 0.5, y: 0.5, width: 0.25, height: 0.5 }, inset: { source: 'src', marker: 'mk' } });
    let doc = resolveInsets(addNodes(createDocument(), [src, marker, inset]));
    expect(doc.nodes[1]).toMatchObject({ x: 200, y: 100, width: 50, height: 50 });
    // Moving the source drags the marker along.
    doc = resolveInsets(updateNodes(doc, { src: { x: 0 } }));
    expect(doc.nodes[1]).toMatchObject({ x: 100 });
    expect(resolveInsets(doc)).toBe(doc);
    expect(insetRegion(src, { x: 0.9, y: 0, width: 0.05, height: 0.05 })).toMatchObject({ x: 280 });
  });
});

describe('colour vision', () => {
  it('builds filter matrices', () => {
    expect(cvdFilterValues('normal')).toBeNull();
    expect(cvdFilterValues('deuteranopia')!.split(' ')).toHaveLength(20);
  });

  it('simulates colours', () => {
    expect(simulateColor('#ffffff', 'protanopia')).toBe('#ffffff');
    const g = simulateColor('#00ff00', 'achromatopsia');
    expect(g.slice(1, 3)).toBe(g.slice(3, 5));
  });

  it('finds red/green pairs that deuteranopes cannot separate', () => {
    expect(deltaE('#d62728', '#2ca02c')).toBeGreaterThan(30);
    const pairs = confusablePairs(['#d62728', '#2ca02c'], 'deuteranopia');
    expect(pairs).toHaveLength(1);
    // The Okabe–Ito palette stays distinguishable.
    expect(confusablePairs(['#0072b2', '#e69f00'], 'deuteranopia')).toHaveLength(0);
  });

  it('collects the colours a figure uses', () => {
    const p = createPlotNode({ functions: [createPlotFunction({ color: '#FF0000' }), createPlotFunction({ color: '#00ff00' })] });
    expect(figureColors([p])).toEqual(['#ff0000', '#00ff00']);
  });
});

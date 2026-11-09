// Captures the README screenshots from the running dev server (npm run dev) with headless Chrome.
// Usage: node scripts/screenshots.mjs [chromePath]   (SHOTS=figures,export to capture only some, OUT_DIR to write elsewhere)
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const CHROME = process.argv[2] ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'http://localhost:1420/';
const OUT = process.env.OUT_DIR ? pathToFileURL(process.env.OUT_DIR.replace(/[\\/]?$/, '/')) : new globalThis.URL('../docs/images/', import.meta.url);
const ONLY = process.env.SHOTS ? new Set(process.env.SHOTS.split(',')) : null;
mkdirSync(OUT, { recursive: true });

const port = 9333;
const profile = mkdtempSync(join(tmpdir(), 'quillon-shots-'));
const chrome = spawn(CHROME, [`--headless=new`, `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--hide-scrollbars', '--force-color-profile=srgb', 'about:blank'], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 50 && !target; i++) {
  await sleep(200);
  try {
    target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page');
  } catch {}
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let seq = 0;
const pending = new Map();
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  // Never let a beforeunload prompt block navigation.
  if (msg.method === 'Page.javascriptDialogOpening') ws.send(JSON.stringify({ id: ++seq, method: 'Page.handleJavaScriptDialog', params: { accept: true } }));
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
};
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, (msg) => (msg.error ? reject(new Error(`${method}: ${msg.error.message}`)) : resolve(msg.result)));
    ws.send(JSON.stringify({ id, method, params }));
  });
const run = async (code) => {
  const r = await send('Runtime.evaluate', { expression: `(async () => { ${code} })()`, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
};

async function shot(name, width, height, setup) {
  if (ONLY && !ONLY.has(name)) return;
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: false });
  await send('Page.navigate', { url: URL });
  await sleep(2500);
  try {
    await run(PRELUDE + setup);
  } catch (e) {
    const info = await run(`const S = window.__quillon.store; return { title: document.title, docTitle: S.editor.doc.meta.title, nodes: S.editor.doc.nodes.length, age: Math.round(performance.now()) }`).catch((x) => String(x));
    console.error('setup failed for', name, info);
    throw e;
  }
  await sleep(1200);
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(new globalThis.URL(`${name}.png`, OUT), Buffer.from(data, 'base64'));
  // No "restored your session" toast and no "leave site?" prompt on the next load.
  await run(`const S = window.__quillon.store; S.editor.markSaved({ name: null, path: null }); localStorage.clear();`);
  console.log('wrote', name);
}

await send('Page.enable');
await send('Runtime.enable');

const PRELUDE = `
const Q = window.__quillon; const S = Q.store;
const A = Q.actions;
const D = Q.doc;
const { editor, ui } = S;
S.toasts.set({ list: [] });
const place = (n, p) => editor.apply('place', (d) => D.updateNodes(d, { [n.id]: p }));
const last = () => editor.doc.nodes[editor.doc.nodes.length - 1];
const sym = (id, x, y, patch = {}) => { A.addSymbol(id, { x, y }); A.patchSelection('s', patch); return last(); };
const wire = (a, pa, b, pb, extra = {}) => { A.addLine([{ x: 0, y: 0 }, { x: 1, y: 1 }], { start: { node: a.id, port: pa }, end: { node: b.id, port: pb }, routing: 'elbow', ...extra }); return last(); };
const shape = (kind, x, y, w, h, patch = {}) => { A.addShape(kind, { x, y, width: w, height: h }); A.patchSelection('s', patch); return last(); };
const connect = (a, b, extra = {}) => { A.addLine([{ x: 0, y: 0 }, { x: 1, y: 1 }], { start: { node: a.id }, end: { node: b.id }, endCap: 'arrow', ...extra }); return last(); };
const text = (x, y, t, patch = {}) => { A.addText({ x, y }, t); A.patchSelection('s', patch); ui.set({ editingTextId: null }); return last(); };
const math = (x, y, latex, patch = {}) => { const n = A.addMath(latex, { x, y }, patch); return n; };
const fresh = (title) => { editor.load(D.createDocument(title)); ui.set({ activeMathId: null, editingTextId: null, tool: 'select' }); };
const view = (zoom, panX, panY) => ui.set({ zoom, panX, panY });
// Adding equations opens the equation editor; keep it closed unless the shot is about equations.
const settle = (dock = false) => { ui.set({ dockOpen: dock }); return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); };
`;

const RC = `
fresh('RC circuit — lab report');
ui.set({ panelOpen: true, panelTab: 'shapes', dockOpen: false });
text(40, 0, 'Charging a capacitor', { fontSize: 26, bold: true });
text(40, 40, 'Switch closed at $t = 0$; the capacitor starts uncharged.', { fontSize: 16, color: '#4b5563' });
const bat = sym('circuit.battery', 80, 220, { rotation: 90, label: '$\\\\mathcal{E}$' });
const sw = sym('circuit.switch', 200, 120, { label: '$S$' });
const res = sym('circuit.resistor', 330, 120, { label: '$R$' });
const cap = sym('circuit.capacitor', 440, 220, { rotation: 90, label: '$C$' });
wire(bat, 'a', sw, 'a'); wire(sw, 'b', res, 'a'); wire(res, 'b', cap, 'a'); wire(cap, 'b', bat, 'b');
math(560, 150, 'V_C(t)=\\\\mathcal{E}\\\\left(1-e^{-t/RC}\\\\right)', { numbered: true, fontSize: 26 });
math(560, 230, '\\\\tau = RC', { numbered: true, fontSize: 26 });
A.addPlot({ x: 40, y: 330, width: 430, height: 260 });
const plot = last();
editor.apply('p', (d) => D.updateNodes(d, { [plot.id]: { xMin: 0, xMax: 5, yMin: 0, yMax: 1.15, axes: 'box', legend: true, xLabel: 'Time $t/RC$', yLabel: '$V_C/\\\\mathcal{E}$', functions: [
  D.createPlotFunction({ expr: '1 - e^(-x)', color: '#0072b2', label: '$V_C$' }),
  D.createPlotFunction({ expr: 'e^(-x)', color: '#d55e00', dash: 'dashed', label: '$V_R$' }),
] } }));
shape('roundrect', 500, 360, 300, 72, { stroke: '#9ca3af', dash: 'dashed', label: 'After one time constant the\\ncapacitor reaches 63% of $\\\\mathcal{E}$.', labelSize: 15, labelColor: '#374151' });
editor.select([plot.id]);
ui.set({ activeMathId: null });
view(0.95, 40, 40);
await settle();
`;

await shot('welcome', 1440, 900, `
fresh('Untitled');
ui.set({ panelOpen: true, panelTab: 'templates' });
await settle(true);
`);

await shot('overview', 1440, 900, RC);

await shot('equations', 1440, 900, RC.replace("ui.set({ panelOpen: true, panelTab: 'shapes', dockOpen: false });", "ui.set({ panelOpen: true, panelTab: 'templates', dockOpen: true });").replace("editor.select([plot.id]);\nui.set({ activeMathId: null });", `
const eq = editor.doc.nodes.find((n) => n.type === 'math');
editor.select([eq.id]); ui.set({ activeMathId: eq.id });`).replace('view(0.95, 40, 40);', 'view(0.85, 30, 10);').replace('await settle();', 'await settle(true);'));

await shot('flowchart', 1440, 900, `
fresh('Fitting workflow');
ui.set({ panelOpen: true, panelTab: 'shapes', dockOpen: false });
const fill = '#eef2ff', dec = '#fef3c7';
const start = shape('stadium', 200, 0, 160, 50, { label: 'Start', fill });
const load = shape('parallelogram', 180, 100, 200, 60, { label: 'Load data $(x_i, y_i)$' });
const fit = shape('rect', 180, 210, 200, 60, { label: 'Fit $y = a e^{bx}$' });
const ok = shape('diamond', 190, 320, 180, 110, { label: '$\\\\chi^2 < \\\\varepsilon$?', fill: dec });
const rep = shape('rect', 180, 490, 200, 60, { label: 'Report $a, b$' });
const end = shape('stadium', 200, 600, 160, 50, { label: 'End', fill });
const tweak = shape('rect', 460, 345, 170, 60, { label: 'Adjust guess' });
connect(start, load); connect(load, fit); connect(fit, ok); connect(ok, rep, { label: 'yes' }); connect(rep, end);
connect(ok, tweak, { label: 'no' }); connect(tweak, fit, { routing: 'elbow' });
text(700, 40, 'Flowcharts', { fontSize: 22, bold: true });
text(700, 80, 'Connectors attach to shapes and follow\\nthem when you move things around.\\nLabels can contain math.', { fontSize: 15, color: '#4b5563' });
editor.select([ok.id]);
await settle();
A.zoomFit();
await settle();
`);

await shot('physics', 1440, 900, `
fresh('Mechanics and optics');
ui.set({ panelOpen: true, panelTab: 'shapes', dockOpen: false });
// Incline: hypotenuse from (100,380) to (420,200); block resting on it, forces from its center.
const inc = sym('mech.incline', 0, 0);
place(inc, { x: 100, y: 200, width: 320, height: 180 });
const ang = Math.atan2(180, 320), u = { x: Math.cos(ang), y: -Math.sin(ang) }, nrm = { x: -Math.sin(ang), y: -Math.cos(ang) };
const P = { x: 100 + 320 * 0.45, y: 380 - 180 * 0.45 };
const C = { x: P.x + nrm.x * 30, y: P.y + nrm.y * 30 };
const block = sym('mech.mass', 0, 0);
place(block, { x: C.x - 30, y: C.y - 30, width: 60, height: 60, rotation: -ang * 180 / Math.PI, label: '$m$' });
const tipG = { x: C.x, y: C.y + 105 }, tipN = { x: C.x + nrm.x * 95, y: C.y + nrm.y * 95 }, tipF = { x: C.x + u.x * 85, y: C.y + u.y * 85 };
A.addLine([C, tipG], { endCap: 'arrow', stroke: '#d55e00', strokeWidth: 2, startCap: 'dot' });
A.addLine([C, tipN], { endCap: 'arrow', stroke: '#0072b2', strokeWidth: 2 });
A.addLine([C, tipF], { endCap: 'arrow', stroke: '#009e73', strokeWidth: 2 });
math(tipG.x + 6, tipG.y - 14, 'm\\\\vec g', { fontSize: 18, display: false, color: '#d55e00' });
math(tipN.x - 34, tipN.y - 22, '\\\\vec N', { fontSize: 18, display: false, color: '#0072b2' });
math(tipF.x + 4, tipF.y - 30, '\\\\vec F_f', { fontSize: 18, display: false, color: '#009e73' });
math(150, 350, '\\\\alpha', { fontSize: 18, display: false });
text(100, 110, 'Block on an incline', { fontSize: 20, bold: true });
math(100, 410, 'a = g\\\\left(\\\\sin\\\\alpha - \\\\mu\\\\cos\\\\alpha\\\\right)', { fontSize: 24 });
// Thin lens, f = 90: object at d = 150 → image at d' = 225, magnified 1.5x and inverted.
text(560, 110, 'Converging lens', { fontSize: 20, bold: true });
A.addLine([{ x: 560, y: 260 }, { x: 1080, y: 260 }], { stroke: '#9ca3af', dash: 'dashed' });
const lens = sym('optics.lens-thin', 0, 0);
place(lens, { x: 790, y: 150, width: 20, height: 220 });
A.addLine([{ x: 650, y: 260 }, { x: 650, y: 200 }], { endCap: 'arrow', strokeWidth: 2.5 });
A.addLine([{ x: 650, y: 200 }, { x: 800, y: 200 }, { x: 1025, y: 350 }], { stroke: '#cc79a7', strokeWidth: 1.5 });
A.addLine([{ x: 650, y: 200 }, { x: 1025, y: 350 }], { stroke: '#0072b2', strokeWidth: 1.5 });
A.addLine([{ x: 1025, y: 260 }, { x: 1025, y: 350 }], { endCap: 'arrow', strokeWidth: 2.5 });
math(632, 168, 'B', { fontSize: 16, display: false });
math(1033, 345, "B'", { fontSize: 16, display: false });
math(700, 266, 'F', { fontSize: 16, display: false });
math(882, 266, "F'", { fontSize: 16, display: false });
for (const x of [710, 890]) A.addLine([{ x, y: 256 }, { x, y: 264 }], { strokeWidth: 1.5 });
math(600, 400, "\\\\frac{1}{d}+\\\\frac{1}{d'}=\\\\frac{1}{f}", { fontSize: 26 });
editor.select([lens.id]);
ui.set({ activeMathId: null });
await settle();
A.zoomFit();
await settle();
`);

// A synthetic fluorescence micrograph, drawn in the page so the README needs no binary sample.
const FIGURE = `
fresh('Cell imaging');
ui.set({ panelOpen: false, dockOpen: false });
const c = document.createElement('canvas'); c.width = 800; c.height = 600;
const g = c.getContext('2d'); g.fillStyle = '#05070d'; g.fillRect(0, 0, 800, 600);
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
for (let i = 0; i < 70; i++) {
  const x = rnd() * 800, y = rnd() * 600, r = 12 + rnd() * 30, green = i % 3;
  const gr = g.createRadialGradient(x, y, 1, x, y, r);
  gr.addColorStop(0, green ? 'rgba(80,255,140,0.95)' : 'rgba(255,60,90,0.95)');
  gr.addColorStop(0.6, green ? 'rgba(30,140,70,0.5)' : 'rgba(150,20,50,0.5)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
}
const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
const img = await A.addImageBytes('cells.png', new Uint8Array(await blob.arrayBuffer()), { x: 260, y: 200 });
place(img, { scaleBar: D.createScaleBar({ unitsPerPixel: 0.25, length: 50 }) });
A.createInset(editor.doc.nodes.find((n) => n.id === img.id));
A.addPlot({ x: 60, y: 560, width: 300, height: 300 });
const plot = last();
place(plot, { axes: 'box', xMin: 0, xMax: 10, yMin: 0, yMax: 1.1, xLabel: 'Time (min)', yLabel: 'Intensity', legend: true, functions: [
  D.createPlotFunction({ expr: '1 - exp(-x/2)', color: '#d62728', label: 'GFP' }),
  D.createPlotFunction({ expr: 'exp(-x/3)', color: '#2ca02c', label: 'RFP' }),
] });
editor.selectAll();
A.composeFigure({ columns: 3, gap: 16, equalWidth: false, labels: 'a', labelSize: 18 });
editor.select([editor.doc.nodes.find((n) => n.type === 'image' && n.inset).id]);
ui.set({ activeMathId: null });
await settle();
A.zoomFit();
await settle();
`;

await shot('figures', 1440, 900, FIGURE);

await shot('colorblind', 1440, 900, FIGURE + `
editor.select([]);
ui.set({ colorVision: 'deuteranopia' });
await settle();
`);

// Same figure with nothing selected (for the trailer's before/after wipe); only on request.
if (ONLY?.has('figures-plain')) await shot('figures-plain', 1440, 900, FIGURE + `
editor.select([]);
await settle();
`);

await shot('figure-layout', 1440, 900, FIGURE + `
editor.selectAll();
ui.set({ figureOpen: true });
await settle();
`);

await shot('export', 1440, 900, RC + `
editor.select([]);
ui.set({ exportOpen: true });
await settle();
document.querySelectorAll('.format-card')[0].click();
await settle();
const sizeSel = [...document.querySelectorAll('.modal select')][0];
Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sizeSel, 'nature-2');
sizeSel.dispatchEvent(new Event('change', { bubbles: true }));
`);

// The RC page exported as TikZ, for the README (compiled separately with pdflatex).
if (process.env.TIKZ_OUT) {
  await send('Page.navigate', { url: URL });
  await sleep(2500);
  const tikz = await run(PRELUDE + RC + `
    const F = Q.figure;
    const L = Q.layout;
    return F.sceneToTikz(editor.doc.nodes, { numbers: L.getNumbers(editor.doc), measure: L.measureText });`);
  writeFileSync(join(process.env.TIKZ_OUT, 'rc.tex'), tikz);
  await run(`const S = window.__quillon.store; S.editor.markSaved({ name: null, path: null }); localStorage.clear();`);
  console.log('wrote rc.tex');
}

ws.close();
chrome.kill();
process.exit(0);

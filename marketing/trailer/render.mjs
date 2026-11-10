// Renders the trailer frame by frame with headless Chrome.
// 1. math.js: equation SVGs typeset by Quillon itself (needs `npm run dev` on :1420).
// 2. frames/: one JPEG per frame, by calling window.render(t) in index.html.
// Usage: node marketing/trailer/render.mjs [--fps 30] [--only 0,5.2,11] [--skip-math] [--poster]
// Encode afterwards with encode.m (MATLAB) or any H.264 encoder.
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DIR = fileURLToPath(new URL('.', import.meta.url));
const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const FPS = Number(opt('--fps', 30));
const ONLY = opt('--only', null)?.split(',').map(Number);
const OUT = join(DIR, ONLY ? 'stills' : 'frames');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const port = 9344;
const profile = mkdtempSync(join(tmpdir(), 'quillon-trailer-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--hide-scrollbars', '--force-color-profile=srgb', '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 50 && !target; i++) {
  await sleep(200);
  try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page'); } catch {}
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let seq = 0;
const pending = new Map();
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.method === 'Page.javascriptDialogOpening') ws.send(JSON.stringify({ id: ++seq, method: 'Page.handleJavaScriptDialog', params: { accept: true } }));
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
};
const send = (method, params = {}) => new Promise((res, rej) => {
  const id = ++seq;
  pending.set(id, (msg) => (msg.error ? rej(new Error(`${method}: ${msg.error.message}`)) : res(msg.result)));
  ws.send(JSON.stringify({ id, method, params }));
});
const run = async (code) => {
  const r = await send('Runtime.evaluate', { expression: `(async () => { ${code} })()`, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
};
await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });

// ---- 1. equations typeset by Quillon
const FORMULAS = [
  String.raw`x=\frac{-b\pm\sqrt{b^2-4ac}}{2a}`,
  String.raw`\int_{-\infty}^{\infty} e^{-x^2}\,dx=\sqrt{\pi}`,
  String.raw`e^{i\pi}+1=0`,
  String.raw`\nabla\cdot\vec E=\frac{\rho}{\varepsilon_0}`,
  String.raw`i\hbar\frac{\partial\psi}{\partial t}=\hat H\psi`,
  String.raw`\sum_{n=1}^{\infty}\frac{1}{n^2}=\frac{\pi^2}{6}`,
  String.raw`F=G\frac{m_1m_2}{r^2}`,
  String.raw`\begin{pmatrix}a&b\\c&d\end{pmatrix}`,
  String.raw`\ce{2H2 + O2 -> 2H2O}`,
  String.raw`f(x)=\sum_{k}c_k e^{ikx}`,
  String.raw`\lim_{h\to0}\frac{f(x+h)-f(x)}{h}`,
  String.raw`E=mc^2`,
  String.raw`\oint_C \vec B\cdot d\vec\ell=\mu_0 I`,
  String.raw`\Delta S\ge 0`,
];
const HERO = String.raw`V_C(t)=\mathcal{E}\left(1-e^{-t/RC}\right)`;
if (!args.includes('--skip-math') || !existsSync(join(DIR, 'math.js'))) {
  await send('Page.navigate', { url: 'http://localhost:1420/' });
  await sleep(3000);
  const res = await run(`
    const F = window.__quillon.figure;
    const svg = (latex, size, color) => F.mathToSvg({ latex, display: true, fontSize: size, color }).svg.replace(/<\\?xml[^>]*>/, '');
    return { math: ${JSON.stringify(FORMULAS)}.map((l) => svg(l, 40, '#ffffff')), hero: svg(${JSON.stringify(HERO)}, 46, '#ffffff') };`);
  writeFileSync(join(DIR, 'math.js'), `window.MATH = ${JSON.stringify(res.math)};\nwindow.HERO = ${JSON.stringify(res.hero)};\n`);
  await run(`window.__quillon.store.editor.markSaved({ name: null, path: null }); localStorage.clear();`);
  console.log('wrote math.js');
}

// ---- 2. frames
await send('Page.navigate', { url: pathToFileURL(join(DIR, 'index.html')).href + (args.includes('--poster') ? '?poster' : '') });
await sleep(2500);
await run(`await document.fonts.ready; await Promise.all([...document.images].map((i) => i.decode().catch(() => {})));`);
const duration = await run('return window.DURATION');
if (!ONLY) rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const times = ONLY ?? Array.from({ length: Math.round(duration * FPS) }, (_, i) => i / FPS);
const t0 = Date.now();
for (const [i, t] of times.entries()) {
  await run(`render(${t}); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));`);
  const { data } = await send('Page.captureScreenshot', { format: 'jpeg', quality: 94 });
  const name = ONLY ? `t${t.toFixed(2)}.jpg` : `f${String(i + 1).padStart(5, '0')}.jpg`;
  writeFileSync(join(OUT, name), Buffer.from(data, 'base64'));
  if (i % 150 === 0) console.log(`frame ${i + 1}/${times.length} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
}
console.log('done', times.length, 'frames →', OUT);
ws.close();
chrome.kill();
process.exit(0);

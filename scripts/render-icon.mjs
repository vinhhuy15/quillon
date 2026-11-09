// Renders apps/desktop/public/logo.svg to a 1024px PNG for `tauri icon` (needs Chrome or Edge).
// Usage: node scripts/render-icon.mjs [out.png] [size] [chromePath]
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const out = process.argv[2] ?? new URL('../apps/desktop/src-tauri/icons/source.png', import.meta.url);
const size = Number(process.argv[3] ?? 1024);
const CHROME = process.argv[4] ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const svg = readFileSync(new URL('../apps/desktop/public/logo.svg', import.meta.url), 'utf8');

const port = 9334;
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'icon-'))}`, 'about:blank'], { stdio: 'ignore' });
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
let id = 0;
const waiters = new Map();
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  waiters.get(msg.id)?.(msg.result);
};
const send = (method, params = {}) => new Promise((r) => (waiters.set(++id, r), ws.send(JSON.stringify({ id, method, params }))));

await send('Emulation.setDeviceMetricsOverride', { width: size, height: size, deviceScaleFactor: 1, mobile: false });
await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
const html = `<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg style="display:block;width:${size}px;height:${size}px" `)}</body></html>`;
await send('Page.navigate', { url: `data:text/html;base64,${Buffer.from(html).toString('base64')}` });
await sleep(800);
const { data } = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync(out, Buffer.from(data, 'base64'));
console.log('wrote', String(out));
ws.close();
chrome.kill();
process.exit(0);

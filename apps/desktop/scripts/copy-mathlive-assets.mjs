// Copies MathLive's fonts into public/ so the editor can load them offline.
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
// mathlive's "exports" hides package.json; fonts.css lives at the package root.
const pkgDir = dirname(require.resolve('mathlive/fonts.css'));
const dest = join(here, '..', 'public', 'mathlive');

mkdirSync(dest, { recursive: true });
if (!existsSync(join(dest, 'fonts', 'KaTeX_Main-Regular.woff2'))) {
  cpSync(join(pkgDir, 'fonts'), join(dest, 'fonts'), { recursive: true });
  console.log('Copied MathLive fonts →', dest);
}

/**
 * LaTeX clean-up shared by renderer and exporters.
 */

/** Strip MathLive-only constructs so the LaTeX is portable (MathJax / real TeX). */
export function normalizeLatex(latex: string): string {
  let s = latex.trim();
  // Strip $...$, $$...$$, \[...\], \(...\) wrappers pasted from documents.
  const wrappers: [RegExp, string][] = [
    [/^\$\$([\s\S]*)\$\$$/, '$1'],
    [/^\$([\s\S]*)\$$/, '$1'],
    [/^\\\[([\s\S]*)\\\]$/, '$1'],
    [/^\\\(([\s\S]*)\\\)$/, '$1'],
  ];
  for (const [re, rep] of wrappers) {
    if (re.test(s)) {
      s = s.replace(re, rep).trim();
      break;
    }
  }
  // Empty MathLive placeholders → visible box; filled ones → their content.
  s = s.replace(/\\placeholder(\[[^\]]*\])?\{\}/g, '\\square ');
  s = replaceCommandArg(s, '\\placeholder', (arg) => arg);
  return s;
}

const PORTABLE: [RegExp, string][] = [
  [/\\differentialD\b/g, '\\mathrm{d}'],
  [/\\capitalDifferentialD\b/g, '\\mathrm{D}'],
  [/\\exponentialE\b/g, '\\mathrm{e}'],
  [/\\imaginaryI\b/g, '\\mathrm{i}'],
  [/\\imaginaryJ\b/g, '\\mathrm{j}'],
  [/\\mleft\b/g, '\\left'],
  [/\\mright\b/g, '\\right'],
];

/** LaTeX suitable for a real TeX document (no MathLive-only commands). */
export function toPortableLatex(latex: string): string {
  let s = normalizeLatex(latex);
  for (const [re, rep] of PORTABLE) s = s.replace(re, rep);
  return s;
}

/** Replace `\cmd{arg}` (balanced braces) using `fn(arg)`. Optional `[..]` is dropped. */
function replaceCommandArg(s: string, cmd: string, fn: (arg: string) => string): string {
  let out = '';
  let i = 0;
  while (i < s.length) {
    const j = s.indexOf(cmd, i);
    if (j < 0) {
      out += s.slice(i);
      break;
    }
    out += s.slice(i, j);
    let k = j + cmd.length;
    if (s[k] === '[') k = s.indexOf(']', k) + 1 || s.length;
    if (s[k] !== '{') {
      out += cmd;
      i = j + cmd.length;
      continue;
    }
    let depth = 0;
    let end = k;
    for (; end < s.length; end++) {
      if (s[end] === '\\') {
        end++;
        continue;
      }
      if (s[end] === '{') depth++;
      else if (s[end] === '}' && --depth === 0) break;
    }
    out += fn(s.slice(k + 1, end));
    i = end + 1;
  }
  return out;
}

/** Heuristic: does clipboard text look like LaTeX math rather than prose? */
export function looksLikeLatex(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 20000) return false;
  if (/^(\$\$?|\\\[|\\\()[\s\S]+(\$\$?|\\\]|\\\))$/.test(t)) return true;
  if (/\\(frac|sqrt|sum|int|alpha|beta|gamma|left|right|begin|mathbb|cdot|times|infty|lim|partial|vec|hat)\b/.test(t)) return true;
  return /^[\w\s+\-*/=^_(){}[\]<>.,|']+$/.test(t) && /[\^_=]/.test(t) && t.length < 200;
}

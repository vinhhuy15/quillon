/**
 * Minimal, dependency-free XML parser/serializer — enough for MathML/SVG
 * produced by MathJax and for reading metadata. Not a validating parser.
 */

export interface XmlElement {
  name: string;
  attrs: Record<string, string>;
  children: XmlNode[];
}
export type XmlNode = XmlElement | string;

const ENTITIES: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'", nbsp: ' ' };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const cp = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : m;
    }
    return ENTITIES[e] ?? m;
  });
}

export function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export class XmlParseError extends Error {}

export function parseXml(src: string): XmlElement {
  let i = 0;
  const root: XmlElement = { name: '#root', attrs: {}, children: [] };
  const stack: XmlElement[] = [root];
  const top = () => stack[stack.length - 1];

  while (i < src.length) {
    const lt = src.indexOf('<', i);
    if (lt < 0) {
      pushText(top(), src.slice(i));
      break;
    }
    if (lt > i) pushText(top(), src.slice(i, lt));
    if (src.startsWith('<!--', lt)) {
      const end = src.indexOf('-->', lt + 4);
      i = end < 0 ? src.length : end + 3;
    } else if (src.startsWith('<![CDATA[', lt)) {
      const end = src.indexOf(']]>', lt + 9);
      if (end < 0) throw new XmlParseError('Unterminated CDATA');
      top().children.push(src.slice(lt + 9, end));
      i = end + 3;
    } else if (src[lt + 1] === '?' || src[lt + 1] === '!') {
      const end = src.indexOf('>', lt);
      i = end < 0 ? src.length : end + 1;
    } else if (src[lt + 1] === '/') {
      const end = src.indexOf('>', lt);
      const name = src.slice(lt + 2, end).trim();
      const el = stack.pop();
      if (!el || el.name !== name) throw new XmlParseError(`Mismatched </${name}>`);
      i = end + 1;
    } else {
      const m = /^<([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/.exec(src.slice(lt, lt + 4096));
      if (!m) throw new XmlParseError(`Bad tag at ${lt}`);
      const attrs: Record<string, string> = {};
      const re = /([\w:.-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
      let a: RegExpExecArray | null;
      while ((a = re.exec(m[2]))) attrs[a[1]] = decodeEntities(a[3] ?? a[4] ?? '');
      const el: XmlElement = { name: m[1], attrs, children: [] };
      top().children.push(el);
      if (!m[3]) stack.push(el);
      i = lt + m[0].length;
    }
  }
  if (stack.length !== 1) throw new XmlParseError(`Unclosed <${top().name}>`);
  const first = root.children.find((c): c is XmlElement => typeof c !== 'string');
  if (!first) throw new XmlParseError('No root element');
  return first;
}

function pushText(el: XmlElement, raw: string) {
  const text = decodeEntities(raw);
  const last = el.children[el.children.length - 1];
  if (typeof last === 'string') el.children[el.children.length - 1] = last + text;
  else el.children.push(text);
}

export const elements = (el: XmlElement): XmlElement[] =>
  el.children.filter((c): c is XmlElement => typeof c !== 'string');

export function textContent(n: XmlNode): string {
  return typeof n === 'string' ? n : n.children.map(textContent).join('');
}

/** Local name without namespace prefix. */
export const localName = (el: XmlElement) => el.name.slice(el.name.indexOf(':') + 1);

export function findFirst(el: XmlElement, pred: (e: XmlElement) => boolean): XmlElement | null {
  if (pred(el)) return el;
  for (const c of elements(el)) {
    const f = findFirst(c, pred);
    if (f) return f;
  }
  return null;
}

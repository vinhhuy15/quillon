/**
 * Presentation MathML → Office Math Markup Language (OMML), the native
 * equation format of Microsoft Word / PowerPoint.
 *
 * Written from scratch (no Microsoft XSLT) so it can be redistributed under Apache-2.0.
 */
import { elements, escapeXml, localName, parseXml, textContent, type XmlElement } from './xml';

export const OMML_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/math';

const NARY = new Set('∑∏∐∫∬∭∮∯∰∱∲∳⋀⋁⋂⋃⨀⨁⨂⨄⨆'.split(''));
const OPEN = new Set(['(', '[', '{', '⟨', '|', '‖', '⌊', '⌈', '⟦', '〈']);
const CLOSE = new Set([')', ']', '}', '⟩', '|', '‖', '⌋', '⌉', '⟧', '〉']);
/** Operators that end the operand of a big operator (∑ … + …). */
const NARY_STOP = new Set(['=', '+', '−', '-', '<', '>', '≤', '≥', '≠', '≈', '≡', '∼', '≃', ',', ';', '⇒', '⇔', '→', '±', '∓']);

const ACCENTS: Record<string, string> = {
  '→': '⃗', '⃗': '⃗', '^': '̂', 'ˆ': '̂', '̂': '̂', '~': '̃', '˜': '̃',
  '̃': '̃', '˙': '̇', '.': '̇', '¨': '̈', 'ˇ': '̌', '˘': '̆', '´': '́',
  'ˊ': '́', '`': '̀', 'ˋ': '̀', '←': '⃖', '↔': '⃡', '°': '̊', '˚': '̊',
};
const BARS = new Set(['―', '¯', '‾', '_', '̅', '−', '-']);
const GROUP_CHARS = new Set(['⏟', '⏞', '⏜', '⏝', '⎴', '⎵', '︸', '︷']);

const VARIANT_SCRIPT: Record<string, string> = {
  'double-struck': 'double-struck', script: 'script', 'bold-script': 'script', fraktur: 'fraktur',
  'bold-fraktur': 'fraktur', 'sans-serif': 'sans-serif', 'bold-sans-serif': 'sans-serif',
  'sans-serif-italic': 'sans-serif', 'sans-serif-bold-italic': 'sans-serif', monospace: 'monospace',
};

interface RunStyle {
  sty?: 'p' | 'b' | 'i' | 'bi';
  scr?: string;
  nor?: boolean;
}

function run(text: string, style: RunStyle = {}): string {
  if (!text) return '';
  const props: string[] = [];
  if (style.nor) props.push('<m:nor/>');
  if (style.scr) props.push(`<m:scr m:val="${style.scr}"/>`);
  if (style.sty) props.push(`<m:sty m:val="${style.sty}"/>`);
  const rPr = props.length ? `<m:rPr>${props.join('')}</m:rPr>` : '';
  const space = /^\s|\s$/.test(text) ? ' xml:space="preserve"' : '';
  return `<m:r>${rPr}<m:t${space}>${escapeXml(text)}</m:t></m:r>`;
}

function variantStyle(el: XmlElement, defaultUpright: boolean): RunStyle {
  const v = el.attrs.mathvariant;
  const style: RunStyle = {};
  if (v && VARIANT_SCRIPT[v]) style.scr = VARIANT_SCRIPT[v];
  if (v === 'normal' || (!v && defaultUpright)) style.sty = 'p';
  else if (v === 'bold' || v === 'bold-sans-serif' || v === 'bold-fraktur' || v === 'bold-script') style.sty = 'b';
  else if (v === 'bold-italic' || v === 'sans-serif-bold-italic') style.sty = 'bi';
  else if (v === 'italic') style.sty = 'i';
  else if (style.scr) style.sty = 'p';
  return style;
}

const text = (el: XmlElement) => textContent(el).replace(/ /g, ' ');

/** Unwrap <mrow> with a single child (MathJax wraps many atoms). */
function unwrap(el: XmlElement): XmlElement {
  let cur = el;
  while ((localName(cur) === 'mrow' || localName(cur) === 'mstyle' || localName(cur) === 'mpadded')) {
    const kids = elements(cur);
    if (kids.length !== 1) break;
    cur = kids[0];
  }
  return cur;
}

/** If element is (or wraps) a single <mo>, return its text. */
function moText(el: XmlElement): string | null {
  const u = unwrap(el);
  return localName(u) === 'mo' ? text(u) : null;
}

function isNaryBase(el: XmlElement): string | null {
  const t = moText(el);
  return t && NARY.has(t.trim()) ? t.trim() : null;
}

const e = (inner: string) => `<m:e>${inner}</m:e>`;

/** True if the bare (unstretched) brackets among `kids` never close more than they open — so `(a)+(b)` is not one group. */
function balanced(kids: XmlElement[]): boolean {
  let depth = 0;
  for (const k of kids) {
    const t = moText(k)?.trim();
    if (!t || t === '|' || t === '‖') continue;
    if (OPEN.has(t)) depth++;
    else if (CLOSE.has(t) && --depth < 0) return false;
  }
  return true;
}

class Converter {
  convertChildren(kids: XmlElement[]): string {
    let out = '';
    for (let i = 0; i < kids.length; i++) {
      const k = kids[i];
      const naryChr = this.naryOf(k);
      if (naryChr) {
        // Absorb operand: following siblings until a stop operator.
        let j = i + 1;
        while (j < kids.length) {
          const t = moText(kids[j]);
          if (t !== null && NARY_STOP.has(t.trim())) break;
          j++;
        }
        out += this.nary(k, naryChr, this.convertChildren(kids.slice(i + 1, j)));
        i = j - 1;
        continue;
      }
      out += this.node(k);
    }
    return out;
  }

  /** Big-operator element (bare or with limits)? Returns the operator char. */
  private naryOf(el: XmlElement): string | null {
    const n = localName(el);
    if (n === 'mo') return isNaryBase(el);
    if (['msub', 'msup', 'msubsup', 'munder', 'mover', 'munderover'].includes(n)) {
      const base = elements(el)[0];
      return base ? isNaryBase(base) : null;
    }
    return null;
  }

  private nary(el: XmlElement, chr: string, operand: string): string {
    const n = localName(el);
    const kids = elements(el);
    let sub = '';
    let sup = '';
    if (n === 'msub' || n === 'munder') sub = this.node(kids[1]);
    else if (n === 'msup' || n === 'mover') sup = this.node(kids[1]);
    else if (n === 'msubsup' || n === 'munderover') {
      sub = this.node(kids[1]);
      sup = this.node(kids[2]);
    }
    const limLoc = n.startsWith('mu') || n === 'mo' ? 'undOvr' : 'subSup';
    const props = [`<m:chr m:val="${escapeXml(chr)}"/>`, `<m:limLoc m:val="${limLoc}"/>`];
    if (!sub) props.push('<m:subHide m:val="1"/>');
    if (!sup) props.push('<m:supHide m:val="1"/>');
    return `<m:nary><m:naryPr>${props.join('')}</m:naryPr><m:sub>${sub}</m:sub><m:sup>${sup}</m:sup>${e(operand)}</m:nary>`;
  }

  node(el: XmlElement | undefined): string {
    if (!el) return '';
    const n = localName(el);
    const kids = elements(el);
    switch (n) {
      case 'math':
      case 'mstyle':
      case 'mpadded':
        return this.convertChildren(kids);
      case 'semantics':
        return kids[0] ? this.node(kids[0]) : '';
      case 'annotation':
      case 'annotation-xml':
      case 'mphantom':
      case 'none':
      case 'mprescripts':
        return '';
      case 'mrow':
        return this.row(kids);
      case 'mi': {
        const t = text(el);
        // Multi-letter identifiers (sin, log, lim) are upright by convention.
        return run(t, variantStyle(el, [...t].length > 1));
      }
      case 'mn':
        return run(text(el), variantStyle(el, false));
      case 'mo': {
        const t = text(el);
        if (t === '⁡' || t === '⁢' || t === '⁣') return '';
        return run(t, { ...variantStyle(el, false), sty: 'p' });
      }
      case 'mtext':
      case 'ms':
        return run(text(el), { nor: true });
      case 'mspace': {
        const w = parseFloat(el.attrs.width ?? '0');
        if (!w) return '';
        const sp = w < 0.2 ? ' ' : w < 0.3 ? ' ' : w < 0.6 ? ' ' : ' '.repeat(Math.max(1, Math.round(w)));
        return run(sp, { sty: 'p' });
      }
      case 'mfrac': {
        const lt = el.attrs.linethickness;
        const noBar = lt !== undefined && parseFloat(lt) === 0;
        const type = noBar ? 'noBar' : el.attrs.bevelled === 'true' ? 'skw' : '';
        const pr = type ? `<m:fPr><m:type m:val="${type}"/></m:fPr>` : '';
        return `<m:f>${pr}<m:num>${this.node(kids[0])}</m:num><m:den>${this.node(kids[1])}</m:den></m:f>`;
      }
      case 'msqrt':
        return `<m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/>${e(this.convertChildren(kids))}</m:rad>`;
      case 'mroot':
        return `<m:rad><m:deg>${this.node(kids[1])}</m:deg>${e(this.node(kids[0]))}</m:rad>`;
      case 'msub':
        return `<m:sSub>${e(this.node(kids[0]))}<m:sub>${this.node(kids[1])}</m:sub></m:sSub>`;
      case 'msup':
        return `<m:sSup>${e(this.node(kids[0]))}<m:sup>${this.node(kids[1])}</m:sup></m:sSup>`;
      case 'msubsup':
        return `<m:sSubSup>${e(this.node(kids[0]))}<m:sub>${this.node(kids[1])}</m:sub><m:sup>${this.node(kids[2])}</m:sup></m:sSubSup>`;
      case 'mmultiscripts':
        return this.multiscripts(kids);
      case 'mover':
        return this.over(el, kids);
      case 'munder':
        return this.under(kids);
      case 'munderover':
        return `<m:limUpp>${e(this.under(kids.slice(0, 2)))}<m:lim>${this.node(kids[2])}</m:lim></m:limUpp>`;
      case 'mtable':
        return this.table(el, kids);
      case 'mtr':
      case 'mlabeledtr':
      case 'mtd':
        return this.convertChildren(kids);
      case 'menclose':
        return `<m:borderBox>${e(this.convertChildren(kids))}</m:borderBox>`;
      case 'mfenced': {
        const open = el.attrs.open ?? '(';
        const close = el.attrs.close ?? ')';
        const sep = el.attrs.separators ?? ',';
        return this.delim(open, close, kids.map((k) => this.node(k)), sep);
      }
      case 'merror':
        return run(text(el), { nor: true });
      default:
        return this.convertChildren(kids);
    }
  }

  /** <mrow>: detect fenced groups ( … ) and convert to m:d. */
  private row(kids: XmlElement[]): string {
    if (kids.length >= 2) {
      const first = moText(kids[0]);
      const last = moText(kids[kids.length - 1]);
      const lastEl = unwrap(kids[kids.length - 1]);
      const lastIsFence = last !== null && (CLOSE.has(last.trim()) || (last.trim() === '' && lastEl.attrs.fence === 'true'));
      const firstEl = unwrap(kids[0]);
      const firstIsFence = first !== null && (OPEN.has(first.trim()) || (first.trim() === '' && firstEl.attrs.fence === 'true'));
      if (firstIsFence && lastIsFence && balanced(kids.slice(1, -1))) {
        return this.delim(first!.trim(), last!.trim(), [this.convertChildren(kids.slice(1, -1))]);
      }
    }
    return this.convertChildren(kids);
  }

  private delim(open: string, close: string, parts: string[], sep = ''): string {
    const props = [`<m:begChr m:val="${escapeXml(open)}"/>`];
    if (sep && parts.length > 1) props.push(`<m:sepChr m:val="${escapeXml(sep[0])}"/>`);
    props.push(`<m:endChr m:val="${escapeXml(close)}"/>`);
    return `<m:d><m:dPr>${props.join('')}</m:dPr>${parts.map(e).join('')}</m:d>`;
  }

  private over(el: XmlElement, kids: XmlElement[]): string {
    const base = this.node(kids[0]);
    const mark = kids[1] ? moText(kids[1]) : null;
    if (mark !== null) {
      const m = mark.trim();
      if (BARS.has(m)) return `<m:bar><m:barPr><m:pos m:val="top"/></m:barPr>${e(base)}</m:bar>`;
      if (GROUP_CHARS.has(m)) {
        return `<m:groupChr><m:groupChrPr><m:chr m:val="${escapeXml(m)}"/><m:pos m:val="top"/><m:vertJc m:val="bot"/></m:groupChrPr>${e(base)}</m:groupChr>`;
      }
      const acc = ACCENTS[m];
      if (acc && (el.attrs.accent === 'true' || unwrap(kids[1]).attrs.stretchy === 'false' || m.length === 1)) {
        return `<m:acc><m:accPr><m:chr m:val="${acc}"/></m:accPr>${e(base)}</m:acc>`;
      }
    }
    return `<m:limUpp>${e(base)}<m:lim>${this.node(kids[1])}</m:lim></m:limUpp>`;
  }

  private under(kids: XmlElement[]): string {
    const base = this.node(kids[0]);
    const mark = kids[1] ? moText(kids[1]) : null;
    if (mark !== null) {
      const m = mark.trim();
      if (BARS.has(m)) return `<m:bar><m:barPr><m:pos m:val="bot"/></m:barPr>${e(base)}</m:bar>`;
      if (GROUP_CHARS.has(m)) {
        return `<m:groupChr><m:groupChrPr><m:chr m:val="${escapeXml(m)}"/><m:pos m:val="bot"/><m:vertJc m:val="top"/></m:groupChrPr>${e(base)}</m:groupChr>`;
      }
    }
    return `<m:limLow>${e(base)}<m:lim>${this.node(kids[1])}</m:lim></m:limLow>`;
  }

  private multiscripts(kids: XmlElement[]): string {
    const pre = kids.findIndex((k) => localName(k) === 'mprescripts');
    const base = this.node(kids[0]);
    const post = kids.slice(1, pre < 0 ? undefined : pre);
    let out = base;
    if (post.length >= 2) {
      out = `<m:sSubSup>${e(base)}<m:sub>${this.node(post[0])}</m:sub><m:sup>${this.node(post[1])}</m:sup></m:sSubSup>`;
    }
    if (pre >= 0) {
      const p = kids.slice(pre + 1);
      return `<m:sPre><m:sub>${this.node(p[0])}</m:sub><m:sup>${this.node(p[1])}</m:sup>${e(out)}</m:sPre>`;
    }
    return out;
  }

  private table(el: XmlElement, kids: XmlElement[]): string {
    const rows = kids.filter((k) => ['mtr', 'mlabeledtr'].includes(localName(k)));
    const cells = rows.map((r) => {
      const tds = elements(r).filter((c) => localName(c) === 'mtd');
      // mlabeledtr: first cell is the equation label; drop it.
      return localName(r) === 'mlabeledtr' ? tds.slice(1) : tds;
    });
    const align = (el.attrs.columnalign ?? '').split(/\s+/);
    const isAligned = el.attrs.displaystyle === 'true' && align[0] === 'right' && align[1] === 'left';
    if (isAligned) {
      // Equation array: one line per row, '&' alignment marks via m:aln on the relation.
      const lines = cells.map((tds) => e(tds.map((td) => this.convertChildren(elements(td))).join('')));
      return `<m:eqArr>${lines.join('')}</m:eqArr>`;
    }
    const cols = Math.max(1, ...cells.map((c) => c.length));
    const jc = align[0] === 'left' ? 'left' : align[0] === 'right' ? 'right' : 'center';
    const mPr = `<m:mPr><m:mcs><m:mc><m:mcPr><m:count m:val="${cols}"/><m:mcJc m:val="${jc}"/></m:mcPr></m:mc></m:mcs></m:mPr>`;
    const mrs = cells.map((tds) => {
      const filled = [...tds.map((td) => this.convertChildren(elements(td)))];
      while (filled.length < cols) filled.push('');
      return `<m:mr>${filled.map(e).join('')}</m:mr>`;
    });
    return `<m:m>${mPr}${mrs.join('')}</m:m>`;
  }
}

export interface OmmlOptions {
  /** Wrap in <m:oMathPara> (display equation on its own line). Default: from MathML display attr. */
  para?: boolean;
  /** Add xmlns:m on the root element (for standalone use / clipboard). */
  namespace?: boolean;
}

export function mathmlToOmml(mathml: string, opts: OmmlOptions = {}): string {
  const root = parseXml(mathml);
  if (localName(root) !== 'math') throw new Error('Expected a <math> root element');
  const body = new Converter().node(root);
  const ns = opts.namespace ? ` xmlns:m="${OMML_NS}"` : '';
  const para = opts.para ?? root.attrs.display === 'block';
  return para
    ? `<m:oMathPara${ns}><m:oMath>${body}</m:oMath></m:oMathPara>`
    : `<m:oMath${ns}>${body}</m:oMath>`;
}

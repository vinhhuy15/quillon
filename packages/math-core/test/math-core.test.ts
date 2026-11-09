import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { createMathNode, createTextNode } from '@sciforge/doc-model';
import {
  buildDocx,
  getPngTexts,
  latexToMathML,
  latexToOmml,
  latexToSvg,
  layoutMath,
  looksLikeLatex,
  mathToSvg,
  normalizeLatex,
  parseXml,
  readSvgSource,
  sceneToSvg,
  setPngText,
  validateLatex,
  wordClipboardHtml,
} from '../src';

const L = String.raw;

/** Formulas covering every palette group; all must convert cleanly. */
const CORPUS = [
  L`\frac{-b\pm\sqrt{b^2-4ac}}{2a}`,
  L`\sum_{i=1}^{n} x_i^2`,
  L`\int_0^\infty e^{-x^2}\,dx=\frac{\sqrt{\pi}}{2}`,
  L`\oint_C \vec{F}\cdot d\vec{r}`,
  L`\lim_{x\to 0}\frac{\sin x}{x}=1`,
  L`\begin{pmatrix}a&b\\c&d\end{pmatrix}`,
  L`\begin{bmatrix}1&0&0\\0&1&0\\0&0&1\end{bmatrix}`,
  L`\det\begin{vmatrix}a&b\\c&d\end{vmatrix}=ad-bc`,
  L`f(x)=\begin{cases}x^2 & x\ge 0\\-x & x<0\end{cases}`,
  L`\begin{aligned}a&=b+c\\d&=e\end{aligned}`,
  L`\sqrt[3]{x+1}`,
  L`\vec{v}+\hat{x}+\tilde{y}+\dot{z}+\ddot{q}+\bar{w}`,
  L`\overline{AB}\perp\underline{CD}`,
  L`\overbrace{a+b}^{n}+\underbrace{c+d}_{m}`,
  L`\binom{n}{k}=\frac{n!}{k!(n-k)!}`,
  L`\left[\frac{1}{2}\right]\left\{x\right\}\left|y\right|\left\langle z\right\rangle`,
  L`\mathbb{R}\mathcal{L}\mathfrak{g}\mathbf{F}\mathrm{d}\boldsymbol{\alpha}`,
  L`\alpha\beta\gamma\Delta\Omega\varphi\epsilon`,
  L`\nabla\times\vec{E}=-\frac{\partial\vec{B}}{\partial t}`,
  L`\ce{2H2 + O2 -> 2H2O}`,
  L`\ce{CO2 + C <=> 2CO}`,
  L`x\xrightarrow[\text{below}]{\text{above}}y`,
  L`\text{Định lý: } a^2+b^2=c^2`,
  L`\prod_{k=1}^{\infty}\left(1+\frac{1}{k^2}\right)`,
  L`\iint_D f(x,y)\,dA`,
  L`\max_{x\in S} f(x)`,
  L`\boxed{E=mc^2}`,
  L`a<b \leq c \neq d \approx e`,
  L`\cos^2\theta+\sin^2\theta=1`,
  L`x'+y''`,
  L`{}^{14}_{6}\mathrm{C}`,
];

describe('LaTeX pipeline', () => {
  it.each(CORPUS)('renders and converts %s', (tex) => {
    const svg = latexToSvg(tex);
    expect(svg.svg.startsWith('<svg')).toBe(true);
    expect(svg.widthEm).toBeGreaterThan(0);
    const mml = latexToMathML(tex);
    expect(parseXml(mml).name).toBe('math');
    const omml = latexToOmml(tex, true, { namespace: true });
    const root = parseXml(omml); // well-formed
    expect(root.name).toBe('m:oMathPara');
    expect(omml).not.toMatch(/<m:r><m:t><\/m:t>/);
  });

  it('reports errors instead of rendering red text', () => {
    expect(validateLatex(L`\frac{a}{b}`)).toBeNull();
    expect(validateLatex(L`\frac{a`)).toMatch(/.+/);
    expect(validateLatex(L`\notacommand x`)).toMatch(/Undefined control sequence/);
  });

  it('supports MathLive-specific commands', () => {
    expect(validateLatex(L`\int f\,\differentialD x + \exponentialE^{\imaginaryI\pi}`)).toBeNull();
    expect(normalizeLatex(L`\frac{\placeholder{}}{x}`)).toBe(L`\frac{\square }{x}`);
    expect(normalizeLatex('$$x^2$$')).toBe('x^2');
  });

  it('detects LaTeX in pasted text', () => {
    expect(looksLikeLatex(L`\frac{1}{2}`)).toBe(true);
    expect(looksLikeLatex('$x$')).toBe(true);
    expect(looksLikeLatex('x^2+y^2=z^2')).toBe(true);
    expect(looksLikeLatex('Hello, this is a sentence.')).toBe(false);
  });
});

describe('OMML structure', () => {
  const omml = (t: string) => latexToOmml(t, false);
  it('maps the main constructs', () => {
    expect(omml(L`\frac{a}{b}`)).toBe('<m:oMath><m:f><m:num><m:r><m:t>a</m:t></m:r></m:num><m:den><m:r><m:t>b</m:t></m:r></m:den></m:f></m:oMath>');
    expect(omml(L`\sqrt{x}`)).toContain('<m:degHide m:val="1"/>');
    expect(omml(L`\sqrt[3]{x}`)).toContain('<m:deg><m:r><m:t>3</m:t></m:r></m:deg>');
    expect(omml('x_i^2')).toContain('<m:sSubSup>');
    expect(omml(L`\binom{n}{k}`)).toMatch(/<m:d>.*<m:type m:val="noBar"\/>/);
    expect(omml(L`\vec{v}`)).toContain('<m:acc><m:accPr><m:chr m:val="⃗"/>');
    expect(omml(L`\overline{AB}`)).toContain('<m:bar>');
    expect(omml(L`\underbrace{x}_{n}`)).toContain('<m:groupChr>');
    expect(omml(L`\lim_{x\to0} x`)).toContain('<m:limLow>');
    expect(omml(L`\sin x`)).toContain('<m:sty m:val="p"/></m:rPr><m:t>sin</m:t>');
    expect(omml(L`\text{if }x`)).toContain('<m:nor/>');
    expect(omml(L`\mathbb{R}`)).toContain('<m:scr m:val="double-struck"/>');
  });

  it('absorbs the operand of big operators', () => {
    const o = omml(L`\sum_{i=1}^{n} x_i = S`);
    expect(o).toMatch(/<m:nary><m:naryPr><m:chr m:val="∑"\/><m:limLoc m:val="undOvr"\/><\/m:naryPr><m:sub>.*<\/m:sub><m:sup>.*<\/m:sup><m:e><m:sSub>.*<\/m:e><\/m:nary><m:r><m:rPr><m:sty m:val="p"\/><\/m:rPr><m:t>=<\/m:t>/);
    expect(omml(L`\int_0^1 f\,dx`)).toContain('<m:limLoc m:val="subSup"/>');
  });

  it('builds matrices and fences', () => {
    const o = omml(L`\begin{pmatrix}a&b\\c&d\end{pmatrix}`);
    expect(o).toContain('<m:begChr m:val="("/>');
    expect(o).toContain('<m:count m:val="2"/>');
    expect(o.match(/<m:mr>/g)).toHaveLength(2);
    expect(omml(L`\begin{aligned}a&=b\\c&=d\end{aligned}`)).toContain('<m:eqArr>');
    // (a)+(b) must not become one delimiter group
    expect(omml('{(a)+(b)}')).not.toContain('<m:d>');
  });
});

describe('scene + exports', () => {
  it('lays out math in px proportional to font size', () => {
    const a = layoutMath('x^2', true, 20, '#000');
    const b = layoutMath('x^2', true, 40, '#000');
    expect(b.width / a.width).toBeCloseTo(2, 5);
    expect(a.markup).toContain('fill="#000"');
    expect(layoutMath(L`\frac{`, true, 20, '#000').error).toBeTruthy();
  });

  it('embeds and reads back equation source in SVG', () => {
    const { svg } = mathToSvg({ latex: L`\alpha<\beta & "q"`, display: true, fontSize: 30, color: '#123456' });
    expect(parseXml(svg).name).toBe('svg');
    const src = readSvgSource(svg);
    expect(src?.latex).toBe(L`\alpha<\beta & "q"`);
    expect(src?.fontSize).toBe(30);
    expect(readSvgSource('<svg xmlns="http://www.w3.org/2000/svg"/>')).toBeNull();
  });

  it('renders a scene with numbers and text', () => {
    const m = createMathNode({ id: 'm', latex: 'E=mc^2', x: 100, y: 50, numbered: true });
    const t = createTextNode({ id: 't', text: 'Line 1\nLine <2>', x: 100, y: 150 });
    const { svg, width, height } = sceneToSvg([m, t], { numbers: new Map([['m', 1]]) });
    expect(parseXml(svg).name).toBe('svg');
    expect(svg).toContain('>(1)</text>');
    expect(svg).toContain('Line &lt;2&gt;');
    expect(width).toBeGreaterThan(50);
    expect(height).toBeGreaterThan(100);
  });

  it('writes and reads PNG iTXt chunks', () => {
    // 1x1 transparent PNG
    const b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const png = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const tagged = setPngText(png, 'sciforge', '{"latex":"\\\\int ∂x"}');
    expect(getPngTexts(tagged).sciforge).toBe('{"latex":"\\\\int ∂x"}');
    const again = setPngText(tagged, 'sciforge', 'v2');
    expect(getPngTexts(again)).toEqual({ sciforge: 'v2' });
    expect(again.length).toBeLessThan(tagged.length);
  });

  it('builds a valid docx with equations and text', () => {
    const bytes = buildDocx([
      { kind: 'text', text: 'Heading & <stuff>', bold: true, fontSizePt: 14 },
      { kind: 'math', omml: latexToOmml(L`\frac{1}{2}`) },
      { kind: 'math', omml: latexToOmml('a^2+b^2=c^2'), number: 1 },
    ]);
    const files = unzipSync(bytes);
    expect(Object.keys(files).sort()).toEqual(['[Content_Types].xml', '_rels/.rels', 'docProps/core.xml', 'word/document.xml']);
    const doc = strFromU8(files['word/document.xml']);
    const root = parseXml(doc);
    expect(root.name).toBe('w:document');
    expect(doc).toContain('<m:oMathPara><m:oMath><m:f>');
    expect(doc).toContain('<w:t>(1)</w:t>');
  });

  it('builds Word clipboard HTML', () => {
    const html = wordClipboardHtml(latexToOmml('x'), latexToMathML('x'));
    // Format verified against Word 16 (HTML import recognises it as a native equation).
    expect(html).toContain('xmlns:m="http://schemas.microsoft.com/office/2004/12/omml"');
    expect(html).toContain('<!--[if gte msEquation 12]><m:oMathPara><m:oMath>');
    expect(html).toContain(`<span style='font-family:"Cambria Math"'><m:r>x</m:r></span>`);
    expect(html).not.toContain('<m:t>');
  });
});

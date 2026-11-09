/**
 * Symbol palettes. Insert strings use MathLive syntax:
 *   #0 = current selection (or placeholder), #? = empty placeholder.
 */
export interface PaletteItem {
  /** LaTeX inserted at the caret. */
  i: string;
  /** LaTeX shown on the button (defaults to `i` with placeholders as boxes). */
  d?: string;
  /** Tooltip (defaults to the inserted LaTeX). */
  t?: string;
}

export interface PaletteGroup {
  id: string;
  label: [string, string]; // [vi, en]
  icon: string; // LaTeX for the tab
  wide?: boolean; // larger buttons for structures
  items: PaletteItem[];
}

const s = (list: string) => list.trim().split(/\s+/).map((i) => ({ i }));

export const PALETTES: PaletteGroup[] = [
  {
    id: 'greek',
    label: ['Chữ Hy Lạp', 'Greek'],
    icon: String.raw`\alpha\Omega`,
    items: s(String.raw`
      \alpha \beta \gamma \delta \epsilon \varepsilon \zeta \eta \theta \vartheta \iota \kappa \lambda \mu \nu \xi
      \pi \varpi \rho \varrho \sigma \varsigma \tau \upsilon \phi \varphi \chi \psi \omega
      \Gamma \Delta \Theta \Lambda \Xi \Pi \Sigma \Upsilon \Phi \Psi \Omega
      \aleph \hbar \ell \wp \Re \Im \partial \nabla \infty`),
  },
  {
    id: 'operators',
    label: ['Phép toán', 'Operators'],
    icon: String.raw`\pm\times`,
    items: s(String.raw`
      + - \pm \mp \times \div \cdot \ast \star \circ \bullet \oplus \ominus \otimes \oslash \odot
      \cup \cap \setminus \sqcup \uplus \wedge \vee \neg \land \lor \dagger \ddagger \amalg
      \nabla \partial \prime ! \% \angle \measuredangle \triangle \square \diamond \bigcirc`),
  },
  {
    id: 'relations',
    label: ['Quan hệ', 'Relations'],
    icon: String.raw`\le\approx`,
    items: s(String.raw`
      = \neq < > \le \ge \leqslant \geqslant \ll \gg \approx \sim \simeq \cong \equiv \not\equiv \propto
      \doteq \triangleq \coloneqq \prec \succ \preceq \succeq \in \notin \ni \subset \supset \subseteq \supseteq
      \subsetneq \supsetneq \sqsubseteq \parallel \nparallel \perp \mid \nmid \vdash \models \asymp \bowtie`),
  },
  {
    id: 'arrows',
    label: ['Mũi tên', 'Arrows'],
    icon: String.raw`\Rightarrow`,
    items: [
      ...s(String.raw`
      \to \gets \leftrightarrow \Rightarrow \Leftarrow \Leftrightarrow \implies \impliedby \iff
      \mapsto \longmapsto \longrightarrow \longleftarrow \Longrightarrow \Longleftarrow \Longleftrightarrow
      \uparrow \downarrow \updownarrow \Uparrow \Downarrow \nearrow \searrow \swarrow \nwarrow
      \rightleftharpoons \leftrightharpoons \rightharpoonup \rightharpoondown \hookrightarrow \hookleftarrow
      \twoheadrightarrow \rightsquigarrow \circlearrowleft \circlearrowright`),
      { i: String.raw`\xrightarrow{#0}`, t: 'xrightarrow' },
      { i: String.raw`\xleftarrow{#0}`, t: 'xleftarrow' },
      { i: String.raw`\xrightarrow[#?]{#0}`, t: 'xrightarrow[below]{above}' },
      { i: String.raw`\overset{#?}{\rightleftharpoons}`, d: String.raw`\overset{\square}{\rightleftharpoons}` },
    ],
  },
  {
    id: 'structures',
    label: ['Cấu trúc', 'Structures'],
    icon: String.raw`\frac{a}{b}`,
    wide: true,
    items: [
      { i: String.raw`\frac{#0}{#?}`, t: 'Fraction' },
      { i: String.raw`\dfrac{#0}{#?}`, t: 'Display fraction' },
      { i: String.raw`{#0}/{#?}`, t: 'Slash fraction' },
      { i: String.raw`\sqrt{#0}`, t: 'Square root' },
      { i: String.raw`\sqrt[#?]{#0}`, t: 'n-th root' },
      { i: String.raw`#0^{#?}`, t: 'Superscript' },
      { i: String.raw`#0_{#?}`, t: 'Subscript' },
      { i: String.raw`#0_{#?}^{#?}`, t: 'Sub + superscript' },
      { i: String.raw`{}_{#?}^{#?}#0`, t: 'Left scripts' },
      { i: String.raw`\binom{#0}{#?}`, t: 'Binomial' },
      { i: String.raw`\vec{#0}`, t: 'Vector' },
      { i: String.raw`\overrightarrow{#0}`, t: 'Arrow over' },
      { i: String.raw`\hat{#0}`, t: 'Hat' },
      { i: String.raw`\widehat{#0}`, t: 'Wide hat' },
      { i: String.raw`\bar{#0}`, t: 'Bar' },
      { i: String.raw`\overline{#0}`, t: 'Overline' },
      { i: String.raw`\underline{#0}`, t: 'Underline' },
      { i: String.raw`\dot{#0}`, t: 'Dot' },
      { i: String.raw`\ddot{#0}`, t: 'Double dot' },
      { i: String.raw`\tilde{#0}`, t: 'Tilde' },
      { i: String.raw`\widetilde{#0}`, t: 'Wide tilde' },
      { i: String.raw`\overbrace{#0}^{#?}`, t: 'Overbrace' },
      { i: String.raw`\underbrace{#0}_{#?}`, t: 'Underbrace' },
      { i: String.raw`\overset{#?}{#0}`, t: 'Over-set' },
      { i: String.raw`\underset{#?}{#0}`, t: 'Under-set' },
      { i: String.raw`\boxed{#0}`, t: 'Box' },
      { i: String.raw`\cancel{#0}`, t: 'Cancel' },
      { i: String.raw`\text{#0}`, d: String.raw`\text{abc}`, t: 'Text' },
    ],
  },
  {
    id: 'bigops',
    label: ['Tổng, tích phân', 'Sums & integrals'],
    icon: String.raw`\sum\int`,
    wide: true,
    items: [
      { i: String.raw`\sum_{#?}^{#?}#0`, t: 'Sum' },
      { i: String.raw`\sum_{#?}#0`, t: 'Sum (lower)' },
      { i: String.raw`\prod_{#?}^{#?}#0`, t: 'Product' },
      { i: String.raw`\coprod_{#?}^{#?}#0`, t: 'Coproduct' },
      { i: String.raw`\int #0\,\mathrm{d}#?`, t: 'Integral' },
      { i: String.raw`\int_{#?}^{#?}#0\,\mathrm{d}#?`, t: 'Definite integral' },
      { i: String.raw`\iint_{#?}#0\,\mathrm{d}#?`, t: 'Double integral' },
      { i: String.raw`\iiint_{#?}#0\,\mathrm{d}#?`, t: 'Triple integral' },
      { i: String.raw`\oint_{#?}#0\,\mathrm{d}#?`, t: 'Contour integral' },
      { i: String.raw`\bigcup_{#?}^{#?}#0`, t: 'Union' },
      { i: String.raw`\bigcap_{#?}^{#?}#0`, t: 'Intersection' },
      { i: String.raw`\bigoplus_{#?}#0`, t: 'Direct sum' },
      { i: String.raw`\lim_{#?\to #?}#0`, t: 'Limit' },
      { i: String.raw`\lim_{x\to\infty}#0`, t: 'Limit to infinity' },
      { i: String.raw`\max_{#?}#0`, t: 'Max' },
      { i: String.raw`\min_{#?}#0`, t: 'Min' },
      { i: String.raw`\sup_{#?}#0`, t: 'Supremum' },
      { i: String.raw`\inf_{#?}#0`, t: 'Infimum' },
      { i: String.raw`\frac{\mathrm{d}#0}{\mathrm{d}#?}`, t: 'Derivative' },
      { i: String.raw`\frac{\mathrm{d}^{2}#0}{\mathrm{d}#?^{2}}`, t: 'Second derivative' },
      { i: String.raw`\frac{\partial #0}{\partial #?}`, t: 'Partial derivative' },
      { i: String.raw`\frac{\partial^{2} #0}{\partial #?\,\partial #?}`, t: 'Mixed partial' },
      { i: String.raw`\left.#0\right|_{#?}^{#?}`, t: 'Evaluate' },
    ],
  },
  {
    id: 'brackets',
    label: ['Ngoặc', 'Brackets'],
    icon: String.raw`(\,)`,
    wide: true,
    items: [
      { i: String.raw`\left(#0\right)` },
      { i: String.raw`\left[#0\right]` },
      { i: String.raw`\left\{#0\right\}` },
      { i: String.raw`\left|#0\right|` },
      { i: String.raw`\left\|#0\right\|` },
      { i: String.raw`\left\langle #0\right\rangle` },
      { i: String.raw`\left\lfloor #0\right\rfloor` },
      { i: String.raw`\left\lceil #0\right\rceil` },
      { i: String.raw`\left[#0\right)` },
      { i: String.raw`\left(#0\right]` },
      { i: String.raw`\left]#0\right[` },
      { i: String.raw`\left\{#0\right.` },
      { i: String.raw`\left.#0\right\}` },
      { i: String.raw`\left\langle #0\middle|#?\right\rangle`, t: 'Bra-ket' },
      { i: String.raw`\left|#0\right\rangle`, t: 'Ket' },
      { i: String.raw`\left\langle #0\right|`, t: 'Bra' },
    ],
  },
  {
    id: 'matrices',
    label: ['Ma trận', 'Matrices'],
    icon: String.raw`\begin{bmatrix}\cdot\end{bmatrix}`,
    wide: true,
    items: [
      { i: String.raw`\begin{pmatrix}#0&#?\\#?&#?\end{pmatrix}`, t: '2×2 ( )' },
      { i: String.raw`\begin{bmatrix}#0&#?\\#?&#?\end{bmatrix}`, t: '2×2 [ ]' },
      { i: String.raw`\begin{vmatrix}#0&#?\\#?&#?\end{vmatrix}`, t: 'Determinant 2×2' },
      { i: String.raw`\begin{pmatrix}#0&#?&#?\\#?&#?&#?\\#?&#?&#?\end{pmatrix}`, t: '3×3 ( )' },
      { i: String.raw`\begin{bmatrix}#0&#?&#?\\#?&#?&#?\\#?&#?&#?\end{bmatrix}`, t: '3×3 [ ]' },
      { i: String.raw`\begin{vmatrix}#0&#?&#?\\#?&#?&#?\\#?&#?&#?\end{vmatrix}`, t: 'Determinant 3×3' },
      { i: String.raw`\begin{Vmatrix}#0&#?\\#?&#?\end{Vmatrix}`, t: 'Norm matrix' },
      { i: String.raw`\begin{pmatrix}#0\\#?\end{pmatrix}`, t: 'Column vector 2' },
      { i: String.raw`\begin{pmatrix}#0\\#?\\#?\end{pmatrix}`, t: 'Column vector 3' },
      { i: String.raw`\begin{pmatrix}#0&#?&#?\end{pmatrix}`, t: 'Row vector' },
      {
        i: String.raw`\begin{pmatrix}a_{11}&a_{12}&\cdots&a_{1n}\\a_{21}&a_{22}&\cdots&a_{2n}\\\vdots&\vdots&\ddots&\vdots\\a_{m1}&a_{m2}&\cdots&a_{mn}\end{pmatrix}`,
        t: 'm×n general',
      },
      { i: String.raw`\begin{cases}#0&#?\\#?&#?\end{cases}`, t: 'Cases' },
      { i: String.raw`\begin{cases}#0\\#?\end{cases}`, t: 'System of equations' },
      { i: String.raw`\begin{aligned}#0&=#?\\&=#?\end{aligned}`, t: 'Aligned' },
      { i: String.raw`\begin{array}{c|c}#0&#?\\\hline #?&#?\end{array}`, t: 'Array with lines' },
      ...s(String.raw`\cdots \vdots \ddots \ldots`),
    ],
  },
  {
    id: 'functions',
    label: ['Hàm', 'Functions'],
    icon: String.raw`\sin`,
    items: [
      ...s(String.raw`\sin \cos \tan \cot \sec \csc \arcsin \arccos \arctan \sinh \cosh \tanh \coth
        \log \ln \lg \exp \det \dim \ker \deg \arg \gcd \hom \Pr`).map((x) => ({ i: `${x.i} #0`, d: x.i, t: x.i })),
      { i: String.raw`\log_{#?}#0`, t: 'log base' },
      { i: String.raw`\operatorname{#0}`, d: String.raw`\operatorname{f}`, t: 'Custom operator' },
      { i: String.raw`\mathrm{e}^{#0}`, t: 'Exponential' },
      { i: String.raw`f\left(#0\right)`, t: 'f(x)' },
      { i: String.raw`f'\left(#0\right)`, t: "f'(x)" },
    ],
  },
  {
    id: 'chemistry',
    label: ['Hóa học', 'Chemistry'],
    icon: String.raw`\ce{H2O}`,
    wide: true,
    items: [
      { i: String.raw`\ce{#0}`, d: String.raw`\ce{H2O}`, t: 'Chemical formula (mhchem)' },
      { i: String.raw`\ce{#0 -> #?}`, d: String.raw`\ce{A -> B}`, t: 'Reaction' },
      { i: String.raw`\ce{#0 <=> #?}`, d: String.raw`\ce{A <=> B}`, t: 'Equilibrium' },
      { i: String.raw`\ce{#0 ->[#?] #?}`, d: String.raw`\ce{A ->[t^\circ] B}`, t: 'Reaction with condition' },
      { i: String.raw`\ce{2H2 + O2 -> 2H2O}`, t: 'Water synthesis' },
      { i: String.raw`\ce{CH4 + 2O2 -> CO2 + 2H2O}`, t: 'Methane combustion' },
      { i: String.raw`\ce{Fe^{2+}}`, t: 'Ion' },
      { i: String.raw`\ce{SO4^{2-}}`, t: 'Polyatomic ion' },
      { i: String.raw`\ce{NaCl_{(aq)}}`, t: 'State' },
      { i: String.raw`\ce{CaCO3 v}`, t: 'Precipitate' },
      { i: String.raw`\ce{CO2 ^}`, t: 'Gas' },
      { i: String.raw`\ce{^{14}_{6}C}`, t: 'Isotope' },
      { i: String.raw`\Delta H^\circ`, t: 'Enthalpy' },
      { i: String.raw`K_{\mathrm{eq}}=\frac{[#0]}{[#?]}`, t: 'Equilibrium constant' },
      { i: String.raw`\mathrm{pH}=-\log\left[\mathrm{H}^{+}\right]`, t: 'pH' },
    ],
  },
  {
    id: 'misc',
    label: ['Ký hiệu khác', 'Misc'],
    icon: String.raw`\forall\mathbb{R}`,
    items: [
      ...s(String.raw`\forall \exists \nexists \emptyset \varnothing \therefore \because \top \bot \complement
        \mathbb{N} \mathbb{Z} \mathbb{Q} \mathbb{R} \mathbb{C} \mathbb{P}
        ^\circ \prime \dots \cdots \vdots \ddots \angle \triangle \parallel \perp \sharp \flat \natural \checkmark \dagger
        \clubsuit \diamondsuit \heartsuit \spadesuit`),
      { i: String.raw`\mathbb{#0}`, d: String.raw`\mathbb{A}`, t: 'Blackboard bold' },
      { i: String.raw`\mathcal{#0}`, d: String.raw`\mathcal{A}`, t: 'Calligraphic' },
      { i: String.raw`\mathfrak{#0}`, d: String.raw`\mathfrak{A}`, t: 'Fraktur' },
      { i: String.raw`\mathscr{#0}`, d: String.raw`\mathscr{A}`, t: 'Script' },
      { i: String.raw`\mathbf{#0}`, d: String.raw`\mathbf{A}`, t: 'Bold' },
      { i: String.raw`\boldsymbol{#0}`, d: String.raw`\boldsymbol{\alpha}`, t: 'Bold symbol' },
      { i: String.raw`\mathrm{#0}`, d: String.raw`\mathrm{A}`, t: 'Roman' },
      { i: String.raw`\mathsf{#0}`, d: String.raw`\mathsf{A}`, t: 'Sans-serif' },
      { i: String.raw`\mathtt{#0}`, d: String.raw`\mathtt{A}`, t: 'Monospace' },
      { i: String.raw`\color{red}{#0}`, d: String.raw`\color{red}{A}`, t: 'Colored' },
      { i: String.raw`\quad`, d: String.raw`\square\quad\square`, t: 'Space (quad)' },
      { i: String.raw`\,`, d: String.raw`\square\,\square`, t: 'Thin space' },
    ],
  },
];

/** Button label LaTeX: placeholders rendered as boxes. */
export function displayLatex(item: PaletteItem): string {
  return (item.d ?? item.i).replace(/#0|#\?/g, '\\square ');
}

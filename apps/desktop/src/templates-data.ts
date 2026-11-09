/** Ready-made formulas, grouped by subject (shown in the right sidebar). */
export interface TemplateGroup {
  id: string;
  label: string;
  items: { latex: string; title: string }[];
}

const R = String.raw;

export const TEMPLATES: TemplateGroup[] = [
  {
    id: 'algebra',
    label: 'Algebra',
    items: [
      { latex: R`ax^2+bx+c=0`, title: 'Quadratic equation' },
      { latex: R`x_{1,2}=\frac{-b\pm\sqrt{b^2-4ac}}{2a}`, title: 'Quadratic formula' },
      { latex: R`\Delta=b^2-4ac`, title: 'Discriminant' },
      { latex: R`\begin{cases}x_1+x_2=-\dfrac{b}{a}\\x_1x_2=\dfrac{c}{a}\end{cases}`, title: "Vieta's formulas" },
      { latex: R`(a+b)^n=\sum_{k=0}^{n}\binom{n}{k}a^{n-k}b^{k}`, title: 'Binomial theorem' },
      { latex: R`a^2-b^2=(a-b)(a+b)`, title: 'Difference of squares' },
      { latex: R`\log_a(xy)=\log_a x+\log_a y`, title: 'Log of a product' },
      { latex: R`S_n=\frac{u_1\left(1-q^n\right)}{1-q}`, title: 'Geometric series' },
      { latex: R`\frac{a+b}{2}\ge\sqrt{ab}`, title: 'AM–GM inequality' },
    ],
  },
  {
    id: 'trig',
    label: 'Trigonometry',
    items: [
      { latex: R`\sin^2\alpha+\cos^2\alpha=1`, title: 'Pythagorean identity' },
      { latex: R`\sin(a\pm b)=\sin a\cos b\pm\cos a\sin b`, title: 'Sine addition' },
      { latex: R`\cos 2a=\cos^2 a-\sin^2 a`, title: 'Cosine double angle' },
      { latex: R`c^2=a^2+b^2-2ab\cos C`, title: 'Law of cosines' },
      { latex: R`\frac{a}{\sin A}=\frac{b}{\sin B}=\frac{c}{\sin C}=2R`, title: 'Law of sines' },
      { latex: R`\mathrm{e}^{\mathrm{i}\theta}=\cos\theta+\mathrm{i}\sin\theta`, title: "Euler's formula" },
    ],
  },
  {
    id: 'calculus',
    label: 'Calculus',
    items: [
      { latex: R`f'(x)=\lim_{h\to 0}\frac{f(x+h)-f(x)}{h}`, title: 'Derivative' },
      { latex: R`\lim_{x\to 0}\frac{\sin x}{x}=1`, title: 'Fundamental limit' },
      { latex: R`\lim_{n\to\infty}\left(1+\frac{1}{n}\right)^n=\mathrm{e}`, title: 'Euler number' },
      { latex: R`\int_a^b f(x)\,\mathrm{d}x=F(b)-F(a)`, title: 'Fundamental theorem' },
      { latex: R`\int u\,\mathrm{d}v=uv-\int v\,\mathrm{d}u`, title: 'Integration by parts' },
      { latex: R`f(x)=\sum_{n=0}^{\infty}\frac{f^{(n)}(a)}{n!}(x-a)^n`, title: 'Taylor series' },
      { latex: R`\int_{-\infty}^{\infty}\mathrm{e}^{-x^2}\,\mathrm{d}x=\sqrt{\pi}`, title: 'Gaussian integral' },
      { latex: R`\nabla f=\left(\frac{\partial f}{\partial x},\frac{\partial f}{\partial y},\frac{\partial f}{\partial z}\right)`, title: 'Gradient' },
    ],
  },
  {
    id: 'linalg',
    label: 'Linear algebra',
    items: [
      { latex: R`A=\begin{pmatrix}a_{11}&a_{12}&a_{13}\\a_{21}&a_{22}&a_{23}\\a_{31}&a_{32}&a_{33}\end{pmatrix}`, title: '3×3 matrix' },
      { latex: R`\det\begin{pmatrix}a&b\\c&d\end{pmatrix}=ad-bc`, title: '2×2 determinant' },
      { latex: R`A^{-1}=\frac{1}{ad-bc}\begin{pmatrix}d&-b\\-c&a\end{pmatrix}`, title: 'Inverse 2×2' },
      { latex: R`A\mathbf{v}=\lambda\mathbf{v}`, title: 'Eigenvalue equation' },
      { latex: R`\det(A-\lambda I)=0`, title: 'Characteristic equation' },
      { latex: R`\mathbf{a}\cdot\mathbf{b}=\|\mathbf{a}\|\|\mathbf{b}\|\cos\theta`, title: 'Dot product' },
    ],
  },
  {
    id: 'stats',
    label: 'Probability & statistics',
    items: [
      { latex: R`f(x)=\frac{1}{\sigma\sqrt{2\pi}}\mathrm{e}^{-\frac{(x-\mu)^2}{2\sigma^2}}`, title: 'Normal distribution' },
      { latex: R`P(A\mid B)=\frac{P(B\mid A)\,P(A)}{P(B)}`, title: "Bayes' theorem" },
      { latex: R`\bar{x}=\frac{1}{n}\sum_{i=1}^{n}x_i`, title: 'Sample mean' },
      { latex: R`s^2=\frac{1}{n-1}\sum_{i=1}^{n}\left(x_i-\bar{x}\right)^2`, title: 'Sample variance' },
      { latex: R`P(X=k)=\binom{n}{k}p^k(1-p)^{n-k}`, title: 'Binomial distribution' },
      { latex: R`\mathbb{E}[X]=\sum_{i}x_i\,p_i`, title: 'Expectation' },
    ],
  },
  {
    id: 'physics',
    label: 'Physics',
    items: [
      { latex: R`\vec{F}=m\vec{a}`, title: "Newton's second law" },
      { latex: R`E=mc^2`, title: 'Mass–energy' },
      { latex: R`F=k\frac{|q_1q_2|}{r^2}`, title: "Coulomb's law" },
      { latex: R`pV=nRT`, title: 'Ideal gas law' },
      { latex: R`\mathrm{i}\hbar\frac{\partial}{\partial t}\Psi=\hat{H}\Psi`, title: 'Schrödinger equation' },
      {
        latex: R`\begin{aligned}\nabla\cdot\mathbf{E}&=\frac{\rho}{\varepsilon_0}\\\nabla\cdot\mathbf{B}&=0\\\nabla\times\mathbf{E}&=-\frac{\partial\mathbf{B}}{\partial t}\\\nabla\times\mathbf{B}&=\mu_0\mathbf{J}+\mu_0\varepsilon_0\frac{\partial\mathbf{E}}{\partial t}\end{aligned}`,
        title: "Maxwell's equations",
      },
      { latex: R`W_{\mathrm{d}}=\frac{1}{2}mv^2`, title: 'Kinetic energy' },
      { latex: R`x(t)=A\cos(\omega t+\varphi)`, title: 'Harmonic oscillation' },
    ],
  },
  {
    id: 'chem',
    label: 'Chemistry',
    items: [
      { latex: R`\ce{4NH3 + 5O2 ->[Pt][t^\circ] 4NO + 6H2O}`, title: 'Ammonia oxidation' },
      { latex: R`\ce{N2 + 3H2 <=>[xt, t^\circ, p] 2NH3}`, title: 'Haber process' },
      { latex: R`\ce{CaCO3 ->[t^\circ] CaO + CO2 ^}`, title: 'Limestone decomposition' },
      { latex: R`\ce{Ag+ + Cl- -> AgCl v}`, title: 'Precipitation' },
      { latex: R`\ce{CH3COOH <=> CH3COO- + H+}`, title: 'Weak acid dissociation' },
    ],
  },
];

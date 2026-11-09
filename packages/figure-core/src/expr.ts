/**
 * A small, safe math expression compiler for function plots.
 * Accepts the way people type formulas: `2x^2 - 3x + 1`, `sin x`, `e^(-x^2/2)`, `|x|`, `sqrt(1-x^2)`.
 * No `eval`: the input is tokenized, parsed into closures and only calls a fixed set of functions.
 */

export class ExprError extends Error {
  constructor(message: string, readonly pos: number) {
    super(message);
    this.name = 'ExprError';
  }
}

export type Env = Record<string, number>;
export type Compiled = (env: Env) => number;

const FUNCS: Record<string, (...a: number[]) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  cot: (x) => 1 / Math.tan(x),
  sec: (x) => 1 / Math.cos(x),
  csc: (x) => 1 / Math.sin(x),
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  arcsin: Math.asin,
  arccos: Math.acos,
  arctan: Math.atan,
  sinh: Math.sinh,
  cosh: Math.cosh,
  tanh: Math.tanh,
  exp: Math.exp,
  ln: Math.log,
  log: Math.log10,
  lg: Math.log10,
  log2: Math.log2,
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  abs: Math.abs,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  sign: Math.sign,
  sgn: Math.sign,
  min: Math.min,
  max: Math.max,
  mod: (a, b) => ((a % b) + b) % b,
};

const CONSTS: Record<string, number> = { pi: Math.PI, π: Math.PI, e: Math.E, tau: 2 * Math.PI };

/** Aliases so that `θ`, `theta` and `t` are interchangeable for polar/parametric curves. */
const VAR_ALIASES: Record<string, string> = { theta: 't', θ: 't', φ: 't', phi: 't' };

type Tok =
  | { k: 'num'; v: number; p: number }
  | { k: 'id'; v: string; p: number }
  | { k: 'op'; v: string; p: number }
  | { k: 'end'; p: number };

const NAMES = [...Object.keys(FUNCS), ...Object.keys(CONSTS), ...Object.keys(VAR_ALIASES)].sort((a, b) => b.length - a.length);

function tokenize(src: string, vars: string[]): Tok[] {
  const out: Tok[] = [];
  const s = src.replace(/\*\*/g, '^').replace(/[·×]/g, '*').replace(/[−–]/g, '-').replace(/÷/g, '/');
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    const numM = /^(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?/.exec(s.slice(i));
    if (numM) {
      out.push({ k: 'num', v: parseFloat(numM[0]), p: i });
      i += numM[0].length;
      continue;
    }
    const idM = /^[A-Za-zα-ωπθφ_][A-Za-z0-9α-ωπθφ_]*/.exec(s.slice(i));
    if (idM) {
      // Split runs like "xsin" or "2pix" into known names / single-letter variables.
      let word = idM[0];
      let p = i;
      while (word) {
        const known = NAMES.find((n) => word.startsWith(n)) ?? vars.find((v) => word.startsWith(v) && v.length > 1);
        const piece = known ?? word[0];
        if (!known && !vars.includes(piece) && !/^\d$/.test(piece)) {
          throw new ExprError(`Unknown name "${idM[0]}"`, i);
        }
        out.push({ k: 'id', v: piece, p });
        word = word.slice(piece.length);
        p += piece.length;
        // Trailing digits after a variable, e.g. "x2", mean x·2.
        const d = /^\d+/.exec(word);
        if (d && !known?.match(/\d$/)) {
          out.push({ k: 'op', v: '*', p }, { k: 'num', v: parseFloat(d[0]), p });
          word = word.slice(d[0].length);
          p += d[0].length;
        }
      }
      i += idM[0].length;
      continue;
    }
    if ('+-*/^(),|!'.includes(c)) {
      out.push({ k: 'op', v: c, p: i });
      i++;
      continue;
    }
    throw new ExprError(`Unexpected "${c}"`, i);
  }
  out.push({ k: 'end', p: s.length });
  return out;
}

function factorial(n: number): number {
  if (n < 0 || !Number.isInteger(n)) return NaN;
  let r = 1;
  for (let i = 2; i <= n && r < Infinity; i++) r *= i;
  return r;
}

/** Compile an expression in the given variables (default `x`). Throws ExprError. */
export function compileExpr(src: string, vars: string[] = ['x']): Compiled {
  if (!src.trim()) throw new ExprError('Empty expression', 0);
  const toks = tokenize(src, vars);
  let i = 0;
  const peek = () => toks[i];
  const isOp = (v: string) => {
    const t = toks[i];
    return t.k === 'op' && t.v === v;
  };
  const expect = (v: string) => {
    if (!isOp(v)) throw new ExprError(`Expected "${v}"`, peek().p);
    i++;
  };
  // Can the current token start a factor (for implicit multiplication: "2x", "x(x+1)")?
  const startsFactor = () => {
    const t = peek();
    return t.k === 'num' || t.k === 'id' || (t.k === 'op' && t.v === '(');
  };

  function sum(): Compiled {
    let a = product();
    for (;;) {
      if (isOp('+')) {
        i++;
        const l = a, r = product();
        a = (e) => l(e) + r(e);
      } else if (isOp('-')) {
        i++;
        const l = a, r = product();
        a = (e) => l(e) - r(e);
      } else return a;
    }
  }

  function product(): Compiled {
    let a = unary();
    for (;;) {
      if (isOp('*')) {
        i++;
        const l = a, r = unary();
        a = (e) => l(e) * r(e);
      } else if (isOp('/')) {
        i++;
        const l = a, r = unary();
        a = (e) => l(e) / r(e);
      } else if (startsFactor()) {
        const l = a, r = power();
        a = (e) => l(e) * r(e);
      } else return a;
    }
  }

  function unary(): Compiled {
    if (isOp('-')) {
      i++;
      const a = unary();
      return (e) => -a(e);
    }
    if (isOp('+')) {
      i++;
      return unary();
    }
    return power();
  }

  function power(): Compiled {
    const base = postfix();
    if (isOp('^')) {
      i++;
      const ex = unary();
      return (e) => Math.pow(base(e), ex(e));
    }
    return base;
  }

  function postfix(): Compiled {
    let a = primary();
    while (isOp('!')) {
      i++;
      const f = a;
      a = (e) => factorial(f(e));
    }
    return a;
  }

  function primary(): Compiled {
    const t = peek();
    if (t.k === 'num') {
      i++;
      const v = t.v;
      return () => v;
    }
    if (t.k === 'op' && t.v === '(') {
      i++;
      const a = sum();
      expect(')');
      return a;
    }
    if (t.k === 'op' && t.v === '|') {
      i++;
      const a = sum();
      expect('|');
      return (e) => Math.abs(a(e));
    }
    if (t.k === 'id') {
      i++;
      const name = t.v;
      const fn = FUNCS[name];
      if (fn) {
        // sin^2 x  →  (sin x)^2
        let exp: Compiled | null = null;
        if (isOp('^')) {
          i++;
          exp = unary();
        }
        let args: Compiled[];
        if (isOp('(')) {
          i++;
          args = [sum()];
          while (isOp(',')) {
            i++;
            args.push(sum());
          }
          expect(')');
        } else {
          // "sin x", "ln 2x": the argument is the next power-level term.
          if (!startsFactor() && !isOp('-')) throw new ExprError(`Missing argument for ${name}`, peek().p);
          args = [isOp('-') ? unary() : power()];
        }
        if (fn.length > 0 && args.length !== fn.length && name !== 'min' && name !== 'max') {
          throw new ExprError(`${name} takes ${fn.length} argument${fn.length > 1 ? 's' : ''}`, t.p);
        }
        const call: Compiled = args.length === 1 ? ((a0) => (e: Env) => fn(a0(e)))(args[0]) : (e) => fn(...args.map((a) => a(e)));
        if (!exp) return call;
        const ex = exp;
        return (e) => Math.pow(call(e), ex(e));
      }
      if (name in CONSTS) {
        const v = CONSTS[name];
        return () => v;
      }
      const v = VAR_ALIASES[name] ?? name;
      if (!vars.includes(v)) throw new ExprError(`Unknown variable "${name}"`, t.p);
      return (e) => e[v];
    }
    if (t.k === 'end') throw new ExprError('Unexpected end of expression', t.p);
    throw new ExprError(`Unexpected "${t.v}"`, t.p);
  }

  const result = sum();
  if (peek().k !== 'end') throw new ExprError(`Unexpected "${(peek() as { v?: string }).v ?? ''}"`, peek().p);
  return result;
}

/** Returns an error message or null. */
export function checkExpr(src: string, vars: string[] = ['x']): string | null {
  try {
    compileExpr(src, vars);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

# Contributing to SciForge

Thanks for your interest in SciForge!

## Setup

```bash
npm install
npm run dev
```

Before opening a PR:

```bash
npm run typecheck
npm test
```

## Easy ways to help

- **Templates** — add formulas to `apps/desktop/src/templates-data.ts` (English titles; add the Vietnamese title to `apps/desktop/src/locales/vi.ts`).
- **Palette symbols** — `apps/desktop/src/palette-data.ts`. Every entry is checked by
  `apps/desktop/test/content.test.ts`, so a typo fails CI instead of shipping.
- **Symbols** — circuits, mechanics, optics and lab equipment live in `packages/figure-core/src/symbols.ts`
  (see “Adding a symbol” in `docs/ARCHITECTURE.md`).
- **Word fidelity** — add LaTeX that converts badly to `packages/math-core/test/math-core.test.ts`
  and improve `packages/math-core/src/omml.ts`.
- **Translations** — English strings live in `apps/desktop/src/i18n.ts`; add a locale file next to `apps/desktop/src/locales/vi.ts`.

## Guidelines

- Keep `doc-model`, `math-core` and `figure-core` free of DOM/React so they stay testable in Node.
- Document changes go through pure functions in `doc-model/src/commands.ts` and `editor.apply(...)`.
- Only permissively licensed dependencies (MIT/BSD/Apache/ISC/MPL) in the core.

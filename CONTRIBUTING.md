# Contributing to SciForge

Cảm ơn bạn đã quan tâm! / Thanks for your interest!

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

- **Templates** — add formulas to `apps/desktop/src/templates-data.ts` (Vietnamese + English titles).
- **Palette symbols** — `apps/desktop/src/palette-data.ts`. Every entry is checked by
  `apps/desktop/test/content.test.ts`, so a typo fails CI instead of shipping.
- **Word fidelity** — add LaTeX that converts badly to `packages/math-core/test/math-core.test.ts`
  and improve `packages/math-core/src/omml.ts`.
- **Translations** — `apps/desktop/src/i18n.ts`.

## Guidelines

- Keep `doc-model` and `math-core` free of DOM/React so they stay testable in Node.
- Document changes go through pure functions in `doc-model/src/commands.ts` and `editor.apply(...)`.
- Only permissively licensed dependencies (MIT/BSD/Apache/ISC/MPL) in the core.

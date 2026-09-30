# Notes for AI coding agents

Trailgrad is a Next.js app for interview preparation. Product and architecture docs are in
[docs/README.md](docs/README.md).

## Before you change any UI

Read [docs/10_DESIGN_SYSTEM.md](docs/10_DESIGN_SYSTEM.md). The app follows a deliberate visual
language, and several mechanisms look removable but are load bearing. Its "Do not undo" section
lists them.

The rules, in short:

- Flat cards: no borders around cards, no drop shadows, no grey boxes inside cards.
- No uppercase letter-spaced labels. Small text is sentence case, 12px or larger.
- Colours come from `var(--workspace-accent)` and its tokens. Never hardcode a brand colour.
- Light icons (stroke about 1.5). Icon tiles are outlined rounded squares with no fill.
- Animate only `transform` and `opacity`, and respect `prefers-reduced-motion`.
- Check every UI change in both light and dark mode.

When fixing one thing, change only that thing. Do not "tidy" nearby styling, restore removed
labels or borders, or reformat files that were not already formatted.

## Before you make or change a marketing film

Read [docs/11_PRODUCT_FILMS.md](docs/11_PRODUCT_FILMS.md). The films are Remotion code in
`video/trailgrad-demo`; new films reuse `src/kit.tsx` so they match the existing ones exactly.

## Working rules

- Do not commit, push, or deploy. The owner does that.
- Never commit `.env`, `.env.local`, or `.vercel/`.
- Typecheck with `npx tsc --noEmit -p .` (there is no typecheck script).
- Local setup, scripts, and conventions: [docs/06_DEVELOPMENT.md](docs/06_DEVELOPMENT.md).

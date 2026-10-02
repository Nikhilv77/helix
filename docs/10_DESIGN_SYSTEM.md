# Design system

Last updated: September 30, 2026

This is the visual language the whole app was redesigned to in September 2026, and the rules for
keeping it. Read it before changing any UI. It is written for people and for AI coding agents:
most of the risks below are things an automated "fix" would plausibly undo.

## The short version

- **Flat.** Cards have a fill and rounded corners. No borders around cards, no drop shadows, no
  boxes inside boxes. Separate things with space, a soft fill, or one hairline.
- **Quiet labels.** No uppercase, letter-spaced "eyebrow" labels (`WEEKLY RHYTHM`,
  `PRACTICE PRIORITIES`). Small labels and statuses are sentence case, 12–13px, muted.
- **Readable sizes.** Card headings about 1.3rem, body 14px, details 12px. Nothing under 12px.
- **Accent, never a fixed brand colour.** Colour comes from the learner's chosen accent. Never
  hardcode `#f26e01` (ember) or any rose/pink in workspace UI.
- **Light icons.** Stroke width about 1.5 (1.8 for an active item). When an icon needs a tile, it
  is an outlined rounded square with no fill.
- **One motion per surface.** Animate only `transform` and `opacity`, and always honour
  `prefers-reduced-motion`.
- **Aligned.** Sections on a page share one width and one edge. A centred page stays centred.

## Colour

| Use | Token |
| --- | --- |
| Accent (buttons, active states, highlights) | `var(--workspace-accent)` |
| Soft accent fill (selected rows, chips) | `var(--workspace-accent-soft)` |
| Accent outline | `var(--workspace-accent-border)` |
| Marketing pages accent | `var(--dm-accent)`, `var(--dm-accent-soft)` |
| Text | the `cream` Tailwind colour (`text-cream`, `text-cream/55`, ...) |

- The learner picks one of six accents (Ember, Azure, Violet, Emerald, Rose, Mono) in
  `/manage`. Everything accent-coloured must read the token so all six work.
- For a tint, mix the token: `color-mix(in srgb, var(--workspace-accent) 13%, transparent)`.
- `text-cream` is not a fixed colour. It is `rgb(var(--color-cream-rgb))`, and light-mode scopes
  redefine that variable as dark ink. Portalled UI (Clerk dialogs, modals rendered to `<body>`)
  sits outside those scopes, so it needs its own light-mode colours; see "Theme" below.

## Typography

- One family: Raleway (`--font-sans`, `--font-display`).
- **Numbers use lining figures.** Raleway defaults to old-style figures, where "0" looks like a
  half-height circle. `body` sets `font-variant-numeric: lining-nums`, and `.tabular-nums` is
  redefined to keep lining figures (Tailwind's version would drop them). Do not use `font-mono`
  to "fix" numbers; that was the old workaround.
- Names from resumes are often all caps. Show them with `displayName()` from
  `src/lib/shared/display-name.ts`, which title-cases all-caps names only.

## Surfaces and components

| Pattern | Where | Notes |
| --- | --- | --- |
| Card | Overview, profile, Trailmate | `bg-[#17181b]` dark; `#ffffff` in light via `html.light` rules; no shadow |
| Card section divider | Trailmate cards, stats rows | one `border-t` hairline, never a grey inner box |
| Icon tile | `/manage` rows, modals | `rounded-xl border` outline, no fill, neutral icon |
| Status / meta text | everywhere | `text-[12px] text-cream/42`, sentence case, no pill border |
| Skill tags / chips | profile | soft fill (`bg-cream/[0.06]`, light `rgba(15,23,42,0.05)`), no border |
| Dialog | delete account, Trailmate badge and leaderboard | white card (graphite dark), outlined icon tile, small accent label, 1.55rem title, plain rows |
| Loader (unknown route) | `src/app/loading.tsx` | a thin accent ring; no placeholder layout |
| Skeletons | per route | flat, no shadows (enforced globally, see risks) |

### Sidebar (`src/components/workspace/chrome/workspace-shell.tsx`)

- Expanded: one column. Header (mark + name + collapse button), the main pages as one unlabelled
  list, then small sentence-case group headings ("Community", "Account") above later groups,
  then the mentor link and a profile row with a settings gear.
- Collapsed: an icon rail only (mark on top, pages, then Trailguide, Settings, Expand).
- The active page has one highlight that glides between rows (`.workspace-nav-glide`).
- Labels are plain nouns: Home, Practice, Interviews, Resume Roast, Progress, Reports,
  Trailmate, Profile. "Resume Roast" is the product name everywhere; do not reintroduce
  "Roastumé".

### Marketing pages (`src/features/marketing/`)

- Always light, pure white, whatever theme the visitor saved (see "Theme lock").
- Home: the product film is the hero, then a second film that slides over the sticky hero, then
  "Never stuck", FAQ, closing call to action ("Walk in ready."), footer.
- Home has no navbar: only the Trailgrad mark top-left (`site-mark.tsx`). Blog and legal pages
  still use `site-nav.tsx`.

## Theme

- New visitors default to **light**. The theme toggle saves to `localStorage`
  (`trailgrad-theme`).
- Light mode is implemented as `html.light` / `html[data-theme="light"]` override rules in
  `src/app/globals.css`, many with `!important` and attribute-substring selectors such as
  `[class*="text-cream/"]` and `[class*="bg-[#17181b]"]`. **Changing a Tailwind class string can
  change how an element looks in light mode**, because these selectors match on the class text.
  After renaming or removing a class, check the page in light mode.

## Do not undo (risks)

Each item below looks like something a cleanup or a quick fix might remove. Each one is load
bearing.

1. **Theme lock for public pages.** `ThemeScript` in `src/lib/theme/theme-context.tsx` sets
   `data-theme-lock="light"` before first paint for `/blog`, `/privacy`, `/terms`, and `/` when
   the Clerk `__client_uat` cookie says signed out. `MarketingLightTheme`
   (`src/features/marketing/ui/chrome/marketing-light-theme.tsx`) locks on client navigation,
   and `WorkspaceShell` releases a stale lock. Removing any piece brings back a dark flash on
   the white marketing pages, or leaves a signed-in dashboard stuck in light.
2. **The regex in `ThemeScript` is inside a template string.** It must be written with doubled
   backslashes (`\\/`). ESLint's `no-useless-escape` will suggest single ones; that breaks the
   script in the browser.
3. **Loading screens hidden under the lock.** `html[data-theme-lock] .app-root-loader` and
   `.dashboard-skeleton` are hidden, so public pages never show the dashboard skeleton. `/` shows
   `DashboardSkeleton` (via `root-loading-surface.tsx`) because `/` is also the signed-in
   Overview.
4. **Global "no shadows on skeletons" rule.** In `globals.css`,
   `:is([class*="skeleton"], .app-root-loader):not(#\#)` uses a fake ID selector to beat older,
   more specific shadow rules. It is intentional, not a typo.
5. **Lining numerals.** `body { font-variant-numeric: lining-nums }` and the `.tabular-nums`
   override. Removing either brings back half-height zeros.
6. **Sidebar glide.** The highlight is positioned from `data-nav-active` rows measured in a
   `useLayoutEffect` with a `ResizeObserver`. Rows must keep `data-nav-active`, and the nav must
   stay `position: relative`.
7. **Collapsed rail vs expanded column.** The icon rail renders only when collapsed; expanded is a
   single column. Do not bring back the always-visible rail (it duplicated every icon).
8. **Product films** (`product-film.tsx`). Sources are picked on first view: 1080p60 master on
   desktop, 1080p30 on touch screens, a 4:5 portrait cut on phones, and only the poster for data
   saver, 2G/3G, or low-memory devices. No `src` is rendered, so nothing downloads until the film
   is seen. Keep phone encodes at 1080 (720p makes the text break up). After re-rendering, bump
   the `?v=` query. The app serves exports from `public/videos/marketing/`; the authoring folder
   was removed after export. See [Product films](11_PRODUCT_FILMS.md).
9. **Voice playback** (`src/infrastructure/realtime/use-maya-voice.ts`). An interrupted or
   replaced `play()` returns `"interrupted"`, not `"unavailable"`, and must not stop a newer line.
   The Overview tour effect intentionally has no "already started" ref (React Strict Mode).
   `preparation-welcome.tsx` reads `dismiss` through a ref so a server refresh cannot cut off the
   completion line.
10. **Teacher portraits in light mode.** The standard portraits are shot on black. Light mode
    uses `public/images/teacher-portraits/assessment-headsets/light/<id>.jpg`.
11. **Dialogs without blur.** Trailmate dialogs dim but do not blur the page; a test in
    `help-hub.test.tsx` asserts this for performance on low-end devices.
12. **Marketing CTA hover.** `.marketing-theme-section button.rounded-full:not(.glass-cta):hover`
    excludes the dark call-to-action pill; without `:not`, its white text disappears on hover.
13. **Onboarding loading screen** (`src/app/onboarding/loading.tsx`) shows the onboarding
    background, not the app skeleton, so the page does not "load twice".

## Decisions and rejected alternatives

So nobody reintroduces what was already tried and turned down:

- Uppercase eyebrow labels, bordered pills, grey inner boxes, card shadows: rejected as bloat.
- A theme-choice step in onboarding: removed; the theme toggle sits in the onboarding header.
- A floating white top bar with the page name: tried and reverted; the top bar is the original.
- An animated ember ring around the films: reverted to a static thin ember border.
- Ember glows behind the hero film: removed.
- Search: white field in light mode, borderless, no focus ring.
- Sidebar groups: in-between gaps looked like missing items; the fix is small sentence-case
  headings, not bigger or smaller gaps.

## Checking a UI change

1. Look at it in the browser in **both** light and dark mode, at desktop and phone width.
2. Check the accent: switch accents in `/manage` and confirm nothing stays orange.
3. Run the typecheck (`npx tsc --noEmit -p .`), ESLint on the touched folders, and the tests next
   to the component (`vitest run <folder>`).
4. Do not run Prettier on a file that was not Prettier-clean at the last commit; it reformats
   untouched code. Check with `git show HEAD:<file> | npx prettier --stdin-filepath <file> --check`.
5. If the dev server hangs (very high CPU, requests never finish), `.next/dev/cache` has grown
   too large: stop the server, `rm -rf .next/dev`, and start `pnpm dev` again.

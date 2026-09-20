# Implementation Plan: Public Trailgrad Pages Cleanup and Performance Optimization

Comprehensive cleanup, runtime performance optimization, client boundary reduction, and dead code elimination for the public Trailgrad surfaces:
- `/` (for signed-out/public visitors)
- `/blog`
- `/blog/[slug]`
- `/privacy`
- `/terms`

Preserves visual design, copy, animations, responsive behavior, theme appearance (dark/light), URLs, SEO metadata, and signed-in dashboard/onboarding behavior pixel-for-pixel.

---

## 1. Root Layout Investigation & Baseline Measurements

### Architectural Context & Measurement
`src/app/layout.tsx:145` declares `export const dynamic = "force-dynamic"`.
- **Why it exists**: The signed-in workspace shell (`WorkspaceShell`) stays mounted across public and workspace routes so Next.js client-side navigation preserves sidebar, theme, and teacher state without a hard reload.
- **Request Work**: For signed-out visitors on `/`, `/blog`, `/blog/[slug]`, `/privacy`, and `/terms`, `auth()` evaluates in ~1ms (no Postgres query), `headers()` reads the proxy pathname in <0.1ms, and `getProfileForRequest()` is skipped entirely because `userId` is null.
- **Measured Latencies (TTFB Baseline across 5 warm runs)**:
  - `/`: min 29.1ms, **p50 31.2ms**, max 48.1ms
  - `/blog`: min 27.4ms, **p50 28.5ms**, max 29.2ms
  - `/blog/[slug]`: min 33.5ms, **p50 36.9ms**, max 76.7ms
  - `/privacy`: min 28.4ms, **p50 29.3ms**, max 29.7ms
  - `/terms`: min 27.3ms, **p50 29.3ms**, max 31.9ms
- **Decision**: Because altering `RootLayout`'s dynamic behavior would alter authenticated workspace navigation and shell mounting across the entire app (violating constraints 3 and 9), `src/app/layout.tsx` dynamic behavior is preserved as an architectural requirement.

---

## 2. Client Boundary Refactoring: Footer & Nav Separation

Currently, `src/features/marketing/ui/chrome/site-chrome.tsx` has `"use client"` at line 1 and exports both `SiteNav` and `SiteFooter`. Consequently, `SiteFooter` is forced into the client bundle across all public routes.

### Specific Changes:
1. **[NEW] `src/features/marketing/ui/chrome/site-footer.tsx`**:
   - Pure Server Component (**NO `"use client"`**).
   - Renders static links, copyright text, and direct import of `TrailgradMark` from `@/components/trailgrad-mark` with `sizes="20px"`.
   - Never bundled into client JavaScript.
2. **[NEW] `src/features/marketing/ui/chrome/site-nav.tsx`**:
   - Client Component with `"use client"`.
   - Contains navigation state (`useActiveSection`, mobile toggle, escape key handler, rAF-throttled scroll listener).
   - Direct import of `TrailgradMark` from `@/components/trailgrad-mark` with `sizes="32px"` (**no `priority`** to avoid competing with LCP).
   - Sets default `actionKind="button"` and default `action=<PrimaryAction ariaLabel="Start free" className="outline-none">Start free</PrimaryAction>`.
   - Removes unused `actionKind="icon"` branch.
3. **Direct Consumer Imports**:
   - Update `marketing-home.tsx`, `blog-index-page.tsx`, `blog-post-page.tsx`, and `legal-page.tsx` to import directly:
     ```tsx
     import { SiteNav } from "@/features/marketing/ui/chrome/site-nav";
     import { SiteFooter } from "@/features/marketing/ui/chrome/site-footer";
     ```
   - Delete `site-chrome.tsx` so `SiteFooter` is never re-exported through a client-marked module.

---

## 3. Render-Cycle Readability & Data Structuring

*Note: These operations execute during React component renders (not on every animation frame). We precompute plain data structures, not JSX elements.*

1. **`practice-section.tsx`**:
   - Pre-tokenize the static `codeScenes` lines once at module initialization into plain data `{ text: string, className?: string }[]`, avoiding repeated regex scanning (`matchAll(TOKEN_PATTERN)`) and `TOKEN_CLASS.findIndex` during component renders.
   - Precompute `PRACTICE_GROUPS = [pairs.slice(0,3), pairs.slice(3,6), pairs.slice(6,9)]` statically instead of slicing arrays on every render.
2. **`hero.tsx`**:
   - Pre-split headline words statically on the 3 constant `pitches` objects at module scope instead of calling `pitch.heading.split(" ")` during component renders.
3. **`pushback-section.tsx`**:
   - Pre-split words on static rounds data.
   - Remove redundant `const animate = inView;` alias.
4. **`stuck-section.tsx`**:
   - Optimize scroll listener lifecycle: attach `window.addEventListener("scroll", ...)` and `resize` only when `IntersectionObserver` confirms `entry.isIntersecting` (within 100% margin of section), and detach when out of view. Preserves entry, exit, re-entry, and rAF cancellation.

---

## 4. Content Cleanup & Dead Code Removal

1. **`src/features/marketing/content/blog.ts`**:
   - Remove unused `metric` and `metricLabel` fields from `BlogPost` type and the 3 static post records (proven unreferenced across codebase).
   - Preserve all other fields: `coverImage`, `coverAlt`, `slug`, `title`, `dek`, `category`, `publishedAt`, `readTime`, `summary`, `sections`, `nextPractice`.
2. **Boilerplate Reduction in Public Pages**:
   - `marketing-home.tsx`, `blog-index-page.tsx`, `blog-post-page.tsx`, `legal-page.tsx`: use `<SiteNav />` with standard default action button instead of repeating identical `<PrimaryAction ...>Start free</PrimaryAction>` block.

---

## 5. Focused Unit Tests for Public Surfaces

1. **`src/features/marketing/content/blog.test.ts`**:
   - Verify all blog posts have required fields, unique slugs, valid cover images, non-empty sections/summaries, and `getBlogPost(slug)`.
2. **`src/features/marketing/content/legal.test.ts`**:
   - Verify `privacyPolicy` and `termsOfService` have non-empty titles, introductions, update timestamps, and valid sections.
3. **`src/features/marketing/ui/chrome/site-chrome.test.tsx`**:
   - Test `SiteNav` rendering, links, mobile menu toggle, escape key handling.
   - Test `SiteFooter` static links, copyright text with current year.
4. **`src/features/marketing/ui/public-pages.test.tsx`**:
   - Test `BlogPostPage` with valid slug, notFound behavior, `generateStaticParams`, and `generateMetadata`.
   - Test `LegalPage` rendering with privacy and terms documents.

---

## 6. Verification Plan

### Automated Checks
1. **Focused Vitest Tests**:
   - `pnpm vitest run src/features/marketing`
   - `pnpm vitest run "src/app/(home)/home-route-state.test.ts"`
2. **TypeScript & ESLint**:
   - `pnpm exec tsc --noEmit`
   - `pnpm lint`
3. **Git Hygiene**:
   - `git diff --check`
4. **Production Build**:
   - `pnpm build`

### Route-Specific Client Bundle Analysis
- Run `pnpm exec next experimental-analyze --output`.
- Parse RSC client manifests (`page_client-reference-manifest.js`) for:
  - `/(home)/page`
  - `/(marketing)/blog/page`
  - `/(marketing)/blog/[slug]/page`
  - `/(marketing)/privacy/page`
  - `/(marketing)/terms/page`
- Compare client module lists and entry chunks before and after (verifying `SiteFooter` elimination from client graphs).

### Visual Regression Verification
- Run `node scripts/capture-screens.mjs after` with `prefers-reduced-motion: reduce` across:
  - Desktop (1280x800) Dark & Light
  - Mobile (390x844) Dark & Light
  for `/`, `/blog`, `/blog/[slug]`, `/privacy`, `/terms`.
- Run `node scripts/compare-screens.mjs` to compare all 20 before/after screenshot pairs with raw pixel buffer diffing (< 0.05% tolerance).

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Vite dev server on :5173
npm run build        # tsc -b && vite build && node scripts/generate-blog-pages.mjs
npm run preview      # serve dist/ on :4173
npm run lint         # eslint .
npm test             # vitest run
npm run test:watch   # vitest

# single test file / single test
npx vitest run src/test/github.test.ts
npx vitest run -t "throws rate_limit error"
```

`npm run build` runs three separate steps — a type-check (`tsc -b`), the Vite build, and a
post-build SEO script. Running `vite build` alone skips the SEO pass and will not reproduce
production output.

Vitest config lives inside `vite.config.ts` under the `test` key (not a separate
`vitest.config.ts`). Setup file is `src/test/setup.ts`, which polyfills `window.matchMedia`
for jsdom.

Note: `tsconfig.json` has `"exclude": ["src/test"]`, so **tests are not type-checked by
`npm run build`**. A type error in a test file only surfaces when Vitest runs it.

## Architecture

React 19 + TypeScript + Vite SPA (no SSR), deployed to GitHub Pages as a static build.

### Content is compile-time, not runtime

All page content lives in `content/` and is pulled in by the bundler — there is no CMS, no
API, no runtime fetch:

| File | Consumed via | By |
|---|---|---|
| `content/profile.md` | `import ... from "@content/profile.md?raw"` | `ProfileCard` |
| `content/skills.json` | JSON import | `SkillsSection` |
| `content/certificates.json` | JSON import | `CertificateCard` |
| `content/blogs.json` | JSON import | `BlogList`, `BlogsPage`, `BlogArticlePage` |
| `content/blog/*.md` | `import.meta.glob(..., { query: "?raw" })` | `BlogArticlePage` |

`blogs.json` holds only post *metadata*; the markdown body is loaded lazily per-slug through
`import.meta.glob`, so each post is its own chunk. A post's slug is its `blogUrl` with `.md`
stripped (`blogSlug()` in `src/lib/blog.ts`) and must match the filename in `content/blog/` —
if they disagree, the article page renders its "文章不存在" state.

**Consequence:** editing anything in `content/` requires a rebuild + redeploy. `@content/*` is a
Vite/TS alias for `content/*`; `@/*` maps to `src/*`.

### SEO meta tags are written in two places

Per-route tags are set at runtime by `react-helmet-async` (`HomePage`, `BlogsPage`,
`BlogArticlePage`), but crawlers and share-preview bots never execute JS, so
`scripts/generate-blog-pages.mjs` re-injects the same tags as static HTML after the build:

- rewrites `dist/index.html` in place with home-page SEO
- generates `dist/blogs/index.html` and `dist/blogs/<slug>/index.html` per post
- regenerates `dist/sitemap.xml` (overwriting the `public/sitemap.xml` copied in by Vite)

**If you change site name, base URL, description, or OG image, update both the Helmet block
and this script.** The site URL `https://shtskysmile.github.io` is hardcoded in several
places (`scripts/generate-blog-pages.mjs`, the three page components) — grep before renaming.

`index.html` is deliberately a bare shell with no SEO tags, plus two GitHub Pages SPA
redirect shims that decode a `?/path` query back into `history.replaceState`. `public/404.html`
is the other half of that pair. Both must stay in sync.

### GitHub repo list

`ProjectList` → `useGitHubRepos(enabled)` → `fetchRepos()` in `src/lib/github.ts`. Flow:

- `fetchRepos` hits the unauthenticated `api.github.com/users/<user>/repos` endpoint, filters
  out `EXCLUDED_REPOS` (the profile repo and the `.github.io` repo), sorts by `updated_at`
  desc, takes 8.
- It throws a discriminated `GitHubError` union — `rate_limit` | `network` | `empty` |
  `invalid` — which `ProjectList` renders as distinct states (empty is inline, the rest go
  through `ErrorFallback`). New error kinds must be added to that union and handled there.
- `EXCLUDED_REPOS` compares against `repo.name.toLowerCase()`, so `GITHUB_USERNAME` in
  `src/lib/constants.ts` must stay lowercase or the exclusion silently stops matching.
- `useGitHubRepos` caches to `localStorage` for 1 hour, has a 10s AbortController timeout,
  and debounces retries to one per 2s. `ProjectList` only enables fetching when scrolled
  into view (`useInView`).
- Being unauthenticated, the quota is 60 req/hr **per visitor IP**. A 403 with
  `X-RateLimit-Remaining: 0` is the expected `rate_limit` path, not a bug.

### Live2D widget

`Live2DWidget` → `useLive2D`, backed by the `l2d` npm package (not the template's original
Cubism 2 `live2d.min.js`, which was replaced so `.moc3` models could load). Model assets are
self-hosted under `public/live2d/`.

Two things about `src/hooks/useLive2D.ts` that look odd but are deliberate:

1. **The `<canvas>` is created imperatively and appended to a host div**, then removed on
   cleanup — not rendered as JSX. React StrictMode double-mounts effects in dev; reusing the
   same canvas across init/destroy leaves a stale WebGL context and the model silently fails
   to appear.
2. **The chino model ships no `.mtn` motion files**, so `l2d.getMotions()` returns `{}`.
   Both the "换个动作" button and the tap handler fall back to `wiggleCanvas()`, which applies
   the `.live2d-wiggle` CSS animation defined in `src/index.css`. If you swap in a model that
   *does* have motions, the real motion path takes over automatically.

Character dialogue, hover tooltips, and click reactions come from `public/live2d-config.json`,
keyed by CSS selectors matched via `document`-level event delegation. `#live2d` is the canvas
id referenced there — rename it in both places if the canvas changes.

### Theme

`useTheme` (in `src/hooks/useTheme.ts`) owns state and toggles the `dark` class on
`<html>`; it is instantiated once in `App.tsx` and passed down through `ThemeContext`.
Consumers use `useThemeContext()`. Tailwind is configured with `darkMode: "class"`.

### Layout

`App.tsx` renders `Header` / route content / `Footer`. `HomePage` composes its two columns
through the `Grid` component (`lg:grid-cols-layout` = `1fr 2fr`, single column below `lg`).
Note that **both `Grid` and `App.tsx` render a `<main>`**, so the home page has nested
`<main>` elements — invalid HTML, harmless in practice, worth fixing if you touch either.

`Header` hides itself on scroll-down by setting `data-header-hidden="true"` rather than by
React state alone; `BlogArticlePage`'s reading-progress bar observes that attribute with a
`MutationObserver` to reposition itself under the header. Keep that attribute if you
refactor the header.

## Deployment

`.github/workflows/deploy.yml` runs on every push to `main`: `npm ci` → `npm test` →
`npm run build` → upload `dist/` → deploy. **A failing test blocks deployment.**

Live at <https://shtskysmile.github.io/> (repo `Shtskysmile/Shtskysmile.github.io`).

In the repo's Pages settings, the source must be **GitHub Actions** (`build_type: workflow`).
If it is ever switched to "Deploy from a branch", Pages publishes the raw repo root instead of
`dist/` and the site breaks. `public/.nojekyll` exists so Pages does not run Jekyll over the
build output.

## Conventions

- Prettier: double quotes, semicolons, trailing commas, 100 cols, with
  `prettier-plugin-tailwindcss` (so class strings are sorted — don't hand-order them).
- `noUncheckedIndexedAccess` is on: indexing an array or `Record` yields `T | undefined`.
  This is why you'll see `?? fallback` after lookups.
- UI copy is Chinese. `src/lib/blog.ts` date/reading-time helpers return Chinese strings.
- `src/types/live2d.d.ts` declares `window.loadlive2d` / `window.live2d_settings` from the
  removed Cubism 2 loader and is now dead — safe to delete.

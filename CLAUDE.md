# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

`@uniweb/kit` is the standard component library for Uniweb foundations. It provides React components, hooks, and utilities that foundation themes import to build websites on the Uniweb platform.

## Important: No Build Step

This package ships **raw source files** — there is no bundler or build step. The `exports` field in package.json points directly to `./src/index.js`. Consumers (Uniweb foundations) bundle kit code themselves via Vite.

## File Structure

- `src/index.js` — Single entry point; re-exports everything
- `src/components/` — Unstyled primitive components (Image, Link, Media, Icon, Text, etc.)
- `src/styled/` — Pre-styled Tailwind-based components (Section, Visual, Prose, Article, etc.)
- `src/hooks/` — React hooks (useWebsite, useRouting, useTheme, useInView, etc.)
- `src/utils/` — Utilities (`cn` for class merging, `detectMediaType`, `parseIconRef`, etc.)
- `src/search/` — Client-side search (ranked by `@uniweb/projections/search`)
- `src/theme-tokens.css` — CSS custom properties for theming (exported separately)

### Component Convention

Each component lives in its own folder with an `index.js` barrel file:
```
src/components/Image/
  Image.jsx    # Implementation
  index.js     # Re-export
```

## Dependencies

- `@uniweb/core`, `@uniweb/semantic-parser`, `@uniweb/scene` — sibling packages, referenced as `workspace:*` (resolved from the monorepo during development; the publish script rewrites them to real versions on release)
- `clsx` + `tailwind-merge` — Class name merging (`cn()` utility)
- `shiki` — Syntax highlighting. ⚠️ **Only `shiki/core` and `shiki/engine/javascript`** — never a
  `bundle/*`. Grammars and themes are fetched from a corpus URL at render time
  (`src/styled/Section/renderers/shiki-corpus.js`), the way `@uniweb/core/icon-corpus` handles icons.
  Importing `shiki/bundle/full` put 236 grammar chunks and a 622 KB WASM engine into every
  foundation — 7.3 MB — for languages almost no site uses
- `@tailwindcss/typography` — the prose plugin behind `prose-tokens.css`
- `temml` — **CSS only.** `math-tokens.css` does `@import "temml/dist/Temml-Local.css"`; kit never imports Temml's JS
- React 19 as peer dependency

**`shiki` and `temml` are direct dependencies on purpose, not peers.** Kit is bundled *into* a foundation by that foundation's Vite build, so kit's own imports have to resolve from the foundation's `node_modules`. Declaring them as peers would leave them absent there. They stay lazy-loaded and code-split — direct just means resolvable. See the framework scope's gotcha on the foundation/site build architecture.

⛔ **Every `shiki/` specifier must stay behind a DYNAMIC import.** The foundation SSR bundle
externalizes them (`isSSRExternal` in `@uniweb/build`) on the ground that they appear only as dormant
dynamic imports an isolate never awaits, so nothing shims them edge-side. A static one — even
`import pkg from 'shiki/package.json'` — makes the isolate resolve it at load time, and the whole
foundation fails to load rather than just its code blocks. Caught in review 2026-09-07, one commit
after it was introduced.

⚠️ **`fuse.js` was listed here as a dependency and is not one.** The search ranker became
`@uniweb/projections/search` on 2026-09-06 and fuse was removed from `package.json`; this file kept
naming it. Check `package.json` rather than this list.

`temml` is the same rule applied to a stylesheet rather than a dynamic import, and the install-graph cost is not what reaches a bundle: the package is ~2.3 MB of JS kit never touches, while only `Temml-Local.css` (8.7 KB) and `Temml.woff2` (9.4 KB) ship, and only for foundations that import `math-tokens.css`. It is imported rather than vendored because the bundler resolves the font URL — a text copy breaks that and drifts from the Temml that produced the markup. The alternative considered and rejected was depending on `@uniweb/content-reader` (which owns the renderer): that inverts the layering — a runtime package taking a build-time one — and would drag `marked` and `js-yaml` into every foundation to obtain a stylesheet.

## Publishing

1. Bump version in `package.json`
2. Commit and push to `main`
3. Run `npm publish --access public`

No build step is needed before publishing.

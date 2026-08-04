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
- `src/search/` — Client-side search (Fuse.js-based)
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
- `fuse.js` — Client-side search
- `shiki` — Syntax highlighting
- `@tailwindcss/typography` — the prose plugin behind `prose-tokens.css`
- React 19 as peer dependency

**`fuse.js` and `shiki` are direct dependencies on purpose, not peers.** Kit is bundled *into* a foundation by that foundation's Vite build, so kit's own dynamic imports have to resolve from the foundation's `node_modules`. Declaring them as peers would leave them absent there. They stay lazy-loaded and code-split — direct just means resolvable. See the framework scope's gotcha on the foundation/site build architecture.

## Publishing

1. Bump version in `package.json`
2. Commit and push to `main`
3. Run `npm publish --access public`

No build step is needed before publishing.

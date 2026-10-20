/**
 * Where syntax-highlighting grammars and themes come from.
 *
 * ## ⭐ THE SAME SHAPE AS THE ICON CORPUS, FOR THE SAME REASON
 *
 * `@uniweb/core/icon-corpus` does not bundle icons; it computes a URL and a
 * host may serve them from its own origin. Grammars are the same kind of thing
 * — a large, static, versioned corpus where any one site uses a handful of
 * entries and cannot say which in advance.
 *
 * **Measured 2026-09-07** on a built `docs` foundation, before this: importing
 * `shiki/bundle/full` put **236 grammar chunks — 7.3 MB raw, 1.3 MB gzipped —
 * plus a 622 KB WASM regex engine** into the artifact. A visitor fetched almost
 * none of it (the import is lazy and per-language), so the cost was not page
 * weight: it was every foundation's artifact, upload, storage and build time,
 * carried so that a rare language *could* be highlighted.
 *
 * ⛔ **And the bundle it paid for was the wrong one.** `bundle/full` was chosen
 * "for access to all themes" — `bundle/web` carries the same 65 themes. The
 * only difference is 332 languages against 78, and the highlighter was created
 * with **one** theme and twelve languages.
 *
 * ⇒ Nothing is bundled now. `@shikijs/core` plus the JavaScript regex engine is
 * about 144 KB, and every grammar and theme is fetched when a code block
 * actually needs it.
 *
 * ## Why `import()` and not `fetch()`
 *
 * A grammar module declares its own embedded languages as static imports and
 * exports them flattened:
 *
 * ```js
 * import javascript from './javascript.mjs'
 * import css from './css.mjs'
 * export default [...javascript, ...css, lang]   // html.mjs
 * ```
 *
 * So `import(url)` resolves the whole embedded set against the same origin and
 * hands back a complete grammar list. Fetching JSON would mean re-implementing
 * that resolution here, against a dependency graph that is theirs to change.
 *
 * ## The version travels with the engine
 *
 * The corpus is pinned to the exact `shiki` version this kit resolved, read from
 * its `package.json` rather than typed here. A grammar and the engine that runs
 * it come from one release; a second constant naming that version would be a
 * standing drift liability, and the drift would show up as a parse failure in
 * one language on one site.
 *
 * @module @uniweb/kit/styled/Section/renderers/shiki-corpus
 */

import { getUniweb } from '@uniweb/core'

/**
 * The exact release whose grammars match the engine kit loads.
 *
 * ⛔ **RESOLVED LAZILY, AND THAT IS LOAD-BEARING — NOT A STYLE CHOICE.** This
 * was `import shikiPkg from 'shiki/package.json'` at module scope, which put a
 * STATIC `import … from "shiki/package.json"` into `dist/entry-ssr.js`. The
 * foundation SSR bundle externalizes everything under `shiki/`
 * (`isSSRExternal`), on the stated ground that Shiki appears there only as
 * DORMANT dynamic imports an isolate never awaits — so no shim entry is needed
 * for it edge-side. A static import breaks that: the isolate has to resolve the
 * specifier at load time, before rendering anything, and if it cannot then the
 * whole foundation fails to load rather than just its code blocks.
 *
 * ⇒ Keep every `shiki/` specifier behind a dynamic import. The promise is
 * cached, so the cost is one resolution per session and nothing in SSR.
 */
let versionPromise = null

function shikiVersion() {
  if (!versionPromise) {
    versionPromise = import('shiki/package.json').then((m) => (m.default ?? m).version)
  }
  return versionPromise
}

/**
 * Where the framework reads the corpus from when nothing else says.
 *
 * ⚖️ A public CDN rather than an artifact of ours, unlike the icon corpus, and
 * the difference is that we do not produce this one — it is `@shikijs/*` as
 * published. A host that would rather not depend on a third origin at render
 * time supplies its own base and mirrors the two packages; that is the whole
 * point of the override, and it needs no change here.
 */
export const DEFAULT_SHIKI_BASE = 'https://cdn.jsdelivr.net/npm'

/**
 * The base for this site — `config.syntax.cdnUrl` if the payload carries one.
 *
 * Read per call rather than cached: it is a property of the site being
 * rendered, and one module instance can outlive one site in a dev server.
 */
function corpusBase() {
  try {
    const declared = getUniweb()?.activeWebsite?.config?.syntax?.cdnUrl
    if (typeof declared === 'string' && declared.trim()) {
      return declared.trim().replace(/\/+$/, '')
    }
  } catch {
    // No runtime context (Storybook, a unit test) — the default is correct.
  }
  return DEFAULT_SHIKI_BASE
}

/**
 * ⛔ A NAME, NEVER A PATH. A grammar's name comes from content — a code fence's
 * language, written by whoever writes the page — and a theme's from `theme.yml`,
 * and each becomes part of a URL this module IMPORTS, whose code then runs on
 * the page. So a name is written into a URL only when it has the shape every
 * name in the corpus has: lowercase letters and digits, in words joined by
 * single hyphens (`javascript`, `objective-cpp`, `github-dark`; measured on
 * Shiki 3.23, all 346 grammars and 65 themes). Any other is refused, and the
 * block renders as plain text, or with the default theme. ⛔ Until 2026-10-19
 * the name went into the URL as written, so a language holding path segments
 * addressed a module outside the corpus.
 */
const CORPUS_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Whether a string can name a grammar or a theme in the corpus.
 *
 * @param {*} name
 * @returns {boolean}
 */
export function isCorpusName(name) {
  return typeof name === 'string' && CORPUS_NAME.test(name)
}

function corpusUrl(pkg, name) {
  if (!isCorpusName(name)) throw new Error(`[Code] ${JSON.stringify(name)} is not a ${pkg === 'langs' ? 'grammar' : 'theme'} name`)
  return shikiVersion().then((version) => `${corpusBase()}/@shikijs/${pkg}@${version}/dist/${name}.mjs`)
}

/** URL of one language's grammar module. Throws for a string that is not a grammar's name. */
export async function grammarUrl(lang) {
  return corpusUrl('langs', lang)
}

/** URL of one theme module. Throws for a string that is not a theme's name. */
export async function themeUrl(name) {
  return corpusUrl('themes', name)
}

/**
 * A grammar, ready for `highlighter.loadLanguage`.
 *
 * ⛔ `@vite-ignore` is required and is not laziness: the URL is composed at
 * runtime from a config value, so a bundler must leave the import alone rather
 * than try to resolve it at build time. Resolving it is exactly what we are
 * removing.
 *
 * Throws when the language does not exist in the corpus. The caller falls back
 * to plaintext, which is also what happens when the network is unavailable — a
 * code block renders unhighlighted rather than not at all.
 */
export async function loadGrammar(lang) {
  const mod = await import(/* @vite-ignore */ await grammarUrl(lang))
  return mod.default
}

/** A theme object, ready for `highlighter.loadTheme`. */
export async function loadThemeByName(name) {
  const mod = await import(/* @vite-ignore */ await themeUrl(name))
  return mod.default
}

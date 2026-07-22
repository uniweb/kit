/**
 * Href resolution
 *
 * One implementation of what an authored href means, shared by every renderer
 * that turns one into a real link.
 *
 * A link reaches the DOM by one of two routes, and they used to disagree:
 *
 *   structured — <Link to="/about">, where the component receives the href
 *   prose      — an <a> baked into an HTML string by semantic-parser, rendered
 *                with dangerouslySetInnerHTML, never passing through <Link>
 *
 * Both must apply the same rules, in the same order:
 *
 *   1. page: / topic: internal references resolve to a route
 *   2. the route is translated and locale-prefixed for the active locale
 *   3. the deployment base path is applied
 *
 * Steps 1-2 are `resolveRoute`. Step 3 is `applyBasePath`, kept separate
 * because React Router supplies the base itself through its basename — a
 * Router-rendered link must not have it applied twice. `resolveHref` is the
 * whole chain, for every context where a plain <a> reaches the document.
 *
 * WHY HERE, AND NOT IN THE PARSER
 * semantic-parser is deliberately context-free — no website, no base path, no
 * route table — and must stay that way, because @uniweb/press feeds the same
 * strings into PDF, docx and typst output where a base path is meaningless.
 * Resolution belongs at render, where the deployment context exists.
 *
 * WHY REGEX, AND NOT DOMParser
 * The same code runs in the browser and during SSR/prerender, where no DOM
 * exists. A DOMParser-based resolver silently skipped resolution during
 * prerender — the bug that motivated the regex rewrite in the first place.
 *
 * @module @uniweb/kit/utils/href
 */

import { isFileUrl } from './url.js'

// An <a> tag's href attribute. Captures the prefix, the quote style, and the
// value, so the replacement can preserve the original quoting.
const ANCHOR_HREF_RE = /(<a\b[^>]*?\shref=)(["'])([^"']*)\2/gi

// Shapes that are never a site route: any scheme (https:, mailto:, tel:, and
// an unresolved page:), protocol-relative, and bare fragments.
const NON_ROUTE_HREF_RE = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i

/**
 * Prefix a site-root-relative href with the deployment base path.
 *
 * The invariant this encodes — a base is only ever joined to a path that
 * starts at the site root — is the whole point of routing every caller
 * through here. A bare `basePath + href` concatenation produces garbage the
 * moment href turns out to be absolute (`/basehttps://example.com/x`), and
 * whether it is absolute depends on a classification that has been wrong
 * before. Guarding at the join makes the failure impossible rather than
 * unlikely.
 *
 * @param {string} href - Href to prefix
 * @param {string} basePath - Deployment base (no trailing slash), '' for root
 * @returns {string} Href with the base applied, or unchanged if not applicable
 */
export function applyBasePath(href, basePath) {
  if (!href || typeof href !== 'string' || !basePath) return href
  if (!href.startsWith('/') || href.startsWith('//')) return href
  if (href === basePath || href.startsWith(basePath + '/')) return href // already based
  return basePath + href
}

/**
 * Translate a route slug and prefix the active locale, when the site is
 * multilingual and the active locale is not the default one.
 */
function applyLocale(route, website) {
  if (!website.hasMultipleLocales?.()) return route

  const activeLocale = website.getActiveLocale?.()
  const defaultLocale = website.getDefaultLocale?.()
  if (!activeLocale || activeLocale === defaultLocale) return route

  // Translate the slug for this locale (e.g. /about → /acerca-de). A route
  // with no translation comes back unchanged.
  const translated = website.translateRoute ? website.translateRoute(route, activeLocale) : route

  const prefix = `/${activeLocale}`
  if (translated === prefix || translated.startsWith(`${prefix}/`)) return translated

  return translated === '/' ? `${prefix}/` : `${prefix}${translated}`
}

/**
 * Resolve an authored href to a site route: internal references, then locale.
 * Does NOT apply the base path — see the module note on React Router.
 *
 * The locale step deliberately skips files. Only pages are emitted per locale;
 * everything under the site's public directory — images, fonts, PDFs — is
 * emitted once at the root, so locale-prefixing an asset href points it at a
 * path that does not exist.
 *
 * @param {string} href - Authored href
 * @param {Object} website - Website instance
 * @param {Object} [options]
 * @param {boolean} [options.locale=true] - Apply slug translation and the
 *   locale prefix. Pass false when the caller already supplies a
 *   locale-resolved URL — <Link reload>, whose href comes from getLocaleUrl()
 *   and carries the TARGET locale, which re-resolving against the ACTIVE one
 *   would clobber.
 * @returns {string} Resolved route
 */
export function resolveRoute(href, website, { locale = true } = {}) {
  if (!href || typeof href !== 'string' || !website) return href

  let resolved = href

  // 1. page: / topic: internal references → real route
  if (href.startsWith('page:') || href.startsWith('topic:')) {
    resolved = website.makeHref ? website.makeHref(href) : href
  }

  // Anything still carrying a scheme, protocol-relative, or a bare fragment is
  // not a site route. An unresolvable page: reference lands here too, which is
  // why makeHref returning it unchanged is safe.
  if (NON_ROUTE_HREF_RE.test(resolved)) return resolved

  // 2. Translate and locale-prefix — pages only
  if (locale && resolved.startsWith('/') && !isFileUrl(resolved)) {
    resolved = applyLocale(resolved, website)
  }

  return resolved
}

/**
 * Resolve an authored href all the way to what belongs in a plain <a href>:
 * internal references, locale, and the deployment base path.
 *
 * @param {string} href - Authored href
 * @param {Object} website - Website instance
 * @returns {string} Fully resolved href
 */
export function resolveHref(href, website) {
  if (!href || typeof href !== 'string' || !website) return href
  return applyBasePath(resolveRoute(href, website), website.basePath || '')
}

/**
 * Resolve every anchor href inside a prose HTML string.
 *
 * @param {string} html - HTML string from semantic-parser
 * @param {Object} website - Website instance (falsy → returns html unchanged)
 * @returns {string} HTML with resolved hrefs
 */
export function resolveProseHrefs(html, website) {
  if (!html || typeof html !== 'string' || !website) return html
  if (!html.includes('<a')) return html

  // Nothing to do when there are no internal references, no base path and no
  // active non-default locale — the common case for a monolingual site served
  // at the root.
  const hasRef = html.includes('page:') || html.includes('topic:')
  const localized =
    !!website.hasMultipleLocales?.() &&
    website.getActiveLocale?.() !== website.getDefaultLocale?.()
  if (!hasRef && !website.basePath && !localized) return html

  return html.replace(ANCHOR_HREF_RE, (match, prefix, quote, href) => {
    const resolved = resolveHref(href, website)
    return resolved === href ? match : `${prefix}${quote}${resolved}${quote}`
  })
}

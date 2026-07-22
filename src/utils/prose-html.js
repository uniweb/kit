/**
 * Prose HTML href resolution
 *
 * Inline formatting authored in markdown reaches components as an HTML string
 * (semantic-parser bakes marks into the text — `<strong>`, `<em>`, `<a href>`).
 * That string is rendered with dangerouslySetInnerHTML, so the anchors inside
 * it never pass through kit's <Link> and get none of what <Link> does for a
 * structured link.
 *
 * This module is the one place that closes that gap. An href authored in prose
 * resolves exactly like the same href handed to <Link>, no matter which
 * renderer draws it.
 *
 * WHY HERE, AND NOT IN THE PARSER
 * semantic-parser is deliberately context-free — it has no website, no base
 * path, no route table — and must stay that way, because @uniweb/press feeds
 * the same strings into PDF, docx and typst output where a site's base path is
 * meaningless. Resolution belongs at render, where the deployment context
 * exists and where it can differ per target.
 *
 * WHY REGEX, AND NOT DOMParser
 * The same code has to run in the browser and during SSR/prerender, where no
 * DOM exists. A DOMParser-based resolver silently skipped resolution during
 * prerender, which is the bug that motivated the regex rewrite in the first
 * place.
 *
 * @module @uniweb/kit/utils/prose-html
 */

// An <a> tag's href attribute. Captures the prefix, the quote style, and the
// value, so the replacement can preserve the original quoting.
const ANCHOR_HREF_RE = /(<a\b[^>]*?\shref=)(["'])([^"']*)\2/gi

// Schemes and shapes that are never site-relative and must be left untouched.
const NON_ROUTE_HREF_RE = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i

/**
 * Prefix a site-root-relative href with the deployment base path.
 *
 * Mirrors what <Link> ends up doing for a structured link: React Router's
 * basename supplies it during SPA navigation, and Link's SSG fallback and
 * `reload` path prepend `website.basePath` explicitly.
 */
function applyBasePath(href, basePath) {
  if (!basePath) return href
  if (!href.startsWith('/') || href.startsWith('//')) return href
  if (href === basePath || href.startsWith(basePath + '/')) return href // already based
  return basePath + href
}

/**
 * Resolve a single authored href to the one that should reach the DOM.
 *
 * Order matters: an internal reference resolves to a route first, and the base
 * path is applied to that route afterwards. A reference that cannot be
 * resolved is returned by makeHref unchanged, still carrying its `page:`
 * scheme — which the base step then correctly declines to touch.
 *
 * @param {string} href - Authored href
 * @param {Object} website - Website instance
 * @returns {string} Resolved href
 */
export function resolveProseHref(href, website) {
  if (!href || !website) return href

  let resolved = href

  // page: / topic: internal references → real route
  if (href.startsWith('page:') || href.startsWith('topic:')) {
    resolved = website.makeHref ? website.makeHref(href) : href
  }

  // Anything still carrying a scheme, protocol-relative, or a bare fragment is
  // not a site route — leave it alone.
  if (NON_ROUTE_HREF_RE.test(resolved)) return resolved

  return applyBasePath(resolved, website.basePath || '')
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

  // Nothing to do when there are no internal references AND no base path to
  // apply — the overwhelmingly common case for a site deployed at the root.
  const hasRef = html.includes('page:') || html.includes('topic:')
  if (!hasRef && !website.basePath) return html

  return html.replace(ANCHOR_HREF_RE, (match, prefix, quote, href) => {
    const resolved = resolveProseHref(href, website)
    return resolved === href ? match : `${prefix}${quote}${resolved}${quote}`
  })
}

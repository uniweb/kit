/**
 * SafeHtml Component
 *
 * Safely renders HTML content with internal-reference link resolution.
 * Handles the `page:` (stable page reference) and `topic:` (legacy) protocols
 * for internal content references — the same protocols kit's <Link> resolves,
 * so inline link marks inside rich-text bodies resolve identically.
 *
 * @module @uniweb/kit/SafeHtml
 */

import React, { Suspense, useMemo } from 'react'
import { useWebsite } from '../../hooks/useWebsite.js'

// Matches an <a> tag's href attribute when it carries a page:/topic: internal
// reference. Regex-based (not DOMParser) so it runs identically in the browser
// SPA and during SSR/prerender, where no DOM is available.
const INTERNAL_HREF_RE = /(<a\b[^>]*?\shref=)(["'])((?:page|topic):[^"']*)\2/gi

/**
 * Resolve page:/topic: internal-reference hrefs in an HTML string to real
 * routes via website.makeHref(). Leaves everything else untouched; an
 * unresolvable reference is returned by makeHref unchanged.
 * @param {string} html - HTML string with potential page:/topic: links
 * @param {Object} website - Website instance
 * @returns {string} HTML with resolved link hrefs
 */
function resolveInternalLinks(html, website) {
  if (!html || typeof html !== 'string') return html
  if (!html.includes('page:') && !html.includes('topic:')) return html

  return html.replace(
    INTERNAL_HREF_RE,
    (_m, prefix, quote, href) => `${prefix}${quote}${website.makeHref(href)}${quote}`
  )
}

/**
 * SafeHtml - Safely render HTML content
 *
 * @param {Object} props
 * @param {string|string[]} props.value - HTML content to render
 * @param {string} [props.className] - CSS classes
 * @param {string} [props.as='div'] - HTML element to render as
 *
 * @example
 * <SafeHtml value="<p>Hello <strong>World</strong></p>" />
 *
 * @example
 * // With internal reference links (page: stable ref, or legacy topic:)
 * <SafeHtml value='<a href="page:93dc5359">About</a>' />
 */
export function SafeHtml({ value, className, as: Component = 'div', ...props }) {
  const { website, getRoutingComponents } = useWebsite()

  // Get the runtime's SafeHtml if available (handles sanitization)
  const RuntimeSafeHtml = getRoutingComponents()?.SafeHtml

  // Process the value
  const processedValue = useMemo(() => {
    if (!value) return ''

    // Handle array of HTML strings
    const html = Array.isArray(value) ? value.join('') : value

    // Resolve page:/topic: internal-reference links
    return website ? resolveInternalLinks(html, website) : html
  }, [value, website])

  // Use runtime SafeHtml if available (recommended for proper sanitization)
  if (RuntimeSafeHtml) {
    return (
      <Suspense fallback={null}>
        <RuntimeSafeHtml value={processedValue} className={className} {...props} />
      </Suspense>
    )
  }

  // Fallback: render directly (less safe, but works without runtime)
  return (
    <Component
      className={className}
      dangerouslySetInnerHTML={{ __html: processedValue }}
      {...props}
    />
  )
}

export default SafeHtml

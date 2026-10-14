/**
 * SafeHtml Component
 *
 * Renders an HTML string with authored-href resolution: the `page:` (stable
 * page reference) and `topic:` (legacy) protocols, and the deployment base
 * path — the same resolution kit's <Link> applies to a structured link, so
 * inline link marks inside rich-text bodies resolve identically.
 *
 * The resolution itself lives in utils/href.js, shared with <Text>, so both
 * prose renderers agree on what an authored href means.
 *
 * WHAT MAKES IT SAFE — and what does not
 * The value is rendered as HTML, as given; this component cleans nothing. A
 * semantic-parser string is safe to give it because the parser builds it from
 * structure and escapes every character of the text and every attribute value,
 * and the only markup it lets through, a math node's MathML, it rebuilds from
 * an allowlist (`@uniweb/semantic-parser`, since 2026-10-14).
 *
 * ⛔ So a string from anywhere else does not belong here — a field a member
 * wrote, a response from an API. Render it as text. *(This said until
 * 2026-10-14 that "nothing in the framework" sanitizes and that a site's
 * author also writes its foundation, so there was no privilege boundary — a
 * premise that fails wherever the person writing content is not the one
 * writing code: an author using an editor, a member of a site with a
 * backend.)*
 *
 * @module @uniweb/kit/SafeHtml
 */

import React, { useMemo } from 'react'
import { useWebsite } from '../../hooks/useWebsite.js'
import { resolveProseHrefs } from '../../utils/href.js'

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
  const { website } = useWebsite()

  // Process the value
  const processedValue = useMemo(() => {
    if (!value) return ''

    // Handle array of HTML strings
    const html = Array.isArray(value) ? value.join('') : value

    // Resolve authored hrefs (page:/topic: references, base path)
    return resolveProseHrefs(html, website)
  }, [value, website])

  return (
    <Component
      className={className}
      dangerouslySetInnerHTML={{ __html: processedValue }}
      {...props}
    />
  )
}

export default SafeHtml

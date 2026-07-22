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
 * WHAT "SAFE" DOES NOT MEAN
 * This component does NOT sanitize. Nothing in the framework does. The value
 * is rendered as-is, so it must come from a source you trust — which the
 * framework's own content is: the author of a site's markdown also writes its
 * foundation, so there is no privilege boundary to defend. A foundation that
 * renders genuinely untrusted HTML (say a user-submitted string arriving
 * through a fetcher) is responsible for that decision, and should not read
 * this component's name as a guarantee.
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

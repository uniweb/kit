/**
 * SafeHtml Component
 *
 * Safely renders HTML content with topic link resolution.
 * Handles the `topic:` protocol for internal content references.
 *
 * @module @uniweb/kit/SafeHtml
 */

import React, { Suspense, useMemo } from 'react'
import { useWebsite } from '../../hooks/useWebsite.js'

/**
 * Resolve topic: links in HTML content
 * @param {string} html - HTML string with potential topic: links
 * @param {Object} website - Website instance
 * @returns {string} HTML with resolved links
 */
function resolveTopicLinks(html, website) {
  if (!html || typeof html !== 'string') return html
  if (!html.includes('topic:')) return html

  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const links = doc.querySelectorAll('a[href^="topic:"]')

    links.forEach((link) => {
      const href = link.getAttribute('href')
      if (href) {
        link.setAttribute('href', website.makeHref(href))
      }
    })

    return doc.body.innerHTML
  } catch (error) {
    console.warn('[SafeHtml] Error resolving topic links:', error)
    return html
  }
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
 * // With topic links
 * <SafeHtml value='<a href="topic:about">About</a>' />
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

    // Resolve topic: links
    return website ? resolveTopicLinks(html, website) : html
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

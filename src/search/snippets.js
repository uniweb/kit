/**
 * Snippet and Highlighting Utilities
 *
 * A result's snippet is rendered by `@uniweb/projections/search/snippet`, the one
 * renderer every lane that answers search shares, with its escaping. Both are
 * re-exported here, as kit has always offered them.
 */

import { buildSnippet, escapeHtml } from '@uniweb/projections/search/snippet'

export { buildSnippet, escapeHtml }
export { highlightMatches } from '@uniweb/projections/search/snippet'

/**
 * Extract plain text from a search result for display
 *
 * @param {Object} result - Search result object
 * @param {Object} options - Options
 * @param {number} [options.maxLength=200] - Maximum text length
 * @returns {string} Plain text excerpt
 */
export function getResultText(result, options = {}) {
  const { maxLength = 200 } = options

  // Prefer snippet, fall back to excerpt, then content
  const text = result.snippetText || result.excerpt || result.content || ''

  if (text.length <= maxLength) {
    return text
  }

  return text.slice(0, maxLength).trim() + '…'
}

/**
 * Format search result for display in a list
 *
 * @param {Object} result - Search result from createSearchClient.query()
 * @returns {Object} Formatted result for UI display
 */
export function formatResultForDisplay(result) {
  return {
    id: result.id,
    href: result.href,
    title: result.title || result.pageTitle || 'Untitled',
    subtitle: result.type === 'section' ? result.pageTitle : null,
    text: result.snippetText || result.excerpt || '',
    html: result.snippetHtml || escapeHtml(result.excerpt || ''),
    type: result.type,
    component: result.component
  }
}

export default buildSnippet

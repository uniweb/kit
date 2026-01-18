/**
 * Snippet and Highlighting Utilities
 *
 * Functions for generating search result snippets with highlighted matches.
 */

/**
 * Escape HTML special characters
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
export function escapeHtml(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Build a snippet from content with optional match highlighting
 *
 * @param {string} text - Full text content
 * @param {Array} matches - Fuse.js matches array
 * @param {Object} options - Options
 * @param {string} [options.key='content'] - Key to find matches for
 * @param {number} [options.maxLength=160] - Maximum snippet length
 * @param {number} [options.contextChars=60] - Characters before/after match
 * @param {string} [options.highlightTag='mark'] - HTML tag for highlights
 * @returns {{ text: string, html: string }} Plain text and HTML snippets
 *
 * @example
 * const snippet = buildSnippet(
 *   'This is a long text about authentication and security.',
 *   matches,
 *   { key: 'content' }
 * )
 * // snippet.html contains '<mark>authentication</mark>' highlighted
 */
export function buildSnippet(text, matches, options = {}) {
  const {
    key = 'content',
    maxLength = 160,
    contextChars = 60,
    highlightTag = 'mark'
  } = options

  if (!text) {
    return { text: '', html: '' }
  }

  // Find matches for the specified key
  const keyMatch = matches?.find(match => match.key === key)

  // No matches - return truncated content
  if (!keyMatch || !keyMatch.indices || keyMatch.indices.length === 0) {
    const snippet = text.slice(0, maxLength)
    const suffix = text.length > maxLength ? '…' : ''
    return {
      text: snippet + suffix,
      html: escapeHtml(snippet) + suffix
    }
  }

  // Get the first match position
  const [firstStart, firstEnd] = keyMatch.indices[0]

  // Calculate slice boundaries around the first match
  const sliceStart = Math.max(0, firstStart - contextChars)
  const sliceEnd = Math.min(text.length, firstEnd + contextChars + 1)

  // Extract the snippet
  const snippet = text.slice(sliceStart, sliceEnd)

  // Adjust match indices to be relative to the snippet
  const adjustedIndices = keyMatch.indices
    .map(([start, end]) => [start - sliceStart, end - sliceStart])
    .filter(([start, end]) => end >= 0 && start < snippet.length)

  // Build highlighted HTML
  const html = highlightMatches(snippet, adjustedIndices, { tag: highlightTag })

  // Add ellipsis indicators
  const prefix = sliceStart > 0 ? '…' : ''
  const suffix = sliceEnd < text.length ? '…' : ''

  return {
    text: `${prefix}${snippet}${suffix}`,
    html: `${prefix}${html}${suffix}`
  }
}

/**
 * Highlight matches in text using HTML tags
 *
 * @param {string} text - Text to highlight
 * @param {Array<[number, number]>} indices - Array of [start, end] index pairs
 * @param {Object} options - Options
 * @param {string} [options.tag='mark'] - HTML tag to use
 * @param {string} [options.className] - Optional CSS class for the tag
 * @returns {string} HTML string with highlighted matches
 *
 * @example
 * highlightMatches('hello world', [[0, 4]], { tag: 'mark' })
 * // Returns: '<mark>hello</mark> world'
 */
export function highlightMatches(text, indices, options = {}) {
  const { tag = 'mark', className } = options

  if (!text || !indices || indices.length === 0) {
    return escapeHtml(text || '')
  }

  // Sort indices by start position
  const sortedIndices = [...indices].sort((a, b) => a[0] - b[0])

  // Build HTML string
  let cursor = 0
  let html = ''
  const openTag = className ? `<${tag} class="${className}">` : `<${tag}>`
  const closeTag = `</${tag}>`

  for (const [start, end] of sortedIndices) {
    // Ensure valid bounds
    const safeStart = Math.max(0, Math.min(start, text.length))
    const safeEnd = Math.max(0, Math.min(end + 1, text.length))

    // Skip invalid ranges
    if (safeStart >= safeEnd || safeStart < cursor) continue

    // Add text before the match
    if (safeStart > cursor) {
      html += escapeHtml(text.slice(cursor, safeStart))
    }

    // Add highlighted match
    html += openTag + escapeHtml(text.slice(safeStart, safeEnd)) + closeTag
    cursor = safeEnd
  }

  // Add remaining text
  if (cursor < text.length) {
    html += escapeHtml(text.slice(cursor))
  }

  return html
}

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

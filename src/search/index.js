/**
 * Search Utilities for Uniweb Foundations
 *
 * Provides helpers for implementing search functionality in foundations.
 * Uses Fuse.js for fuzzy search (peer dependency - must be installed by foundation).
 *
 * @module @uniweb/kit/search
 *
 * @example
 * import { createSearchClient, buildSnippet } from '@uniweb/kit/search'
 *
 * // Create a search client for your site
 * const search = createSearchClient(website)
 *
 * // Perform a search
 * const results = await search.query('hello world')
 *
 * // Results include highlighted snippets
 * results.forEach(r => {
 *   console.log(r.title, r.snippetHtml)
 * })
 */

export { createSearchClient, loadSearchIndex, clearSearchCache } from './client.js'
export { buildSnippet, highlightMatches, escapeHtml } from './snippets.js'
export { useSearch, useSearchIndex } from './hooks.js'

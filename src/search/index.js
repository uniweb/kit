/**
 * Search Utilities for Uniweb Foundations
 *
 * Provides helpers for implementing search functionality in foundations.
 *
 * ⛔ A foundation installs NOTHING for this. The local ranker is
 * `@uniweb/projections/search`, a leaf of a package already in the graph, loaded
 * dynamically only when a site actually queries a prebuilt index. This line used
 * to name `fuse.js` as a peer dependency the foundation had to install; that was
 * wrong from the moment the ranker changed (2026-09-06) and it was instruction,
 * not description, which is the worst kind of comment to leave stale.
 *
 * @module @uniweb/kit (search)
 *
 * @example
 * import { createSearchClient, buildSnippet } from '@uniweb/kit (search)'
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

export { createSearchClient, loadSearchIndex, clearSearchCache, emptyResult } from './client.js'
export { resolveEndpointUrl } from './providers/endpoint-provider.js'
export { buildSnippet, highlightMatches, escapeHtml } from './snippets.js'
export { useSearch, useSearchIndex, useSearchShortcut, useSearchPrefetch } from './hooks.js'

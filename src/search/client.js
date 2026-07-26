/**
 * Search Client
 *
 * Resolves which provider serves a site's search, then delegates to it. The
 * site declares the provider; a component reads results the same way either
 * way — the same contract `content.data` gives data fetching, applied to search.
 *
 * Providers are loaded dynamically, so a site using a server endpoint never
 * bundles Fuse and a site using the local index never bundles anything else.
 *
 * Resolution order:
 *   1. `site.yml  search.provider`  — the author's explicit choice
 *   2. `'index'`                    — the free default, works on any host
 *
 * A future tier sits between them: a host that serves search declaring it in
 * the payload it already sends, the way `config.base` already tells the runtime
 * where the site is being served from. That wire key is the host's to specify,
 * so it is deliberately not invented here.
 *
 * Provider contract (duck-typed, matching how the FetcherDispatcher treats
 * transports):
 *
 *   { query(text, opts) → Promise<SearchResult[]>,
 *     preload?() → Promise<void>,
 *     clearCache?() → void }
 *
 * See ./providers/result.js for the result contract.
 */

import { emptyResult } from './providers/result.js'

// Re-exported so existing importers of these keep working; they live with the
// provider that owns them now.
export { loadSearchIndex, clearSearchCache } from './providers/index-provider.js'

/**
 * Load a provider factory by name.
 *
 * Unknown names resolve to `null` rather than throwing, so a typo or a
 * foundation transport that failed to register degrades to the default instead
 * of taking down the site's search box — the same resilience the fetcher
 * dispatcher applies to a malformed transport.
 *
 * @param {string} name
 * @param {Object} transports - Foundation-supplied search transports
 * @returns {Promise<Function|null>}
 */
async function loadProviderFactory(name, transports) {
  if (name === 'index') {
    const mod = await import('./providers/index-provider.js')
    return mod.createIndexProvider
  }
  if (name === 'endpoint') {
    const mod = await import('./providers/endpoint-provider.js')
    return mod.createEndpointProvider
  }

  const transport = transports?.[name]
  if (transport && typeof transport.query === 'function') {
    return () => transport
  }
  if (transport) {
    console.warn(
      `[uniweb] Search transport "${name}" has no query(); falling back to the index provider.`
    )
  }
  return null
}

/**
 * Create a search client for a Website instance
 *
 * @param {Object} website - Website instance from @uniweb/core
 * @param {Object} options - Configuration options
 * @param {Object} [options.fuseOptions] - Custom Fuse.js options (index provider)
 * @param {boolean} [options.useStorage=true] - Use localStorage caching (index provider)
 * @param {number} [options.defaultLimit=10] - Default result limit
 * @param {string} [options.provider] - Override the declared provider
 * @param {Object} [options.transports] - Named search transports from a foundation
 * @returns {Object} Search client with query method
 *
 * @example
 * const search = createSearchClient(website)
 * const results = await search.query('authentication')
 */
export function createSearchClient(website, options = {}) {
  const {
    defaultLimit = 10,
    provider: providerOverride,
    transports,
    ...providerOptions
  } = options

  const searchConfig = website.getSearchConfig?.() || {}
  const declared = providerOverride || searchConfig.provider || 'index'

  // One in-flight resolution shared by every caller.
  let providerPromise = null
  let activeName = declared

  async function getProvider() {
    if (providerPromise) return providerPromise

    providerPromise = (async () => {
      let factory = await loadProviderFactory(declared, transports)

      if (!factory) {
        if (declared !== 'index') {
          console.warn(
            `[uniweb] Unknown search provider "${declared}"; falling back to the index provider.`
          )
        }
        const mod = await import('./providers/index-provider.js')
        factory = mod.createIndexProvider
        activeName = 'index'
      }

      return factory(website, { ...providerOptions, endpoint: searchConfig.endpoint })
    })()

    return providerPromise
  }

  /**
   * Fall back to the local index when a non-index provider fails.
   *
   * A site that moves off a host serving search still has an index emitted at
   * build, so this is usually a working answer rather than a consolation prize.
   * Standalone-first means the degraded path is part of the design.
   *
   * @param {Error} err
   * @returns {Promise<Object|null>}
   */
  async function fallbackToIndex(err) {
    if (activeName === 'index') return null
    console.warn(
      `[uniweb] Search provider "${activeName}" failed (${err?.message}); trying the local index.`
    )
    try {
      const mod = await import('./providers/index-provider.js')
      const fallback = mod.createIndexProvider(website, providerOptions)
      activeName = 'index'
      providerPromise = Promise.resolve(fallback)
      return fallback
    } catch {
      return null
    }
  }

  return {
    /**
     * Check if search is enabled
     * @returns {boolean}
     */
    isEnabled() {
      return website.isSearchEnabled()
    },

    /**
     * Name of the provider serving results. Reflects the active provider, so
     * after a fallback it reports `index` rather than what was declared.
     * @returns {string}
     */
    getProviderName() {
      return activeName
    },

    /**
     * Get the search index URL
     * @returns {string}
     */
    getIndexUrl() {
      return website.getSearchIndexUrl()
    },

    /**
     * Get search configuration
     * @returns {Object}
     */
    getConfig() {
      return website.getSearchConfig()
    },

    /**
     * Perform a search query
     *
     * @param {string} query - Search query
     * @param {Object} queryOptions - Query options
     * @param {number} [queryOptions.limit] - Maximum results
     * @param {string} [queryOptions.type] - Filter by type ('page' or 'section')
     * @param {string} [queryOptions.route] - Filter by route prefix
     * @param {AbortSignal} [queryOptions.signal] - Cancel an in-flight query
     * @returns {Promise<Array>} Search results
     */
    async query(query, queryOptions = {}) {
      const { limit = defaultLimit, type, route, signal } = queryOptions

      const trimmed = query?.trim()
      if (!trimmed) return []

      if (!website.isSearchEnabled()) {
        console.warn('Search is not enabled for this site')
        return []
      }

      const opts = { limit, type, route, signal }

      try {
        const provider = await getProvider()
        return await provider.query(trimmed, opts)
      } catch (err) {
        // An aborted query is a caller decision, not a provider failure.
        if (err?.name === 'AbortError') throw err

        const fallback = await fallbackToIndex(err)
        if (!fallback) {
          console.warn(`[uniweb] Search failed: ${err?.message}`)
          return []
        }
        try {
          return await fallback.query(trimmed, opts)
        } catch (fallbackErr) {
          console.warn(`[uniweb] Search fallback failed: ${fallbackErr?.message}`)
          return []
        }
      }
    },

    /**
     * Preload whatever the provider needs to answer quickly.
     * A no-op for providers with nothing to warm.
     * @returns {Promise<void>}
     */
    async preload() {
      if (!website.isSearchEnabled()) return
      try {
        const provider = await getProvider()
        await provider.preload?.()
      } catch (err) {
        // Preloading is an optimization; failing it must not surface to a user.
        console.warn(`[uniweb] Search preload failed: ${err?.message}`)
      }
    },

    /**
     * Clear the provider's cache, if it keeps one.
     */
    clearCache() {
      if (!providerPromise) return
      providerPromise.then(p => p.clearCache?.()).catch(() => {})
    }
  }
}

export { emptyResult }
export default createSearchClient

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
 *   2. the HOST's offer             — `config.services.search` in the payload,
 *                                     read through `resolveService` → `endpoint`
 *   3. `'index'`                    — the free default, works on any host
 *
 * ⛔ Tier 2 SHIPPED. This block described it as "a future tier … deliberately
 * not invented here" until 2026-08-25, while `resolveService` was imported at
 * the top of this file and read ~100 lines below. The wire key is
 * `config.services.search`, resolved by `@uniweb/core/services` on the same
 * two-tier rule every site service uses (site-authored wins, host fills gaps).
 *
 * ⚠️ That stale sentence had a cost outside this repo. The hosting lane could
 * not tell from reading whether kit consumed the block, asked in a collab
 * channel, and the answer mattered: on the sync/link lane the framework emits
 * NO search index at all (removed 2026-08-01, `@uniweb/build`
 * `site/build-site-data.js`), so tier 3 requests a `search-index.json` that
 * nothing on that lane writes. A reader of this comment concluded the host tier
 * did not exist and the block was decoration; both halves were wrong.
 *
 * ⭐ So tier 3 is "the free default" only where something EMITS the index —
 * the bundle lane and any static host. It is not a universal fallback, and a
 * host that answers search at its own address must be declared for kit to
 * reach it.
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
import { resolveService } from '../utils/services.js'

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
/**
 * Accept either provider return shape.
 *
 * A provider may return `SearchResult[]` or `{ results, total }`. Both are
 * valid and the array form is not deprecated: `transport.query` is a public
 * seam a third party implements, and its documented contract has always been
 * "returns results". Widening that to an envelope would break every custom
 * transport in the field to add a number most of them cannot supply.
 *
 * An array therefore means "no count offered" → `total: null`, which is exactly
 * what null is for here. Our own two providers return the envelope.
 */
function normalizeQueryResult(returned) {
  if (Array.isArray(returned)) return { results: returned, total: null }
  const results = Array.isArray(returned?.results) ? returned.results : []
  const total = Number.isInteger(returned?.total) ? returned.total : null
  return { results, total }
}

export function createSearchClient(website, options = {}) {
  const {
    defaultLimit = 10,
    provider: providerOverride,
    transports,
    ...providerOptions
  } = options

  const searchConfig = website.getSearchConfig?.() || {}

  // Where search is answered: the site's own `search.endpoint`, else the host's
  // `services.search`, else nothing. Same rule every site service resolves by.
  const service = resolveService(website, 'search')

  // The AUTHORED provider, read from config rather than from getSearchConfig(),
  // which fills in 'index' before kit sees it (core/website.js). That default
  // would make "the author chose index" and "the author said nothing"
  // indistinguishable — and the difference is precisely what decides whether a
  // host's offer applies. An author who picked a provider means it; one who
  // picked nothing gets whatever the host serves, and the local index if the
  // host serves none.
  const authoredProvider = website?.config?.search?.provider

  // ⛔ THE HOST ANSWERED AND DECLINED. `resolveService` returns
  // `{ url: null, source: 'host' }` when a host declares the service NAME
  // while offering no address — the decline shape `@uniweb/core/services`
  // documents ("absence is a behavioural decision rather than a message").
  //
  // Falling through to `'index'` here would be wrong twice: the host has said
  // it does not serve search, and on a host-served lane the framework emits no
  // index to fall back to, so the fallback resolves to a 404. Draw nothing
  // instead — `isEnabled()` reports false and `query()` returns empty without
  // a request.
  //
  // ⚠️ Only a DECLINE does this. `source: null` — nobody declared the service
  // at all — still means `'index'`, which is correct and is the static-host
  // path: there the build DOES emit the index.
  //
  // ⛔ DO NOT ADD A FALLBACK THAT FIRES ON THIS SHAPE. The contract, settled
  // with a host implementation 2026-08-25: **a host that OFFERS a service must
  // declare it WITH an address** — offered is `{endpoint}`, declined is `{}`.
  // Routing `{}` to `endpoint-provider`'s `DEFAULT_ENDPOINT` looks like a free
  // saving and makes an offered service indistinguishable from a declined one:
  // no search box, no error, nothing to grep for.
  //
  // ⭐ A site's OWN declaration still wins — `resolveService` answers tier 1
  // with `source: 'site'`, so an operator running self-hosted search on a host
  // that does not sell it is untouched. Pinned in
  // `tests/search-host-decline.test.js`; that is the case worth re-running if
  // this branch is ever edited, because the headline case never breaks.
  const hostDeclined = service.source === 'host' && !service.url

  const declared =
    providerOverride ||
    authoredProvider ||
    (service.source === 'host' ? 'endpoint' : 'index')

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

      // `service.url` is already joined to the base; the endpoint provider
      // joins again, which is a no-op because the join is idempotent. Falls
      // back to the raw authored value, and to the provider's own default when
      // an author selects `endpoint` without naming one.
      return factory(website, {
        ...providerOptions,
        endpoint: service.url || searchConfig.endpoint,
      })
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
     * Check if search is enabled.
     *
     * Two independent ways it is off, and a caller needs neither to tell them
     * apart: the SITE disabled it (`search: false` / `search: { enabled:
     * false }`), or the HOST declared the service and offered no address —
     * see `hostDeclined` above. Either way a foundation draws no search UI.
     *
     * ⛔ Deliberately no reason string. Which services a site is provisioned
     * for is not a visitor's business and could not be localized from a public
     * package anyway — the rule `@uniweb/core/services` states at length.
     *
     * @returns {boolean}
     */
    isEnabled() {
      return website.isSearchEnabled() && !hostDeclined
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
     * Perform a search query.
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
      return (await this.queryWithTotal(query, queryOptions)).results
    },

    /**
     * The same query, plus how many matched.
     *
     * Exists because `query()` returns an array and a count cannot ride on one
     * without being silently dropped by `.slice()`/`.filter()`/spread — and
     * `query()` is a published surface returning `SearchResult[]`, so widening
     * its return would break every foundation iterating it.
     *
     * **`total` is the match count BEFORE `limit`** — the 47 in "showing 10 of
     * 47". It is `null` when unknowable, and null is a real answer rather than
     * a failure: a provider-optional field in the same sense as `matches` or
     * `item` on a result. Whether a count arrives is a DEPLOYMENT fact — the
     * local index always knows it, an endpoint knows it only if it says so —
     * so a UI must render the count conditionally and the bare result list
     * unconditionally.
     *
     * ⚠️ `total >= results.length` is NOT guaranteed to be checkable: a
     * provider reporting a count for a set we then filtered locally reports
     * null instead, precisely so the two numbers are never inconsistent.
     *
     * @returns {Promise<{results: Array, total: number|null}>}
     */
    async queryWithTotal(query, queryOptions = {}) {
      const { limit = defaultLimit, type, route, signal } = queryOptions

      const trimmed = query?.trim()
      if (!trimmed) return { results: [], total: 0 }

      if (!website.isSearchEnabled()) {
        console.warn('Search is not enabled for this site')
        return { results: [], total: 0 }
      }

      // The host declared the service and offered no address. Return empty
      // rather than requesting anything — the alternative is a fetch we
      // already know the answer to. Silent: a foundation that checked
      // `isEnabled()` never reaches this, and one that did not should not fill
      // a visitor's console over a service the site was never provisioned for.
      if (hostDeclined) return { results: [], total: 0 }

      const opts = { limit, type, route, signal }

      try {
        const provider = await getProvider()
        return normalizeQueryResult(await provider.query(trimmed, opts))
      } catch (err) {
        // An aborted query is a caller decision, not a provider failure.
        if (err?.name === 'AbortError') throw err

        const fallback = await fallbackToIndex(err)
        if (!fallback) {
          console.warn(`[uniweb] Search failed: ${err?.message}`)
          return { results: [], total: null }
        }
        try {
          return normalizeQueryResult(await fallback.query(trimmed, opts))
        } catch (fallbackErr) {
          console.warn(`[uniweb] Search fallback failed: ${fallbackErr?.message}`)
          return { results: [], total: null }
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

/**
 * The search provider seam.
 *
 * What matters here is not that either provider works in isolation, but that a
 * component gets the same shape from both and that a failing provider degrades
 * instead of throwing into a search box.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { createSearchClient } from '../src/search/client.js'
import { clearSearchCache } from '../src/search/providers/index-provider.js'
import { resolveEndpointUrl, createEndpointProvider } from '../src/search/providers/endpoint-provider.js'
import { emptyResult } from '../src/search/providers/result.js'

/** Minimal Website stand-in — only what the search path reads. */
/**
 * A real Website carries BOTH of these and they are not the same thing:
 * `config` is the payload's site config — the authored values, verbatim — while
 * `getSearchConfig()` is the derived view that fills in defaults (core defaults
 * `provider` to 'index'). Kit reads the authored provider from `config`,
 * because the derived one cannot express "the author said nothing", and that is
 * the distinction deciding whether a host's offer applies.
 *
 * `services` is the host tier: what the deployment says it serves.
 */
function makeWebsite({
  provider,
  endpoint,
  basePath = '',
  locale = 'en',
  enabled = true,
  services,
} = {}) {
  return {
    basePath,
    config: {
      search: { enabled, provider, endpoint },
      ...(services ? { services } : {}),
    },
    isSearchEnabled: () => enabled,
    getActiveLocale: () => locale,
    getSearchIndexUrl: () => `${basePath}/search-index.json`,
    getSearchConfig: () => ({ enabled, provider: provider || 'index', endpoint })
  }
}

function jsonResponse(body, ok = true, status = 200) {
  return { ok, status, json: async () => body }
}

let warnSpy

beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  // The index provider caches parsed indexes at module scope, keyed by index
  // URL — correct in a browser tab, but it makes tests order-dependent when
  // they share a URL. Clear between tests so each one starts cold.
  clearSearchCache()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('resolveEndpointUrl — base-relative resolution', () => {
  test('resolves against the site root when there is no base path', () => {
    expect(resolveEndpointUrl('_search', '')).toBe('/_search')
  })

  test('resolves under a subdirectory deployment', () => {
    expect(resolveEndpointUrl('_search', '/docs')).toBe('/docs/_search')
  })

  test('resolves under a backend-served subpath', () => {
    // The property that lets a backend expose search as a subroute of the path
    // it already serves the site from, with no framework change.
    expect(resolveEndpointUrl('_search', '/sites/abc123'))
      .toBe('/sites/abc123/_search')
  })

  test('tolerates a leading slash and a trailing slash on the base', () => {
    expect(resolveEndpointUrl('/_search', '/docs/')).toBe('/docs/_search')
  })

  test('passes an absolute URL through untouched', () => {
    expect(resolveEndpointUrl('https://search.example.com/q', '/docs'))
      .toBe('https://search.example.com/q')
  })

  test('defaults the path when none is declared', () => {
    expect(resolveEndpointUrl(undefined, '')).toBe('/_search')
  })
})

describe('endpoint provider', () => {
  test('sends q, lang and limit, and normalizes results', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      results: [
        {
          id: 'collection:articles:hello',
          type: 'collection',
          collection: 'articles',
          route: '/blog/hello',
          title: 'Hello',
          snippetHtml: 'a <mark>hello</mark> world',
          item: { slug: 'hello' }
        }
      ]
    }))
    vi.stubGlobal('fetch', fetchMock)

    const website = makeWebsite({ provider: 'endpoint', basePath: '/docs', locale: 'fr' })
    const provider = createEndpointProvider(website, { endpoint: '_search' })
    const { results } = await provider.query('hello', { limit: 5 })

    const url = new URL(fetchMock.mock.calls[0][0])
    expect(url.pathname).toBe('/docs/_search')
    expect(url.searchParams.get('q')).toBe('hello')
    expect(url.searchParams.get('lang')).toBe('fr')
    expect(url.searchParams.get('limit')).toBe('5')

    expect(results).toHaveLength(1)
    expect(results[0].collection).toBe('articles')
    expect(results[0].item).toEqual({ slug: 'hello' })
  })

  test('composes href from route and anchor when the server sends none', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      results: [{ id: 'x', type: 'section', route: '/about', anchor: 'Section2' }]
    })))

    const provider = createEndpointProvider(makeWebsite({ provider: 'endpoint' }), {})
    const { results: [result] } = await provider.query('x')

    expect(result.href).toBe('/about#Section2')
  })

  test('accepts alternative envelopes and a bare array', async () => {
    const shapes = [
      { hits: [{ id: 'a', route: '/a' }] },
      { items: [{ id: 'a', route: '/a' }] },
      [{ id: 'a', route: '/a' }]
    ]

    for (const body of shapes) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(body)))
      const provider = createEndpointProvider(makeWebsite({ provider: 'endpoint' }), {})
      const { results } = await provider.query('a')
      expect(results).toHaveLength(1)
      expect(results[0].id).toBe('a')
    }
  })

  test('throws on a non-ok response so the client can fall back', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(null, false, 404)))
    const provider = createEndpointProvider(makeWebsite({ provider: 'endpoint' }), {})

    await expect(provider.query('x')).rejects.toThrow(/404/)
  })
})

describe('result contract', () => {
  test('every guaranteed field is present and non-null', () => {
    const result = emptyResult()
    for (const key of ['id', 'type', 'route', 'href', 'title', 'pageTitle', 'excerpt', 'snippetHtml']) {
      expect(result[key]).toBe('')
    }
  })

  test('every optional field is null rather than undefined', () => {
    const result = emptyResult()
    for (const key of ['sectionId', 'anchor', 'description', 'component', 'snippetText', 'matches', 'collection', 'item']) {
      expect(result[key]).toBeNull()
    }
  })

  test('an endpoint result carries the full shape even when the server is terse', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      results: [{ id: 'a', route: '/a' }]
    })))

    const provider = createEndpointProvider(makeWebsite({ provider: 'endpoint' }), {})
    const { results: [result] } = await provider.query('a')

    // A component may read any contract key without guarding for undefined.
    expect(Object.keys(result).sort()).toEqual(Object.keys(emptyResult()).sort())
  })
})

/**
 * A host may answer search itself, and says so in the same `services` block it
 * uses for every other service. Resolution is the one documented in
 * site-derived-artifacts.md: site.yml → served payload → the local index.
 *
 * ⚠️ The third test INVERTED on 2026-08-25, and the original concern is worth
 * keeping because it was correct and is now answered rather than discarded:
 *
 *   "Core defaults `provider` to 'index' before kit sees it, so reading the
 *    derived value would make an author's explicit `provider: index`
 *    indistinguishable from silence — and a host would then quietly override an
 *    author who chose the local index on purpose."
 *
 * ⭐ That is still why kit reads `website.config.search.provider` RAW rather
 * than `getSearchConfig().provider`. What changed is what we do with the
 * distinction, not whether we can see it: an authored `index` no longer VETOES
 * a host's offer, because `index` is the value core fills in for silence and
 * `docs/authoring/search.md` prints it in an options block labelled "default".
 * Copying that block to set `include:` is not choosing a provider.
 *
 * ⛔ And the override the old test protected was protecting a 404: on a
 * host-served site there is no local index to keep, so "keeping" it meant an
 * ENTITLED site drawing a search box over a `search-index.json` that nothing
 * writes on that lane.
 */
describe('client provider resolution — a host that serves search', () => {
  test('uses the host endpoint when the site declares no provider', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ results: [] }))
    vi.stubGlobal('fetch', fetchMock)

    const client = createSearchClient(
      makeWebsite({ services: { search: { endpoint: '/_search' } } })
    )
    await client.query('x')

    expect(client.getProviderName()).toBe('endpoint')
    expect(fetchMock.mock.calls[0][0]).toContain('/_search')
  })

  test('resolves the host endpoint against the base path', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ results: [] }))
    vi.stubGlobal('fetch', fetchMock)

    const client = createSearchClient(
      makeWebsite({ basePath: '/docs', services: { search: { endpoint: '/_search' } } })
    )
    await client.query('x')

    expect(fetchMock.mock.calls[0][0]).toContain('/docs/_search')
  })

  test('an authored `index` does NOT veto a host that offers search', () => {
    // Inverted 2026-08-25 — see the block above. `index` is the default
    // spelled out, and on a host-served lane keeping it means a guaranteed 404.
    const client = createSearchClient(
      makeWebsite({ provider: 'index', services: { search: { endpoint: '/_search' } } })
    )
    expect(client.getProviderName()).toBe('endpoint')
  })

  test('CONTROL: an authored `index` still wins when NO host offers search', () => {
    // The static-host path, where the build really does emit the index. The
    // fix must not reach this case — `service.source` is never 'host' here.
    const client = createSearchClient(makeWebsite({ provider: 'index' }))

    expect(client.getProviderName()).toBe('index')
  })

  test('CONTROL: silence also resolves to the local index with no host', () => {
    // Authored-`index` and silence are now identical in outcome. Pinned so the
    // equivalence is deliberate rather than incidental.
    const client = createSearchClient(makeWebsite({}))

    expect(client.getProviderName()).toBe('index')
  })

  test('an authored endpoint wins over the host', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ results: [] }))
    vi.stubGlobal('fetch', fetchMock)

    const client = createSearchClient(
      makeWebsite({
        provider: 'endpoint',
        endpoint: '/mine',
        services: { search: { endpoint: '/theirs' } },
      })
    )
    await client.query('x')

    expect(fetchMock.mock.calls[0][0]).toContain('/mine')
    expect(fetchMock.mock.calls[0][0]).not.toContain('/theirs')
  })

  test('no host and no declaration is still the local index', () => {
    expect(createSearchClient(makeWebsite()).getProviderName()).toBe('index')
  })
})

describe('client provider resolution', () => {
  test('defaults to the index provider', () => {
    const client = createSearchClient(makeWebsite())
    expect(client.getProviderName()).toBe('index')
  })

  test('honors a declared endpoint provider', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ results: [] })))
    const client = createSearchClient(makeWebsite({ provider: 'endpoint' }))
    await client.query('x')
    expect(client.getProviderName()).toBe('endpoint')
  })

  test('passes the declared endpoint through to the provider', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ results: [] }))
    vi.stubGlobal('fetch', fetchMock)

    const client = createSearchClient(
      makeWebsite({ provider: 'endpoint', endpoint: 'api/find', basePath: '/docs' })
    )
    await client.query('x')

    expect(new URL(fetchMock.mock.calls[0][0]).pathname).toBe('/docs/api/find')
  })

  test('uses a foundation-supplied transport by name', async () => {
    const transport = { query: vi.fn().mockResolvedValue([{ ...emptyResult(), id: 'from-transport' }]) }
    const client = createSearchClient(makeWebsite({ provider: 'algolia' }), {
      transports: { algolia: transport }
    })

    const results = await client.query('x')
    expect(results[0].id).toBe('from-transport')
    expect(client.getProviderName()).toBe('algolia')
  })

  test('an unknown provider name warns and degrades to the index provider', async () => {
    const client = createSearchClient(makeWebsite({ provider: 'nope' }))
    // Force resolution without needing a real index fetch.
    await client.query('x').catch(() => {})

    expect(client.getProviderName()).toBe('index')
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown search provider "nope"'))
  })

  test('a transport missing query() warns and degrades', async () => {
    const client = createSearchClient(makeWebsite({ provider: 'broken' }), {
      transports: { broken: { notQuery: () => {} } }
    })
    await client.query('x').catch(() => {})

    expect(client.getProviderName()).toBe('index')
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('has no query()'))
  })
})

describe('degradation', () => {
  test('returns [] rather than throwing when every provider fails', async () => {
    // Endpoint 500s, and the index fetch fails too (no index on this host).
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(null, false, 500)))

    const client = createSearchClient(makeWebsite({ provider: 'endpoint' }))
    await expect(client.query('x')).resolves.toEqual([])
  })

  test('falls back to the index provider when the endpoint fails', async () => {
    const fetchMock = vi.fn()
      // 1: the endpoint query fails
      .mockResolvedValueOnce(jsonResponse(null, false, 502))
      // 2: the index loads fine
      .mockResolvedValueOnce(jsonResponse({
        entries: [{ id: 'p', type: 'page', route: '/a', title: 'Alpha', content: 'alpha' }]
      }))
    vi.stubGlobal('fetch', fetchMock)

    const client = createSearchClient(makeWebsite({ provider: 'endpoint' }), { useStorage: false })
    const results = await client.query('alpha')

    expect(client.getProviderName()).toBe('index')
    expect(results.map(r => r.id)).toContain('p')
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('trying the local index'))
  })

  test('an aborted query propagates rather than falling back', async () => {
    const abortErr = Object.assign(new Error('aborted'), { name: 'AbortError' })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortErr))

    const client = createSearchClient(makeWebsite({ provider: 'endpoint' }))
    await expect(client.query('x')).rejects.toThrow('aborted')
  })

  test('an empty query short-circuits before any provider loads', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const client = createSearchClient(makeWebsite({ provider: 'endpoint' }))
    expect(await client.query('   ')).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('a disabled site returns [] without querying', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const client = createSearchClient(makeWebsite({ provider: 'endpoint', enabled: false }))
    expect(await client.query('x')).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

/**
 * `total` — how many matched before `limit`, the 47 in "showing 10 of 47".
 *
 * The value only exists at the provider, before the slice, so it has to be
 * carried deliberately. `null` is a real answer meaning "this provider cannot
 * say" — a deployment fact, like `matches` or `item` on a result, not a failure.
 */
describe('match totals', () => {
  test('the endpoint provider carries a stated total', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ total: 47, results: [{ id: 'a', route: '/a' }] }))
    )
    const provider = createEndpointProvider(makeWebsite({ provider: 'endpoint' }), {
      endpoint: '_search'
    })
    expect(await provider.query('x', { limit: 10 })).toMatchObject({ total: 47 })
  })

  test('a server that states no total yields null, not a guess', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ results: [{ id: 'a', route: '/a' }] }))
    )
    const provider = createEndpointProvider(makeWebsite({ provider: 'endpoint' }), {
      endpoint: '_search'
    })
    const { results, total } = await provider.query('x', { limit: 10 })
    expect(results).toHaveLength(1)
    expect(total).toBeNull() // NOT results.length — that number is already available
  })

  /**
   * The subtle one. The server counted matches for a query it answered without
   * knowing about `type`/`route`, which are applied here. Reporting its number
   * beside a locally-narrowed list would render "showing 1 of 47" next to a
   * filter that produced the 1 — consistent-looking and wrong. Nor can it be
   * recomputed: what arrived was already capped at `limit`.
   */
  test('discards a stated total when a local filter narrowed the set', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          total: 47,
          results: [
            { id: 'a', type: 'page', route: '/a' },
            { id: 'b', type: 'section', route: '/b' }
          ]
        })
      )
    )
    const provider = createEndpointProvider(makeWebsite({ provider: 'endpoint' }), {
      endpoint: '_search'
    })

    const narrowed = await provider.query('x', { limit: 10, type: 'page' })
    expect(narrowed.results).toHaveLength(1)
    expect(narrowed.total).toBeNull()

    // A filter that removes nothing is not narrowing, so the count survives.
    const untouched = await provider.query('x', { limit: 10, route: '/' })
    expect(untouched.results).toHaveLength(2)
    expect(untouched.total).toBe(47)
  })

  test('the client tolerates a transport that returns a bare array', async () => {
    // `transport.query` is a public seam; its contract has always been "returns
    // results". An array means no count offered, never an error.
    const client = createSearchClient(makeWebsite({ provider: 'legacy' }), {
      transports: {
        legacy: { query: async () => [{ ...emptyResult(), id: 'a', route: '/a' }] }
      }
    })
    expect(await client.queryWithTotal('x')).toEqual({
      results: [expect.objectContaining({ id: 'a' })],
      total: null
    })
  })

  test('client.query still returns a bare array', async () => {
    // The published surface. Widening it would break every foundation that
    // iterates the result of `search.query(...)`.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ total: 47, results: [{ id: 'a', route: '/a' }] }))
    )
    const client = createSearchClient(makeWebsite({ provider: 'endpoint' }))
    const results = await client.query('x')
    expect(Array.isArray(results)).toBe(true)
    expect(results).toHaveLength(1)
  })
})

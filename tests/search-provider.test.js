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
function makeWebsite({ provider, endpoint, basePath = '', locale = 'en', enabled = true } = {}) {
  return {
    basePath,
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
    expect(resolveEndpointUrl('_search', '/gateway/site/abc123'))
      .toBe('/gateway/site/abc123/_search')
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
    const results = await provider.query('hello', { limit: 5 })

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
    const [result] = await provider.query('x')

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
      const results = await provider.query('a')
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
    const [result] = await provider.query('a')

    // A component may read any contract key without guarding for undefined.
    expect(Object.keys(result).sort()).toEqual(Object.keys(emptyResult()).sort())
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

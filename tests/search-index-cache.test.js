/**
 * Search-index caching — freshness.
 *
 * The stored index used to be returned unconditionally: no expiry, no
 * validator, nothing that could notice the site had been rebuilt. Two things
 * followed, and both were found in the field rather than by a test.
 *
 *   1. A visitor who searched once kept answering from that index for as long
 *      as the entry survived. Redeploying did not dislodge it.
 *   2. The key is the index URL — `/search-index.json` for every Uniweb
 *      project — and localStorage is scoped to an origin. Two projects sharing
 *      a dev port shared one entry, so a search on one returned the other's
 *      pages: a 43-entry docs-template index answering for a 172-entry site,
 *      complete with routes that did not exist on it.
 *
 * Neither surfaced as an error. Search simply answered, plausibly, about the
 * wrong content — so the assertions below are about *whether the server was
 * asked*, which is the only observable that separates the two states.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const URL_A = '/search-index.json'

/**
 * Simulate a fresh page load.
 *
 * The memory cache is module-scope, so a new page load means a new module
 * instance — while localStorage survives. That distinction IS the subject of
 * these tests, so it has to be modelled rather than approximated:
 * `clearSearchCache()` would wipe the stored entry too, and every assertion
 * below would pass against the broken implementation.
 */
async function pageLoad() {
  vi.resetModules()
  return import('../src/search/providers/index-provider.js')
}

/** Minimal localStorage stand-in — kit's test environment has no DOM. */
function fakeStorage() {
  const map = new Map()
  return {
    get length() { return map.size },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    _dump: () => [...map.keys()],
    _raw: map,
  }
}

const index = (n, tag) => ({ entries: Array.from({ length: n }, (_, i) => ({ id: `${tag}:${i}` })) })

/** A fetch stub that records calls and replays scripted responses. */
function fetchStub(responses) {
  const calls = []
  const fn = vi.fn(async (url, init) => {
    calls.push({ url, headers: init?.headers || {}, cache: init?.cache })
    const next = responses.shift()
    if (typeof next === 'function') return next()
    return next
  })
  fn.calls = calls
  return fn
}

const ok = (body, headers = {}) => ({
  ok: true,
  status: 200,
  json: async () => body,
  headers: { get: (h) => headers[h.toLowerCase()] ?? null },
})

const notModified = () => ({
  ok: false,
  status: 304,
  json: async () => { throw new Error('304 has no body') },
  headers: { get: () => null },
})

let storage

beforeEach(() => {
  storage = fakeStorage()
  globalThis.window = { localStorage: storage }
})

afterEach(() => {
  delete globalThis.window
  delete globalThis.fetch
  vi.restoreAllMocks()
})

describe('a stored index is revalidated, never trusted blindly', () => {
  it('asks the server even when a stored copy exists', async () => {
    globalThis.fetch = fetchStub([ok(index(2, 'server'), { etag: 'W/"1"' })])
    await (await pageLoad()).loadSearchIndex(URL_A)

    globalThis.fetch = fetchStub([notModified()])
    await (await pageLoad()).loadSearchIndex(URL_A)

    // The whole bug in one assertion: the second load must hit the network.
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    expect(globalThis.fetch.calls[0].headers['If-None-Match']).toBe('W/"1"')
  })

  it('returns the stored payload on 304 without re-downloading', async () => {
    globalThis.fetch = fetchStub([ok(index(3, 'first'), { etag: 'W/"1"' })])
    const first = await (await pageLoad()).loadSearchIndex(URL_A)

    globalThis.fetch = fetchStub([notModified()])
    const second = await (await pageLoad()).loadSearchIndex(URL_A)

    expect(second.entries).toHaveLength(3)
    expect(second.entries).toEqual(first.entries)
  })

  it('replaces the stored copy when the server has different content', async () => {
    // This is both the rebuild case and the two-projects-one-port case: the
    // server answering is not the one that wrote the entry.
    globalThis.fetch = fetchStub([ok(index(43, 'template'), { etag: 'W/"old"' })])
    await (await pageLoad()).loadSearchIndex(URL_A)

    globalThis.fetch = fetchStub([ok(index(172, 'site'), { etag: 'W/"new"' })])
    const fresh = await (await pageLoad()).loadSearchIndex(URL_A)

    expect(fresh.entries).toHaveLength(172)
    expect(fresh.entries[0].id).toMatch(/^site:/)

    // And the replacement is persisted, not just returned.
    globalThis.fetch = fetchStub([notModified()])
    const afterReload = await (await pageLoad()).loadSearchIndex(URL_A)
    expect(afterReload.entries).toHaveLength(172)
  })

  it('falls back to the stored copy when the network fails', async () => {
    globalThis.fetch = fetchStub([ok(index(5, 'stored'), { etag: 'W/"1"' })])
    await (await pageLoad()).loadSearchIndex(URL_A)

    globalThis.fetch = vi.fn(async () => { throw new Error('offline') })
    const offline = await (await pageLoad()).loadSearchIndex(URL_A)

    // Serving it unvalidated is right here, and only here: some search beats none.
    expect(offline.entries).toHaveLength(5)
  })

  it('propagates the failure when there is nothing stored to fall back on', async () => {
    globalThis.fetch = vi.fn(async () => { throw new Error('offline') })
    const { loadSearchIndex } = await pageLoad()
    await expect(loadSearchIndex(URL_A)).rejects.toThrow('offline')
  })

  it('does not send a conditional header when the host supplied no validator', async () => {
    globalThis.fetch = fetchStub([ok(index(2, 'a'))]) // no etag, no last-modified
    await (await pageLoad()).loadSearchIndex(URL_A)

    globalThis.fetch = fetchStub([ok(index(4, 'b'))])
    const second = await (await pageLoad()).loadSearchIndex(URL_A)

    expect(globalThis.fetch.calls[0].headers['If-None-Match']).toBeUndefined()
    // Costs a full fetch, but is never served as though known to be current.
    expect(second.entries).toHaveLength(4)
  })

  it('never asks the browser to prefer a cached response', async () => {
    // `force-cache` defeated revalidation a second time over, underneath ours.
    globalThis.fetch = fetchStub([ok(index(1, 'a'), { etag: 'W/"1"' })])
    await (await pageLoad()).loadSearchIndex(URL_A)
    expect(globalThis.fetch.calls[0].cache).toBe('no-cache')
  })
})

describe('memory cache', () => {
  it('serves repeat calls within one page load without refetching', async () => {
    globalThis.fetch = fetchStub([ok(index(2, 'a'), { etag: 'W/"1"' })])
    const { loadSearchIndex } = await pageLoad()
    await loadSearchIndex(URL_A)
    await loadSearchIndex(URL_A)
    await loadSearchIndex(URL_A)
    // An index cannot change under a page that is already running.
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })
})

describe('entries from the previous storage schema', () => {
  it('are never read, and are cleared out', async () => {
    // v1 stored the payload bare and had no validator, so it could not be
    // revalidated at all — the state that produced the original bug.
    storage.setItem('uniweb:search:v1:/search-index.json', JSON.stringify(index(43, 'stale')))

    globalThis.fetch = fetchStub([ok(index(172, 'site'), { etag: 'W/"1"' })])
    const result = await (await pageLoad()).loadSearchIndex(URL_A)

    expect(result.entries).toHaveLength(172)
    expect(storage._dump()).not.toContain('uniweb:search:v1:/search-index.json')
    // A search index is hundreds of kilobytes; leaving it orphaned is a real
    // bite out of the origin's quota.
    expect(storage._dump().every((k) => k.startsWith('uniweb:search:v2:'))).toBe(true)
  })
})

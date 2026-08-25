/**
 * A host that declares the search service and offers NO ADDRESS.
 *
 * This is the CONFIG-level decline — distinct from `search-endpoint-decline`,
 * which covers a host that gave an address and then refused the query with a
 * 403. Here there is nothing to ask.
 *
 * ⛔ Why it must not fall through to the local index. On a host-served lane the
 * framework emits no search index (`@uniweb/build` stopped writing one on
 * 2026-08-01), so `'index'` resolves to a `search-index.json` that nothing
 * writes — a guaranteed 404 dressed as a fallback. Measured live on a hosted
 * site 2026-08-25.
 *
 * ⭐ The distinction the whole file turns on: `{ source: 'host', url: null }`
 * is "the host answered and declined"; `{ source: null }` is "nobody declared
 * it", which is the STATIC-host path where the index really is emitted and
 * `'index'` is right. Collapsing the two is the defect.
 */

import { describe, test, expect, vi, afterEach } from 'vitest'
import { createSearchClient } from '../src/search/client.js'

function makeWebsite({ services, authoredSearch = { enabled: true } } = {}) {
  return {
    basePath: '',
    config: {
      search: authoredSearch,
      ...(services !== undefined ? { services } : {}),
    },
    isSearchEnabled: () => true,
    getActiveLocale: () => 'en',
    getSearchIndexUrl: () => '/search-index.json',
    getSearchConfig: () => ({ enabled: true, provider: 'index' }),
  }
}

describe('host declines search — the service name with no address', () => {
  const original = globalThis.fetch
  afterEach(() => { globalThis.fetch = original })

  test('isEnabled() is false, so a foundation draws no search UI', () => {
    const client = createSearchClient(makeWebsite({ services: { search: {} } }))

    expect(client.isEnabled()).toBe(false)
  })

  test('a query returns empty WITHOUT making a request', async () => {
    const fetchSpy = vi.fn()
    globalThis.fetch = fetchSpy
    const client = createSearchClient(makeWebsite({ services: { search: {} } }))

    await expect(client.query('anything')).resolves.toEqual([])
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  test('an ENTITLED host — name WITH an address — still resolves to the endpoint', () => {
    const client = createSearchClient(
      makeWebsite({ services: { search: { endpoint: '/_search' } } }),
    )

    expect(client.isEnabled()).toBe(true)
  })

  test('⭐ a host offering OTHER services but not search IS a decline', () => {
    // ⛔ THIS ASSERTED THE OPPOSITE until 2026-08-25, and the inversion is the
    // whole fix. A host that emitted a services block is answering for EVERY
    // service; a name absent from it means the host does not offer it. Before
    // this, an absent key was `source: null` — byte-identical to a static host
    // — so kit took its local-index fallback and 404'd, because a host-served
    // lane emits no index.
    //
    // This is the shape entitlement gating actually produces: a site that has
    // not bought search gets the key REMOVED, not blanked.
    const client = createSearchClient(makeWebsite({ services: { tracking: {} } }))

    expect(client.isEnabled()).toBe(false)
  })

  test('a host emitting an EMPTY services block declines everything', () => {
    // A site entitled to nothing. Still a host answering.
    const client = createSearchClient(makeWebsite({ services: {} }))

    expect(client.isEnabled()).toBe(false)
  })

  test('a static host — no services block at all — is unaffected', () => {
    const client = createSearchClient(makeWebsite())

    expect(client.isEnabled()).toBe(true)
  })

  test("⭐ a site's OWN endpoint survives a host decline", () => {
    // The sharpest guard on this change: an operator running self-hosted
    // search on a host that does not sell it must keep working.
    // `resolveService` tier 1 is the site's own declaration, so it answers
    // with `source: 'site'` and never reaches the decline branch.
    const website = makeWebsite({
      services: { search: {} },
      authoredSearch: { enabled: true, endpoint: '/my-own-search' },
    })
    const client = createSearchClient(website)

    expect(client.isEnabled()).toBe(true)
  })

  test('a site authoring a provider but NO address still honours the decline', () => {
    // No address of its own ⇒ it is relying on the host or the default, and
    // the host said no. Drawing nothing is right; falling back to `index`
    // would 404 on this lane.
    const website = makeWebsite({
      services: { search: {} },
      authoredSearch: { enabled: true, provider: 'endpoint' },
    })
    const client = createSearchClient(website)

    expect(client.isEnabled()).toBe(false)
  })
})

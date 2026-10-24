/**
 * The local provider's results are the engine's (`searchResult` in `@uniweb/projections/search`),
 * the call a server answering search makes too. Its snippet marks what the ranking matched by the
 * engine's fold: `cafe` ranks a page holding "café", so the snippet marks "café". ⛔ Until
 * 2026-10-23 it matched with a lowercase `indexOf` and marked nothing there, and a record's
 * `group` and `item` never reached its result.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createIndexProvider, clearSearchCache } from '../src/search/providers/index-provider.js'

const ENTRIES = [
  { id: 'page:/menu', type: 'page', route: '/menu', title: 'Menu', content: 'Le café est ouvert tous les jours.' },
  { id: 'record:dishes:soup', type: 'record', group: 'dishes', route: '/dishes/soup', title: 'Soup',
    content: 'A soup served with café au lait.', item: { title: 'Soup' } },
]

const website = { getSearchIndexUrl: () => '/search-index.json', isSearchEnabled: () => true }

beforeEach(() => {
  globalThis.window = { localStorage: null }
  globalThis.fetch = vi.fn(async () => ({
    ok: true, status: 200,
    json: async () => ({ entries: ENTRIES }),
    headers: { get: () => null },
  }))
  clearSearchCache()
})

afterEach(() => {
  clearSearchCache()
  delete globalThis.window
  delete globalThis.fetch
  vi.restoreAllMocks()
})

describe('the index provider shapes results with the engine', () => {
  it('marks "café" for the query cafe', async () => {
    const { results } = await createIndexProvider(website).query('cafe', { limit: 10 })
    const menu = results.find((r) => r.id === 'page:/menu')
    expect(menu.snippetHtml).toBe('Le <mark>café</mark> est ouvert tous les jours.')
    expect(menu.matches).toEqual([{ key: 'content', indices: [[3, 6]] }])
  })

  it("carries a record's group and display fields", async () => {
    const { results } = await createIndexProvider(website).query('soup', { limit: 10 })
    expect(results[0]).toMatchObject({ id: 'record:dishes:soup', group: 'dishes', item: { title: 'Soup' }, href: '/dishes/soup' })
  })
})

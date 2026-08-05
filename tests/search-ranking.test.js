/**
 * Search ranking — a page that contains the words must outrank one that does not.
 *
 * Fuse is approximate by design, and on fields the size of a whole page that
 * turns into a defect rather than a tuning preference. Measured on a real
 * documentation site before this fix: searching "inset" returned 68 hits, of
 * which **4** contained the word, and those four ranked 12th, 15th, 16th and
 * 18th. With ten results visible, every result the reader saw was a near-miss
 * on a page that never mentions insets — so the site looked as though it had
 * nothing on the subject while four pages documented it.
 *
 * Nothing errored. Search answered confidently with the wrong pages.
 *
 * THE FIXTURE MATTERS. A first version of this file used plausible-looking
 * entries and passed with the fix removed — Fuse happened to rank them
 * correctly on its own, so the assertions proved nothing. The entries below
 * were chosen by measuring Fuse until it actually inverted: it scores the
 * short "Insert" title at 0.38 and the long page that genuinely says "Inset
 * components" at 0.81, putting the near-miss first. Every ordering assertion
 * here fails without the tier sort.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createIndexProvider, clearSearchCache } from '../src/search/providers/index-provider.js'

/** Page-sized body, so Fuse behaves as it does on real content. */
const filler = (topic) => `This page discusses ${topic}. `.repeat(40)

const ENTRIES = [
  // Long, genuinely about insets. Fuse scores it WORST of the three.
  { id: 'patterns', type: 'section', route: '/docs/development/component-patterns',
    anchor: 'section-cp', title: 'CCA Component Patterns', pageTitle: 'Docs',
    content: `${filler('patterns')} Inset components are referenced from markdown. Insets receive content and params.` },

  // Title carries both words — should beat a body-only match.
  { id: 'reference', type: 'section', route: '/docs/reference/insets',
    anchor: 'section-insets', title: 'Inset Components', pageTitle: 'Docs',
    content: filler('reference material') },

  // Near-misses. Short fields with titles Fuse rates close to "inset", and
  // not one of them contains the word.
  { id: 'insert', type: 'section', route: '/how-it-works', anchor: 'section-x1',
    title: 'Insert', pageTitle: 'Site', content: 'Short.' },
  { id: 'instead', type: 'section', route: '/workflow', anchor: 'section-x2',
    title: 'Instead of that', pageTitle: 'Site', content: 'Short.' },
]

const website = {
  getSearchIndexUrl: () => '/search-index.json',
  isSearchEnabled: () => true,
}

const contains = (id, word) =>
  `${ENTRIES.find((e) => e.id === id).title} ${ENTRIES.find((e) => e.id === id).content}`
    .toLowerCase().includes(word)

beforeEach(() => {
  globalThis.window = { localStorage: null }   // no storage: always fetch
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

describe('pages containing the term rank above near-misses', () => {
  it('puts every literal match ahead of every fuzzy one', async () => {
    const ids = (await createIndexProvider(website).query('inset', { limit: 10 })).results.map((r) => r.id)

    const lastLiteral = Math.max(ids.indexOf('patterns'), ids.indexOf('reference'))
    const firstFuzzy = Math.min(
      ...['insert', 'instead']
        .map((id) => ids.indexOf(id))
        .map((i) => (i === -1 ? Infinity : i))
    )

    expect(lastLiteral).toBeGreaterThanOrEqual(0)
    expect(lastLiteral).toBeLessThan(firstFuzzy)
  })

  it('surfaces the documentation page instead of burying it', async () => {
    // The reported symptom, in miniature: this page documents insets and Fuse
    // rates it the worst match of the set.
    const ids = (await createIndexProvider(website).query('inset', { limit: 10 })).results.map((r) => r.id)
    expect(ids.indexOf('patterns')).toBeLessThan(2)
    expect(contains('patterns', 'inset')).toBe(true)
  })

  it('prefers a title match over a body match', async () => {
    const { results } = await createIndexProvider(website).query('inset components', { limit: 10 })
    expect(results[0].route).toBe('/docs/reference/insets')
  })

  it('requires every word of a multi-word query', async () => {
    // "Inset Components" must not be satisfied by a page that only says one of
    // them, or the tier buys nothing on real queries.
    const { results } = await createIndexProvider(website).query('Inset Components', { limit: 10 })
    const top = results.slice(0, 2).map((r) => r.id)
    expect(top).not.toContain('insert')
    expect(top).not.toContain('instead')
  })
})

describe('fuzzy matching is kept as a fallback', () => {
  it('still answers a misspelled query', async () => {
    // Why near-misses are reordered rather than dropped: with no literal match
    // anywhere, fuzzy is the only thing that can answer at all.
    const { results } = await createIndexProvider(website).query('componnt pattrns', { limit: 10 })
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].route).toBe('/docs/development/component-patterns')
  })
})

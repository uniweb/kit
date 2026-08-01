import { createEndpointProvider } from '../src/search/providers/endpoint-provider.js'

/**
 * A declining search endpoint explains itself in words meant for a visitor.
 * Dropping that on the floor and reporting a status code is the same mistake
 * the submission path made: the host wrote a sentence for a person, and the
 * client showed them a number.
 */
const website = {
  basePath: '',
  getActiveLocale: () => 'en',
  config: { search: { endpoint: '/_search' } },
}

function declining(status, body) {
  return async () => ({
    ok: false,
    status,
    json: async () => {
      if (body === undefined) throw new Error('not JSON')
      return body
    },
  })
}

describe('endpoint provider — a decline carries the endpoint’s own words', () => {
  const original = globalThis.fetch
  afterEach(() => { globalThis.fetch = original })

  it("throws with the endpoint's `error` string, not its status", async () => {
    globalThis.fetch = declining(403, { error: 'Search is not available on this site.', results: [] })
    const p = createEndpointProvider(website, { endpoint: '/_search' })
    await expect(p.query('anything')).rejects.toThrow('Search is not available on this site.')
  })

  it('falls back to the status when the body carries no explanation', async () => {
    globalThis.fetch = declining(503, {})
    const p = createEndpointProvider(website, { endpoint: '/_search' })
    await expect(p.query('anything')).rejects.toThrow('Search endpoint returned 503')
  })

  it('falls back to the status when the body is not JSON at all', async () => {
    globalThis.fetch = declining(502, undefined)
    const p = createEndpointProvider(website, { endpoint: '/_search' })
    await expect(p.query('anything')).rejects.toThrow('Search endpoint returned 502')
  })
})

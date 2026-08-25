import { createEndpointProvider } from '../src/search/providers/endpoint-provider.js'

/**
 * A declining search endpoint's message is a DIAGNOSTIC, not visitor copy.
 *
 * ⛔ This docblock argued the opposite until 2026-08-25 — that the host "wrote
 * a sentence for a person" and kit should carry it up to be rendered. Ruled
 * against: a control for a service the site does not have must not be drawn,
 * so a visitor never reaches this path and there is nothing to apologise for.
 * A host-supplied sentence would also report the operator's provisioning state
 * to the public, in one language, outside the site's localization.
 *
 * ⭐ Worth keeping as a lesson, not just a fix: the code that consumed this
 * shape was deleted when it was ruled against, and THIS COMMENT — the argument
 * FOR it — survived, in a test, and read as current intent to everyone who
 * opened the file afterwards. A deletion that removes the mechanism and leaves
 * the reasoning behind has kept the part that regrows.
 *
 * What the assertions below pin is unchanged and still right: the message that
 * reaches a DEVELOPER's console should say more than "403".
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

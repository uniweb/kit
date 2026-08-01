/**
 * Site services — one resolution rule for every service a site consumes.
 *
 * The behaviour worth pinning is not "it finds a URL". It is:
 *
 *  - the **precedence**, because an operator who named an endpoint means it even
 *    on a host that offers one;
 *  - the **open registry**, because the whole point is that a foundation can
 *    invent a service the framework has never heard of;
 *  - the **base join**, which had three slightly different implementations
 *    before this module and where every one of the bugs lived.
 */

import {
  resolveService,
  resolveServiceUrl,
  NO_SERVICE_REASON,
} from '../src/utils/services.js'

const site = (config, basePath = '') => ({ basePath, config })

describe('resolveService — precedence', () => {
  it('uses the site declaration', () => {
    expect(resolveService(site({ submit: '/forms' }), 'submit')).toEqual({
      url: '/forms',
      reason: null,
      source: 'site',
    })
  })

  it('uses the host when the site is silent', () => {
    expect(
      resolveService(site({ services: { submit: { endpoint: '/_submit' } } }), 'submit'),
    ).toEqual({ url: '/_submit', reason: null, source: 'host' })
  })

  // An operator who named an endpoint means it — a host offering one does not
  // quietly take over.
  it('prefers the site over the host', () => {
    const w = site({ submit: '/mine', services: { submit: { endpoint: '/theirs' } } })
    expect(resolveService(w, 'submit')).toMatchObject({ url: '/mine', source: 'site' })
  })

  it('relays a host reason verbatim when it offers no endpoint', () => {
    const w = site({ services: { submit: { reason: 'Not enabled for this site.' } } })
    expect(resolveService(w, 'submit')).toEqual({
      url: null,
      reason: 'Not enabled for this site.',
      source: 'host',
    })
  })

  it('prefers a host endpoint over a host reason', () => {
    const w = site({ services: { submit: { endpoint: '/x', reason: 'ignored' } } })
    expect(resolveService(w, 'submit')).toMatchObject({ url: '/x', reason: null })
  })

  it('reports absence with a default reason and no source', () => {
    expect(resolveService(site({}), 'submit')).toEqual({
      url: null,
      reason: NO_SERVICE_REASON,
      source: null,
    })
  })

  it('lets the caller supply the wording for absence', () => {
    const { reason } = resolveService(site({}), 'submit', { reason: 'Nowhere to send.' })
    expect(reason).toBe('Nowhere to send.')
  })

  it('survives a website with no config at all', () => {
    expect(resolveService(undefined, 'submit').url).toBeNull()
    expect(resolveService({}, 'submit').url).toBeNull()
  })

  it('accepts both declaration forms on both sides', () => {
    expect(resolveService(site({ search: { endpoint: '/s' } }), 'search').url).toBe('/s')
    expect(resolveService(site({ services: { search: '/s' } }), 'search').url).toBe('/s')
  })

  it('treats blank declarations as absent', () => {
    for (const submit of ['', '   ', {}, { endpoint: '' }, null]) {
      expect(resolveService(site({ submit }), 'submit').url).toBeNull()
    }
  })
})

// The registry is open by design: the framework ships clients for what it
// implements and resolution for anything. A service it has never heard of gets
// the same precedence and the same base handling.
describe('resolveService — the registry is open, not an enum', () => {
  it('resolves a service the framework knows nothing about', () => {
    const w = site({ assistant: { endpoint: '/_ask' } })
    expect(resolveService(w, 'assistant')).toMatchObject({ url: '/_ask', source: 'site' })
  })

  it('lets a host offer one the site never declared', () => {
    const w = site({ services: { translate: { endpoint: '/_translate' } } })
    expect(resolveService(w, 'translate')).toMatchObject({ url: '/_translate', source: 'host' })
  })

  it('applies the same base handling to an unknown service', () => {
    const w = site({ assistant: '_ask' }, '/docs')
    expect(resolveService(w, 'assistant').url).toBe('/docs/_ask')
  })
})

describe('resolveServiceUrl — the join', () => {
  it('roots a bare relative endpoint', () => {
    // `endpoint: _search` is documented and in use. Left unrooted it would
    // resolve against whatever page the visitor happens to be on.
    expect(resolveServiceUrl('_search', '')).toBe('/_search')
    expect(resolveServiceUrl('_search', '/docs')).toBe('/docs/_search')
  })

  it('applies the base to a root-relative endpoint', () => {
    expect(resolveServiceUrl('/forms', '/docs')).toBe('/docs/forms')
    expect(resolveServiceUrl('/forms', '')).toBe('/forms')
  })

  // The regression the existing submit tests caught during this refactor:
  // applyBasePath concatenates and documents its input as carrying no trailing
  // slash, so normalizing is the caller's job.
  it('does not double a slash when the base has a trailing one', () => {
    expect(resolveServiceUrl('/forms', '/docs/')).toBe('/docs/forms')
    expect(resolveServiceUrl('_search', '/docs/')).toBe('/docs/_search')
  })

  it('is idempotent — an already-based path is not based twice', () => {
    expect(resolveServiceUrl('/docs/forms', '/docs')).toBe('/docs/forms')
  })

  it('passes absolute URLs through, whatever the scheme', () => {
    for (const url of [
      'https://forms.example.com/intake',
      'http://forms.example.com/intake',
      '//forms.example.com/intake',
      'mailto:hi@example.com',
    ]) {
      expect(resolveServiceUrl(url, '/docs')).toBe(url)
    }
  })

  it('returns empty for an empty endpoint', () => {
    expect(resolveServiceUrl('', '/docs')).toBe('')
  })
})

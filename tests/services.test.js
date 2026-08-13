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
} from '../src/utils/services.js'

const site = (config, basePath = '') => ({ basePath, config })

describe('resolveService — precedence', () => {
  it('uses the site declaration', () => {
    expect(resolveService(site({ submit: '/forms' }), 'submit')).toEqual({
      url: '/forms',
      source: 'site',
    })
  })

  it('uses the host when the site is silent', () => {
    expect(
      resolveService(site({ services: { submit: { endpoint: '/_submit' } } }), 'submit'),
    ).toEqual({ url: '/_submit', source: 'host' })
  })

  // An operator who named an endpoint means it — a host offering one does not
  // quietly take over.
  it('prefers the site over the host', () => {
    const w = site({ submit: '/mine', services: { submit: { endpoint: '/theirs' } } })
    expect(resolveService(w, 'submit')).toMatchObject({ url: '/mine', source: 'site' })
  })

  // A host may name the service while offering no address. That is still the
  // host answering — but it yields no WORDING, deliberately: any sentence would
  // be ours to invent, in one language, for a visitor with no stake in it.
  it('a host declining with no address still reads as the host answering', () => {
    const w = site({ services: { submit: {} } })
    expect(resolveService(w, 'submit')).toEqual({ url: null, source: 'host' })
  })

  it('ignores a stray reason a host still sends', () => {
    const w = site({ services: { submit: { reason: 'Not enabled for this site.' } } })
    expect(resolveService(w, 'submit')).toEqual({ url: null, source: 'host' })
  })

  it('prefers a host endpoint over anything else on the declaration', () => {
    const w = site({ services: { submit: { endpoint: '/x', reason: 'ignored' } } })
    expect(resolveService(w, 'submit')).toEqual({ url: '/x', source: 'host' })
  })

  // The two absences a caller can distinguish: nobody declared it at all,
  // versus the host declared it and offered nothing.
  it('reports absence with no source when nothing declares the service', () => {
    expect(resolveService(site({}), 'submit')).toEqual({ url: null, source: null })
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

// A declaration may carry settings the resolver knows nothing about — a
// persona, a model preference, whatever that service needs. `readEndpoint`
// reads `.endpoint` and ignores the rest, so a block that CONFIGURES a service
// without ADDRESSING it must still fall through to the host.
//
// That is what lets one key hold both an address (a deployment fact) and
// authored settings (the site's own). Without it the two would need separate
// keys, and an author who set only the settings would silently lose the host's
// endpoint — turning a site that works into one whose service is "absent".
//
// ⚠️ `treats blank declarations as absent` above covers `{}`, which is NOT this
// property: it proves an EMPTY object resolves to nothing, with no host in the
// fixture. The regression guarded here is "a non-empty object means
// configured" — a change that passes the `{}` case and breaks every one below.
describe('resolveService — a declaration may configure without addressing', () => {
  it('falls through to the host when the site block names no endpoint', () => {
    const w = site({
      assistant: { system: 'You are a support assistant.' },
      services: { assistant: { endpoint: '/_agent/chat' } },
    })
    expect(resolveService(w, 'assistant')).toEqual({
      url: '/_agent/chat',
      source: 'host',
    })
  })

  it('reaches the host decline when the site block names no endpoint', () => {
    const w = site({
      assistant: { system: 'You are a support assistant.' },
      services: { assistant: {} },
    })
    expect(resolveService(w, 'assistant')).toEqual({ url: null, source: 'host' })
  })

  it('still prefers the site when the block carries settings AND an endpoint', () => {
    const w = site({
      assistant: { system: 'You are a support assistant.', endpoint: '/mine' },
      services: { assistant: { endpoint: '/_agent/chat' } },
    })
    expect(resolveService(w, 'assistant')).toMatchObject({ url: '/mine', source: 'site' })
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

/**
 * `useEntityDetail` must not decide a record's address itself.
 *
 * History, because it explains every assertion here. This hook is the half of
 * per-record fetching that runs *outside* a `[slug]` page. It began by
 * composing `/_data/…` by hand while the build wrote `/data/…`, so it was
 * broken on every lane and nothing failed, because it has no call site in this
 * workspace. That was fixed by sharing the path helper — and the fix left the
 * deeper problem in place: it still decided the address.
 *
 * Deciding it here was wrong three ways. It returned the per-record file for
 * ANY collection, though the build only writes that file for a `deferred:` one
 * (a guaranteed 404 otherwise). It could not see a host's live record lane at
 * all. And its hand-rolled `{slug}` replace ignored a route whose param is
 * named anything else.
 *
 * So the invariant is no longer "share the prefix" but the stronger one it was
 * reaching for: **this module composes no address at all.** It asks the same
 * resolution the runtime and the prerenderer ask, and a fourth answer computed
 * here would be a fourth thing to drift.
 */

import { readFileSync } from 'node:fs'
import { recordDataUrl } from '@uniweb/core'
import { buildDetailRequest } from '../src/hooks/useEntityDetail.js'

const withConfig = (config, fn) => {
  const prev = globalThis.uniweb
  globalThis.uniweb = { activeWebsite: { config } }
  try {
    return fn()
  } finally {
    globalThis.uniweb = prev
  }
}

describe('useEntityDetail request building', () => {
  it('asks for nothing when the collection has no separate detail source', () => {
    // The common case, and NOT a failure: nothing was stripped from the
    // cascade, so the caller's record is already whole. Requesting the
    // per-record file here — which is what this hook used to do — is a
    // guaranteed 404, because that file is only written for a `deferred:`
    // collection.
    expect(withConfig({ queries: { articles: {} } }, () =>
      buildDetailRequest({ slug: 'design-tips' }, 'articles')
    )).toBeNull()
  })

  it('resolves a deferred collection to the per-record file the build wrote', () => {
    const request = withConfig({ queries: { articles: { deferred: ['body'] } } }, () =>
      buildDetailRequest({ slug: 'design-tips' }, 'articles')
    )
    // Compared against the shared helper, never a literal: renaming the
    // convention in one place must keep this passing, and re-inlining a copy
    // here must fail it.
    expect(request).toMatchObject({
      path: recordDataUrl('articles', 'design-tips'),
      as: 'articles',
    })
    // and what every detail request now carries beside its address: what it asks
    // for (the full record, for the record index) and the route context the
    // fetcher keys a single-record response on
    expect(request.depth).toBe('full')
    expect(request.dynamicContext).toEqual({ paramName: 'slug', paramValue: 'design-tips' })
    expect(request.query).toBe('articles')
  })

  it('honours an author-declared detailUrl on an API-backed collection', () => {
    const request = withConfig(
      { queries: { articles: { deferred: ['body'], detailUrl: '/api/a/{slug}' } } },
      () => buildDetailRequest({ slug: 'design-tips' }, 'articles')
    )
    expect(request.path ?? request.url).toBe('/api/a/design-tips')
  })

  it('reaches a host\'s live record lane, which it previously could not see', () => {
    const request = withConfig(
      { records: { list: '/_d/{path}', record: '/_d/{path}/{param}' } },
      () => buildDetailRequest({ slug: 'design-tips' }, 'articles')
    )
    // `endpoint`, not `path`: the detail request keeps the collection's address
    // kind, so it retains the remote semantics the fetcher decides on.
    expect(request).toMatchObject({ endpoint: '/_d/articles/design-tips', as: 'articles' })
  })

  it('carries the query name as the binding key, so it shares the cache key', () => {
    const request = withConfig({ queries: { articles: { deferred: ['body'] } } }, () =>
      buildDetailRequest({ slug: 'x' }, 'articles')
    )
    expect(request.as).toBe('articles')
  })

  it('skips without a record, a slug, or a collection', () => {
    expect(buildDetailRequest(null, 'articles')).toBeNull()
    expect(buildDetailRequest(undefined, 'articles')).toBeNull()
    expect(buildDetailRequest({ slug: 'x' }, undefined)).toBeNull()
    expect(buildDetailRequest({ title: 'no slug' }, 'articles')).toBeNull()
  })

  it('composes no URL of its own', () => {
    // The invariant, asserted structurally: every address this module can
    // return comes from the shared resolution, so the source carries no path
    // literal and no string concatenation of one.
    const src = readFileSync(
      new URL('../src/hooks/useEntityDetail.js', import.meta.url),
      'utf8'
    )
    const code = src.replace(/\/\*\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(code).not.toContain('/data/')
    expect(code).not.toContain('recordDataUrl')
  })
})

describe('the param is the SITE\'s, not the hook\'s', () => {
  const deferredCfg = { queries: { articles: { deferred: ['body'] } } }
  const withSite = (extra, fn) => {
    const prev = globalThis.uniweb
    globalThis.uniweb = { activeWebsite: { config: deferredCfg, ...extra } }
    try { return fn() } finally { globalThis.uniweb = prev }
  }

  it('reads the field the site\'s own [param] template routes by', () => {
    // A site routing `[id]`: the hook must address the record the way the page
    // it links to does — by `id` — while the per-record FILE is still named by
    // the record's slug.
    const request = withSite(
      { detailTemplateFor: (key) => (key === 'articles' ? { route: '/blog/:id', paramName: 'id' } : null) },
      () => buildDetailRequest({ id: 7, slug: 'design-tips' }, 'articles')
    )
    expect(request).toMatchObject({ path: recordDataUrl('articles', 'design-tips'), as: 'articles' })
    expect(request.dynamicContext).toEqual({ paramName: 'id', paramValue: '7' })
  })

  it('an explicit options.param wins over the site\'s template', () => {
    const request = withSite(
      { detailTemplateFor: () => ({ route: '/blog/:id', paramName: 'id' }), records: undefined },
      () => buildDetailRequest({ id: 7, slug: 'design-tips', code: 'X1' }, 'articles', { param: 'code' })
    )
    expect(request).toMatchObject({ path: recordDataUrl('articles', 'design-tips'), as: 'articles' })
    expect(request.dynamicContext).toEqual({ paramName: 'code', paramValue: 'X1' })
  })

  it('on a live lane the route field fills the {param} slot', () => {
    const request = withConfig(
      { records: { list: '/_d/{path}', record: '/_d/{path}/{param}' } },
      () => buildDetailRequest({ id: 7, slug: 'design-tips' }, 'articles', { param: 'id' })
    )
    expect(request).toMatchObject({ endpoint: '/_d/articles/7', as: 'articles' })
  })

  it('a record without the routed field is skipped, as a record without a slug was', () => {
    const request = withSite(
      { detailTemplateFor: () => ({ route: '/blog/:id', paramName: 'id' }) },
      () => buildDetailRequest({ slug: 'design-tips' }, 'articles')
    )
    expect(request).toBeNull()
  })

  it('CONTROL — with no template and no option the default is still slug', () => {
    const request = withConfig(deferredCfg, () => buildDetailRequest({ slug: 'design-tips' }, 'articles'))
    expect(request).toMatchObject({ path: recordDataUrl('articles', 'design-tips'), as: 'articles' })
  })
})

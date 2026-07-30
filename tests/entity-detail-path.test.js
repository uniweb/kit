/**
 * `useEntityDetail`'s static-file default must resolve through the shared
 * path convention, not a copy of it.
 *
 * This hook is the half of the deferred-fields feature that runs *outside* a
 * `[slug]` page — the other half is core's dynamic-route auto-detail
 * injection, and both address the same per-record file the build emits. They
 * had drifted: this hook asked for `/_data/…` while the build wrote and core
 * requested `/data/…`, so the hook was broken on every lane. It has no call
 * site in the workspace, so nothing failed; it is documented in AGENTS.md and
 * three public doc pages, so it is not dead code either.
 *
 * The assertions below compare against `recordDataUrl` rather than a literal,
 * so renaming the convention in one place keeps them passing and re-inlining
 * a second copy here fails them.
 */

import { recordDataUrl, DATA_URL_PREFIX } from '@uniweb/core'
import { buildDetailRequest } from '../src/hooks/useEntityDetail.js'

describe('useEntityDetail request building', () => {
  it('resolves the static-file default through the shared helper', () => {
    // No uniweb singleton in this environment, so the collection lookup finds
    // no `detailUrl:` — exactly the file-based-collection path.
    const request = buildDetailRequest({ slug: 'design-tips' }, 'articles')
    expect(request).toEqual({
      path: recordDataUrl('articles', 'design-tips'),
      schema: 'articles'
    })
  })

  it('carries the collection name as the schema, so it shares the cache key', () => {
    const request = buildDetailRequest({ slug: 'x' }, 'articles')
    expect(request.schema).toBe('articles')
  })

  it('skips without a record or without a collection', () => {
    expect(buildDetailRequest(null, 'articles')).toBeNull()
    expect(buildDetailRequest(undefined, 'articles')).toBeNull()
    expect(buildDetailRequest({ slug: 'x' }, undefined)).toBeNull()
    // A record with no slug cannot address a per-record file.
    expect(buildDetailRequest({ title: 'no slug' }, 'articles')).toBeNull()
  })

  it('derives the path from the shared prefix rather than a local copy', () => {
    // The specific regression: `/_data/` was introduced here alone and
    // survived because nothing exercised it. The invariant is not "never an
    // underscore" — the convention may well become `_data` — it is that this
    // module holds no copy of the convention at all.
    const request = buildDetailRequest({ slug: 'x' }, 'articles')
    expect(request.path.startsWith(DATA_URL_PREFIX)).toBe(true)
  })
})

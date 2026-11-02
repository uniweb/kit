/**
 * URL classification has to give the same answer during SSR and in the
 * browser, because the prerendered HTML and the hydrated DOM are supposed to
 * be the same document.
 *
 * Regression: isExternalUrl() read window.location.origin unguarded. Under
 * SSR that throws a ReferenceError, which the function's own catch swallowed
 * into `false` — so during prerender EVERY url was reported internal,
 * including https://ones. <Link> then took its site-relative path and
 * concatenated the deployment base onto an absolute URL, emitting
 * href="/basehttps://x.com/user" into the static HTML. It went unnoticed
 * while the base was empty during prerender; it became visible the moment
 * the base was correctly populated.
 *
 * These tests run under vitest's default node environment — no window — so
 * they exercise the SSR path by construction.
 */

import { isExternalUrl, isFileUrl } from '../src/utils/index.js'
import { applyBasePath } from '../src/utils/href.js'

describe('isExternalUrl (SSR — no window)', () => {
  it('reports absolute URLs external, so no caller treats them as site paths', () => {
    expect(typeof window).toBe('undefined') // guard: we are on the SSR path
    expect(isExternalUrl('https://x.com/user')).toBe(true)
    expect(isExternalUrl('http://example.com')).toBe(true)
  })

  it('reports protocol-relative URLs external', () => {
    // '//cdn.example.com/x' satisfies startsWith('/'), so it must be tested
    // before the root-relative check or it reads as an internal path.
    expect(isExternalUrl('//cdn.example.com/x')).toBe(true)
  })

  it('reports scheme URLs external', () => {
    expect(isExternalUrl('mailto:a@b.com')).toBe(true)
    expect(isExternalUrl('tel:+15551234')).toBe(true)
  })

  it('reports site-relative paths and fragments internal', () => {
    expect(isExternalUrl('/about')).toBe(false)
    expect(isExternalUrl('/')).toBe(false)
    expect(isExternalUrl('#section')).toBe(false)
  })

  it('reports document-relative paths internal', () => {
    expect(isExternalUrl('about')).toBe(false)
    expect(isExternalUrl('./about')).toBe(false)
    expect(isExternalUrl('../about')).toBe(false)
  })

  it('handles empty and non-string input', () => {
    expect(isExternalUrl('')).toBe(false)
    expect(isExternalUrl(null)).toBe(false)
    expect(isExternalUrl(undefined)).toBe(false)
    expect(isExternalUrl(42)).toBe(false)
  })
})

describe('applyBasePath — the join invariant', () => {
  // A base is only ever joined to a path that starts at the site root. This
  // is what makes "/basehttps://x.com" unreachable even if a caller
  // misclassifies the href.
  it('refuses to prefix an absolute URL', () => {
    expect(applyBasePath('https://x.com/user', '/base')).toBe('https://x.com/user')
    expect(applyBasePath('mailto:a@b.com', '/base')).toBe('mailto:a@b.com')
  })

  it('refuses to prefix a protocol-relative URL', () => {
    expect(applyBasePath('//cdn.example.com/x', '/base')).toBe('//cdn.example.com/x')
  })

  it('refuses to prefix a fragment or a relative path', () => {
    expect(applyBasePath('#top', '/base')).toBe('#top')
    expect(applyBasePath('./x', '/base')).toBe('./x')
  })

  it('prefixes a root-relative path', () => {
    expect(applyBasePath('/about', '/base')).toBe('/base/about')
  })

  it('is idempotent', () => {
    const once = applyBasePath('/about', '/base')
    expect(applyBasePath(once, '/base')).toBe('/base/about')
  })

  it('does not treat a same-prefix sibling as already based', () => {
    expect(applyBasePath('/based-goods', '/base')).toBe('/base/based-goods')
  })

  it('is a no-op with no base', () => {
    expect(applyBasePath('/about', '')).toBe('/about')
    expect(applyBasePath('/about', undefined)).toBe('/about')
  })

  it('handles empty and non-string input', () => {
    expect(applyBasePath('', '/base')).toBe('')
    expect(applyBasePath(null, '/base')).toBe(null)
  })
})

describe('isFileUrl', () => {
  it('recognizes document and media extensions', () => {
    expect(isFileUrl('/files/report.pdf')).toBe(true)
    expect(isFileUrl('/img/photo.png')).toBe(true)
  })

  it('does not classify a plain route as a file', () => {
    expect(isFileUrl('/about')).toBe(false)
    expect(isFileUrl('/blog/my-post')).toBe(false)
  })

  it('a path on this site that ends in any extension is a file', () => {
    expect(isFileUrl('/records/uniweb/file/glossary.md')).toBe(true)
    expect(isFileUrl('/records/uniweb/file/route.geojson')).toBe(true)
    expect(isFileUrl('/records/uniweb/file/map-style.yml?v=2')).toBe(true)
    expect(isFileUrl('/files/ATTENDEE-SHEET.PDF#page=2')).toBe(true)
  })

  it('reads the extension where it is, not anywhere in the URL', () => {
    expect(isFileUrl('/guides/report.pdf-notes')).toBe(false)
    expect(isFileUrl('/guides/report.pdf/notes')).toBe(false)
    expect(isFileUrl('/data.json/')).toBe(false)
  })

  it('a folder of a version is a route', () => {
    expect(isFileUrl('/docs/v2.1')).toBe(false)
    expect(isFileUrl('/docs/v2.1/guide')).toBe(false)
  })

  it('a page written with its own extension stays a page', () => {
    expect(isFileUrl('/legal/terms.html')).toBe(false)
    expect(isFileUrl('/legal/terms.htm')).toBe(false)
  })

  it('on another site, only the list says file', () => {
    expect(isFileUrl('https://example.com/report.pdf')).toBe(true)
    expect(isFileUrl('//example.com/report.pdf')).toBe(true)
    expect(isFileUrl('https://en.wikipedia.org/wiki/Node.js')).toBe(false)
    expect(isFileUrl('https://example.com/index.php')).toBe(false)
    expect(isFileUrl('https://example.com')).toBe(false)
    expect(isFileUrl('//example.com/notes.md')).toBe(false)
  })
})

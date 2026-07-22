/**
 * Authored hrefs in prose must resolve exactly like the same href handed to
 * <Link>. Inline links reach components as an HTML string (semantic-parser
 * bakes marks into the text), get rendered with dangerouslySetInnerHTML, and
 * so never pass through <Link> — this module is what closes that gap.
 *
 * Two regressions these pin:
 *
 *  - `page:` / `topic:` references were resolved by SafeHtml but NOT by Text,
 *    so an internal reference written in a paragraph rendered by <P>/<H1>
 *    reached the DOM as href="page:abc" — an unknown URL scheme, and a dead
 *    link. The runtime's link interceptor cannot rescue it either: its
 *    isInternalLink() test rejects a `page:` scheme outright.
 *
 *  - Neither renderer applied the deployment base path, so under a
 *    subdirectory deploy every prose link pointed above the site root. Clicks
 *    survived (useLinkInterceptor repairs those) but crawlers, no-JS visitors,
 *    open-in-new-tab and copy-link-address did not.
 */

import { resolveProseHref, resolveProseHrefs } from '../src/utils/prose-html.js'

/** Minimal Website stand-in: makeHref resolves a small page table. */
function makeWebsite({ basePath = '', pages = {} } = {}) {
  return {
    basePath,
    makeHref(href) {
      const ref = href.replace(/^(page|topic):/, '')
      return pages[ref] ?? href // unresolvable refs come back untouched
    },
  }
}

describe('resolveProseHref', () => {
  it('resolves a page: reference, then applies the base path', () => {
    const website = makeWebsite({ basePath: '/docs', pages: { about: '/about' } })

    expect(resolveProseHref('page:about', website)).toBe('/docs/about')
  })

  it('resolves the legacy topic: scheme identically', () => {
    const website = makeWebsite({ basePath: '/docs', pages: { about: '/about' } })

    expect(resolveProseHref('topic:about', website)).toBe('/docs/about')
  })

  it('bases a plain site-root-relative href', () => {
    expect(resolveProseHref('/cv', makeWebsite({ basePath: '/docs' }))).toBe('/docs/cv')
  })

  it('leaves an unresolvable reference alone rather than basing the scheme', () => {
    const website = makeWebsite({ basePath: '/docs' })

    // makeHref returns it unchanged; it must not become "/docs" + "page:gone"
    expect(resolveProseHref('page:gone', website)).toBe('page:gone')
  })

  it('does not touch what is not a site route', () => {
    const website = makeWebsite({ basePath: '/docs' })

    for (const href of [
      'https://example.com/x',
      '//cdn.example.com/x',
      'mailto:a@b.com',
      'tel:+15551234',
      '#section-intro',
    ]) {
      expect(resolveProseHref(href, website)).toBe(href)
    }
  })

  it('does not double-base an href that already carries the base', () => {
    const website = makeWebsite({ basePath: '/docs' })

    expect(resolveProseHref('/docs/cv', website)).toBe('/docs/cv')
    expect(resolveProseHref('/docs', website)).toBe('/docs')
  })

  it('is a no-op without a base path', () => {
    expect(resolveProseHref('/cv', makeWebsite())).toBe('/cv')
  })

  it('is a no-op without a website', () => {
    expect(resolveProseHref('/cv', null)).toBe('/cv')
  })

  it('does not mistake a same-prefix sibling route for an already-based href', () => {
    // '/docsearch' starts with '/docs' as a STRING but is a different route.
    const website = makeWebsite({ basePath: '/docs' })

    expect(resolveProseHref('/docsearch', website)).toBe('/docs/docsearch')
  })
})

describe('resolveProseHrefs', () => {
  const website = makeWebsite({ basePath: '/docs', pages: { about: '/about' } })

  it('rewrites every anchor in a paragraph, leaving the rest of the markup intact', () => {
    const html =
      'See my <a href="/cv" target="_self">CV</a> and ' +
      '<a href="page:about" target="_self"><em>About</em></a>.'

    expect(resolveProseHrefs(html, website)).toBe(
      'See my <a href="/docs/cv" target="_self">CV</a> and ' +
        '<a href="/docs/about" target="_self"><em>About</em></a>.'
    )
  })

  it('preserves the original quote style and surrounding attributes', () => {
    const html = "<a class='x' href='/cv' download>CV</a>"

    expect(resolveProseHrefs(html, website)).toBe("<a class='x' href='/docs/cv' download>CV</a>")
  })

  it('leaves prose with no anchors untouched', () => {
    const html = 'Just <strong>bold</strong> and <em>italic</em>.'

    expect(resolveProseHrefs(html, website)).toBe(html)
  })

  it('short-circuits when there is nothing to do', () => {
    // No base path and no internal references — the common root-deploy case.
    const plain = makeWebsite()
    const html = '<a href="/cv">CV</a>'

    expect(resolveProseHrefs(html, plain)).toBe(html)
  })

  it('still resolves references when no base path is set', () => {
    const rootSite = makeWebsite({ pages: { about: '/about' } })

    expect(resolveProseHrefs('<a href="page:about">About</a>', rootSite)).toBe(
      '<a href="/about">About</a>'
    )
  })

  it('returns non-strings and empty input unchanged', () => {
    expect(resolveProseHrefs('', website)).toBe('')
    expect(resolveProseHrefs(null, website)).toBe(null)
    expect(resolveProseHrefs(undefined, website)).toBe(undefined)
    expect(resolveProseHrefs(42, website)).toBe(42)
  })

  it('is a no-op without a website, so prose renders fine with no runtime', () => {
    // Text is a presentation primitive used in press/unipress document builds
    // where no Uniweb runtime exists.
    const html = '<a href="/cv">CV</a>'

    expect(resolveProseHrefs(html, undefined)).toBe(html)
  })

  it('does not corrupt an inline-inset marker or math span sharing the string', () => {
    const html =
      '<a href="/cv">CV</a> <uniweb-inset data-ref-id="r1"></uniweb-inset> ' +
      '<span data-type="math" data-latex="x^2">m</span>'

    expect(resolveProseHrefs(html, website)).toBe(
      '<a href="/docs/cv">CV</a> <uniweb-inset data-ref-id="r1"></uniweb-inset> ' +
        '<span data-type="math" data-latex="x^2">m</span>'
    )
  })
})

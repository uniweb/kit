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

import { resolveRoute, resolveHref, resolveProseHrefs } from '../src/utils/href.js'

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

describe('resolveHref', () => {
  it('resolves a page: reference, then applies the base path', () => {
    const website = makeWebsite({ basePath: '/docs', pages: { about: '/about' } })

    expect(resolveHref('page:about', website)).toBe('/docs/about')
  })

  it('resolves the legacy topic: scheme identically', () => {
    const website = makeWebsite({ basePath: '/docs', pages: { about: '/about' } })

    expect(resolveHref('topic:about', website)).toBe('/docs/about')
  })

  it('bases a plain site-root-relative href', () => {
    expect(resolveHref('/cv', makeWebsite({ basePath: '/docs' }))).toBe('/docs/cv')
  })

  it('leaves an unresolvable reference alone rather than basing the scheme', () => {
    const website = makeWebsite({ basePath: '/docs' })

    // makeHref returns it unchanged; it must not become "/docs" + "page:gone"
    expect(resolveHref('page:gone', website)).toBe('page:gone')
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
      expect(resolveHref(href, website)).toBe(href)
    }
  })

  it('does not double-base an href that already carries the base', () => {
    const website = makeWebsite({ basePath: '/docs' })

    expect(resolveHref('/docs/cv', website)).toBe('/docs/cv')
    expect(resolveHref('/docs', website)).toBe('/docs')
  })

  it('is a no-op without a base path', () => {
    expect(resolveHref('/cv', makeWebsite())).toBe('/cv')
  })

  it('is a no-op without a website', () => {
    expect(resolveHref('/cv', null)).toBe('/cv')
  })

  it('does not mistake a same-prefix sibling route for an already-based href', () => {
    // '/docsearch' starts with '/docs' as a STRING but is a different route.
    const website = makeWebsite({ basePath: '/docs' })

    expect(resolveHref('/docsearch', website)).toBe('/docs/docsearch')
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

/**
 * Locale resolution. <Link> applied its locale prefix BEFORE its isFileUrl()
 * check, so a download href picked up a locale segment — and only pages are
 * emitted per locale, everything under public/ is emitted once at the root.
 * That made the prefixed asset path a guaranteed 404. The shared resolver does
 * not reproduce it.
 */
function makeLocalizedWebsite({
  basePath = '',
  active = 'es',
  dflt = 'en',
  routes = {},
  pages = {},
} = {}) {
  return {
    basePath,
    makeHref(href) {
      const ref = href.replace(/^(page|topic):/, '')
      return pages[ref] ?? href
    },
    hasMultipleLocales: () => true,
    getActiveLocale: () => active,
    getDefaultLocale: () => dflt,
    translateRoute: (route) => routes[route] ?? route,
  }
}

describe('resolveRoute — locale', () => {
  it('prefixes the active locale on a page route', () => {
    expect(resolveRoute('/about', makeLocalizedWebsite())).toBe('/es/about')
  })

  it('translates the slug before prefixing', () => {
    const site = makeLocalizedWebsite({ routes: { '/about': '/acerca-de' } })

    expect(resolveRoute('/about', site)).toBe('/es/acerca-de')
  })

  it('does nothing in the default locale', () => {
    expect(resolveRoute('/about', makeLocalizedWebsite({ active: 'en' }))).toBe('/about')
  })

  it('does nothing on a monolingual site', () => {
    const mono = { basePath: '', hasMultipleLocales: () => false }

    expect(resolveRoute('/about', mono)).toBe('/about')
  })

  it('does NOT locale-prefix a file — assets are not emitted per locale', () => {
    const site = makeLocalizedWebsite()

    expect(resolveRoute('/files/report.pdf', site)).toBe('/files/report.pdf')
    expect(resolveRoute('/img/photo.png', site)).toBe('/img/photo.png')
  })

  it('does not double-prefix an already-localized route', () => {
    const site = makeLocalizedWebsite()

    expect(resolveRoute('/es/about', site)).toBe('/es/about')
    expect(resolveRoute('/es', site)).toBe('/es')
  })

  it('handles the homepage', () => {
    expect(resolveRoute('/', makeLocalizedWebsite())).toBe('/es/')
  })

  it('leaves external and scheme hrefs alone', () => {
    const site = makeLocalizedWebsite()

    expect(resolveRoute('https://example.com', site)).toBe('https://example.com')
    expect(resolveRoute('mailto:a@b.com', site)).toBe('mailto:a@b.com')
    expect(resolveRoute('#top', site)).toBe('#top')
  })

  it('opts out of locale when asked, but still resolves references', () => {
    // What <Link reload> needs: its href already carries the TARGET locale.
    const site = makeLocalizedWebsite({ pages: { about: '/about' } })

    expect(resolveRoute('/fr/about', site, { locale: false })).toBe('/fr/about')
    expect(resolveRoute('page:about', site, { locale: false })).toBe('/about')
  })
})

describe('resolveHref — full chain', () => {
  it('applies references, locale and base in that order', () => {
    const site = makeLocalizedWebsite({
      basePath: '/docs',
      routes: { '/about': '/acerca-de' },
      pages: { about: '/about' },
    })

    expect(resolveHref('page:about', site)).toBe('/docs/es/acerca-de')
  })

  it('bases a file without locale-prefixing it', () => {
    const site = makeLocalizedWebsite({ basePath: '/docs' })

    expect(resolveHref('/files/report.pdf', site)).toBe('/docs/files/report.pdf')
  })
})

describe('resolveProseHrefs — locale', () => {
  it('localizes prose links even with no base path and no references', () => {
    // The short-circuit must not skip a localized site.
    const site = makeLocalizedWebsite({ routes: { '/about': '/acerca-de' } })

    expect(resolveProseHrefs('<a href="/about">About</a>', site)).toBe(
      '<a href="/es/acerca-de">About</a>'
    )
  })

  it('leaves a prose download link unlocalized but based', () => {
    const site = makeLocalizedWebsite({ basePath: '/docs' })

    expect(resolveProseHrefs('<a href="/files/r.pdf" download>R</a>', site)).toBe(
      '<a href="/docs/files/r.pdf" download>R</a>'
    )
  })
})

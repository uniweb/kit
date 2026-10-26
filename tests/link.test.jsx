/**
 * <Link> renders through the shared href resolver, so a link passed to the
 * component and a link written in markdown mean the same thing.
 *
 * These render the SSG/prerender path — no React Router registered — which is
 * both the branch that emits a plain <a> into the static document and the one
 * where the base path is applied explicitly. Rendering with
 * renderToStaticMarkup also means there is no `window`, so these exercise the
 * SSR classification by construction.
 *
 * Two latent bugs pinned here:
 *
 *  - the download branch emitted href with no base at all, so every download
 *    link was broken on a subdirectory deploy
 *  - the locale prefix was applied before the isFileUrl() check, so a download
 *    href picked up a locale segment pointing at a path that is never emitted
 */

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Link } from '../src/components/Link/Link.jsx'

/** Install a minimal Uniweb singleton — what useWebsite() reads. */
function withWebsite(website, fn) {
  const prev = globalThis.uniweb
  globalThis.uniweb = {
    activeWebsite: website,
    routingComponents: {}, // no Router → the SSG fallback branch
  }
  try {
    return fn()
  } finally {
    globalThis.uniweb = prev
  }
}

function makeWebsite({ basePath = '', localized = false, active = 'es', dflt = 'en' } = {}) {
  return {
    basePath,
    makeHref: (href) => (href === 'page:about' ? '/about' : href),
    hasMultipleLocales: () => localized,
    getActiveLocale: () => active,
    getDefaultLocale: () => dflt,
    translateRoute: (route) => (route === '/about' ? '/acerca-de' : route),
    localize: (map) => map?.en ?? '',
    getRoutingComponents: () => ({}),
  }
}

function hrefOf(markup) {
  return markup.match(/href="([^"]*)"/)?.[1]
}

function render(website, element) {
  return withWebsite(website, () => renderToStaticMarkup(element))
}

describe('<Link> — base path', () => {
  it('bases an internal link', () => {
    const html = render(makeWebsite({ basePath: '/docs' }), <Link to="/about">About</Link>)

    expect(hrefOf(html)).toBe('/docs/about')
  })

  it('does not touch an external link', () => {
    const html = render(
      makeWebsite({ basePath: '/docs' }),
      <Link href="https://x.com/user">X</Link>
    )

    // The regression that shipped: "/docshttps://x.com/user"
    expect(hrefOf(html)).toBe('https://x.com/user')
    expect(html).toContain('rel="noopener noreferrer"')
  })

  it('bases a download link', () => {
    const html = render(
      makeWebsite({ basePath: '/docs' }),
      <Link href="/files/report.pdf">Report</Link>
    )

    expect(hrefOf(html)).toBe('/docs/files/report.pdf')
    expect(html).toContain('download')
  })

  it('resolves a page: reference and bases it', () => {
    const html = render(makeWebsite({ basePath: '/docs' }), <Link to="page:about">About</Link>)

    expect(hrefOf(html)).toBe('/docs/about')
  })

  it('emits a root-relative href when no base is set', () => {
    expect(hrefOf(render(makeWebsite(), <Link to="/about">About</Link>))).toBe('/about')
  })
})

describe('<Link> — locale', () => {
  it('translates and prefixes a page route', () => {
    const html = render(makeWebsite({ localized: true }), <Link to="/about">About</Link>)

    expect(hrefOf(html)).toBe('/es/acerca-de')
  })

  it('does NOT locale-prefix a download — assets are not emitted per locale', () => {
    const html = render(
      makeWebsite({ localized: true, basePath: '/docs' }),
      <Link href="/files/report.pdf">Report</Link>
    )

    expect(hrefOf(html)).toBe('/docs/files/report.pdf')
    expect(hrefOf(html)).not.toContain('/es/')
  })

  it('leaves a reload link on the locale the caller chose', () => {
    // getLocaleUrl() hands <Link reload> the TARGET locale; re-resolving
    // against the ACTIVE one would send the switcher back where it started.
    const html = render(
      makeWebsite({ localized: true, basePath: '/docs' }),
      <Link reload href="/fr/about">FR</Link>
    )

    expect(hrefOf(html)).toBe('/docs/fr/about')
    expect(html).toContain('data-reload="true"')
  })
})

// A tooltip only where a link does something its text may not say (2026-09-30). ⛔ An
// internal link got `Go to <its path>` until then — `Go to blog/writing for the web`.
describe('<Link> — tooltip', () => {
  const titleOf = (markup) => markup.match(/title="([^"]*)"/)?.[1]

  it('gives an internal link none — not even an empty one', () => {
    for (const href of ['/blog/writing-for-the-web', 'page:about', '/']) {
      const html = render(makeWebsite(), <Link href={href}>Writing for the web</Link>)
      expect(html).not.toContain('title=')
    }
  })

  it('gives an internal link none in a browser too, where the path was readable', () => {
    // With no `window` the old path-reading branch threw and fell through to ''; in a
    // browser it produced the `Go to …` tooltip. So pin the browser case explicitly.
    const prev = globalThis.window
    globalThis.window = { location: { origin: 'https://site.test' } }
    try {
      const html = render(makeWebsite(), <Link href="/blog/writing-for-the-web">Writing for the web</Link>)
      expect(html).not.toContain('title=')
      expect(titleOf(render(makeWebsite(), <Link href="https://example.com/x">X</Link>))).toBe('Open external link')
    } finally {
      if (prev === undefined) delete globalThis.window
      else globalThis.window = prev
    }
  })

  it('gives a reload link none', () => {
    expect(render(makeWebsite(), <Link reload href="/fr/about">FR</Link>)).not.toContain('title=')
  })

  it('says what the text may not: leaving the site, a download, an email, a call', () => {
    expect(titleOf(render(makeWebsite(), <Link href="https://example.com/x">Example</Link>))).toBe('Open external link')
    expect(titleOf(render(makeWebsite(), <Link href="https://github.com/uniweb">Source</Link>))).toBe('View on GitHub')
    expect(titleOf(render(makeWebsite(), <Link href="/files/report.pdf">Report</Link>))).toBe('Download file')
    expect(titleOf(render(makeWebsite(), <Link href="mailto:hello@example.com">Write</Link>))).toBe('Send email to hello@example.com')
    expect(titleOf(render(makeWebsite(), <Link href="tel:+15551234567">Call</Link>))).toBe('Call +15551234567')
  })

  it('keeps a title the caller gives, internal or not', () => {
    expect(titleOf(render(makeWebsite(), <Link href="/about" title="Who we are">About</Link>))).toBe('Who we are')
    expect(titleOf(render(makeWebsite(), <Link href="https://example.com" title="Partner">P</Link>))).toBe('Partner')
  })
})

// ⛔ Until 2026-10-24 only an external link kept its target: an internal page, a reload link, an
// email or a router link dropped it, so `[Docs](/docs){target=_blank}` opened in this tab.
describe('<Link> — target', () => {
  const targetOf = (markup) => markup.match(/target="([^"]*)"/)?.[1]
  const routed = () => ({
    ...makeWebsite(),
    getRoutingComponents: () => ({ Link: ({ to, children, ...rest }) => <a href={to} {...rest}>{children}</a> }),
  })

  it.each([
    ['an internal page', <Link href="/about" target="_blank">About</Link>],
    ['a reload link', <Link reload href="/fr/about" target="_blank">FR</Link>],
    ['an email', <Link href="mailto:hello@example.com" target="_blank">Write</Link>],
  ])('keeps the target of %s', (_, element) => {
    expect(targetOf(render(makeWebsite(), element))).toBe('_blank')
  })

  it('keeps it on a router link', () => {
    expect(targetOf(render(routed(), <Link href="/about" target="_blank">About</Link>))).toBe('_blank')
  })

  it('keeps an external link or a download in this tab when told to', () => {
    expect(targetOf(render(makeWebsite(), <Link href="https://example.com" target="_self">E</Link>))).toBe('_self')
    expect(targetOf(render(makeWebsite(), <Link href="/files/report.pdf" target="_self">R</Link>))).toBe('_self')
  })

  // CONTROL: without one, the defaults are what they were.
  it('without one: a new tab for an external link and a download, none for the rest', () => {
    expect(targetOf(render(makeWebsite(), <Link href="https://example.com">E</Link>))).toBe('_blank')
    expect(targetOf(render(makeWebsite(), <Link href="/files/report.pdf">R</Link>))).toBe('_blank')
    expect(targetOf(render(makeWebsite(), <Link href="/about">About</Link>))).toBeUndefined()
    expect(targetOf(render(routed(), <Link href="/about">About</Link>))).toBeUndefined()
  })
})

// ⛔ Until 2026-10-26 a relative path went to the router, which resolves it against the route,
// while the prerender — no router — wrote it as given, for the browser to resolve against the
// page's URL: one link, two places. Measured on a docs site's link-only table cells.
describe('<Link> — a relative path', () => {
  // Stands in for React Router: it would resolve `to` against the route, so it must not be asked.
  const routed = () => ({
    ...makeWebsite({ basePath: '/sub' }),
    getRoutingComponents: () => ({
      Link: ({ to, children, ...rest }) => <a href={`/route/${to}`} data-router="" {...rest}>{children}</a>,
    }),
  })

  it.each(['about', './about', '../reference/content-structure', 'deploying.md#when-to-choose'])(
    'is written as given, with a router as without one, and gets no base: %s',
    (href) => {
      for (const website of [makeWebsite({ basePath: '/sub' }), routed()]) {
        const html = render(website, <Link href={href}>Go</Link>)
        expect(hrefOf(html)).toBe(href)
        expect(html).not.toContain('data-router')
      }
    }
  )

  // CONTROL: a site path, a fragment and a query are still the router's.
  it('leaves a site path, a fragment and a query to the router', () => {
    for (const href of ['/about', '#top', '?tab=2']) {
      expect(render(routed(), <Link href={href}>Go</Link>)).toContain('data-router')
    }
  })
})

// ⛔ Until 2026-10-26 the home under a base path was `/shop/` in the prerendered page and `/shop` in
// the browser's render — React Router writes its basename without the slash.
describe('<Link> — the home under a base path', () => {
  // Stands in for React Router under a basename: the root is the basename, with no slash.
  const routed = (basePath) => ({
    ...makeWebsite({ basePath }),
    getRoutingComponents: () => ({
      Link: ({ to, children, ...rest }) => <a href={to === '/' ? basePath || '/' : `${basePath}${to}`} data-router="" {...rest}>{children}</a>,
    }),
  })

  it('is the base itself, as the prerender writes it, with a router as without one', () => {
    for (const website of [makeWebsite({ basePath: '/shop' }), routed('/shop')]) {
      const html = render(website, <Link to="/">Bijou</Link>)
      expect(hrefOf(html)).toBe('/shop/')
      expect(html).not.toContain('data-router')
    }
  })

  // CONTROLS: another page under the base, and the home with no base, are still the router's.
  it('leaves another page, and the home at the root, to the router', () => {
    expect(render(routed('/shop'), <Link to="/finds">Finds</Link>)).toContain('data-router')
    expect(render(routed(''), <Link to="/">Home</Link>)).toContain('data-router')
  })
})

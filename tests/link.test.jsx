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

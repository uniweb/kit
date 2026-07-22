import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SafeHtml } from '../src/components/SafeHtml/SafeHtml.jsx'

/**
 * SafeHtml renders an HTML string with authored-href resolution.
 *
 * It used to consult a runtime-supplied `routingComponents.SafeHtml` first,
 * described as handling sanitization. Nothing ever registered one, so the
 * branch never ran and the fallback was always what shipped. It was removed
 * rather than kept as a placeholder: a hook that promises sanitization and
 * never fires is worse than none, and if a real requirement appears it will
 * decide its own shape (see the three plausible sources in the module note).
 */

function withWebsite(website, fn) {
  const prev = globalThis.uniweb
  globalThis.uniweb = { activeWebsite: website, routingComponents: {} }
  try {
    return fn()
  } finally {
    globalThis.uniweb = prev
  }
}

const website = {
  basePath: '/docs',
  makeHref: (h) => (h === 'page:about' ? '/about' : h),
  hasMultipleLocales: () => false,
  localize: (m) => m?.en ?? '',
  getRoutingComponents: () => ({}),
}

const render = (el) => withWebsite(website, () => renderToStaticMarkup(el))

describe('SafeHtml', () => {
  it('renders the html into the requested element', () => {
    expect(render(<SafeHtml value="<p>Hello <strong>World</strong></p>" as="div" />)).toBe(
      '<div><p>Hello <strong>World</strong></p></div>',
    )
  })

  it('resolves page: references and applies the base path', () => {
    expect(render(<SafeHtml value='<a href="page:about">About</a>' as="span" />)).toBe(
      '<span><a href="/docs/about">About</a></span>',
    )
  })

  it('joins an array of html strings', () => {
    expect(render(<SafeHtml value={['<b>a</b>', '<i>b</i>']} as="span" />)).toBe(
      '<span><b>a</b><i>b</i></span>',
    )
  })

  it('renders nothing for empty input', () => {
    expect(render(<SafeHtml value="" as="span" />)).toBe('<span></span>')
  })

  it('forwards className and arbitrary props', () => {
    const out = render(<SafeHtml value="<b>x</b>" as="span" className="c" id="i" />)

    expect(out).toContain('class="c"')
    expect(out).toContain('id="i"')
  })
})

/**
 * A link back to the page the visitor came from steps back to it, and is an ordinary link
 * otherwise — `<Link back>`, `useGoBack`, `src/utils/go-back.js`. Only the click differs.
 *
 * The step before is the browser's to say (`navigation.entries()`), so these stub it: jsdom has no
 * Navigation API, which is also the case of a browser without one.
 *
 * @vitest-environment jsdom
 */

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { Link } from '../src/components/Link/Link.jsx'
import { useGoBack } from '../src/hooks/useGoBack.js'
import { cameFrom, previousPage } from '../src/utils/go-back.js'

const ORIGIN = window.location.origin

/** The tab's history, oldest first; the last is where the visitor is. Traversals are recorded by key. */
const traversed = []
function visited(...paths) {
  const entries = paths.map((path, index) => ({ url: /^https?:/.test(path) ? path : ORIGIN + path, index, key: `key-${index}` }))
  window.navigation = {
    entries: () => entries,
    currentEntry: entries.at(-1),
    traverseTo: (key) => {
      traversed.push(key)
      return { committed: Promise.resolve(), finished: Promise.resolve() }
    },
  }
}

const navigated = []
function site({ basePath = '', redirects = {} } = {}) {
  const website = {
    basePath,
    resolveRoute: (path) => (redirects[path] ? { kind: 'redirect', location: redirects[path] } : { kind: 'page' }),
    makeHref: (href) => (href === 'page:store' ? '/store' : href),
    hasMultipleLocales: () => false,
    getActiveLocale: () => 'en',
    getDefaultLocale: () => 'en',
    localize: (v) => v,
    getRoutingComponents: () => ({}),
  }
  globalThis.uniweb = { activeWebsite: website, routingComponents: { useNavigate: () => (to) => navigated.push(to) } }
  return website
}

// Whether the link had prevented the browser's own navigation by the time the click reached the
// document — then prevented, since jsdom cannot follow a link.
const prevented = []
const followLinks = (event) => {
  prevented.push(event.defaultPrevented)
  event.preventDefault()
}

let back
beforeEach(() => {
  navigated.length = 0
  prevented.length = 0
  traversed.length = 0
  // `history.back()` steps the whole tab, frames included; nothing here may call it.
  back = vi.spyOn(window.history, 'back').mockImplementation(() => {})
  document.addEventListener('click', followLinks)
})
afterEach(() => {
  cleanup()
  document.removeEventListener('click', followLinks)
  delete window.navigation
  delete globalThis.uniweb
  vi.restoreAllMocks()
})

describe('cameFrom — the step before is the page', () => {
  it('is the page the visitor was on just before', () => {
    const website = site()
    visited('/store', '/store/courses')
    expect(cameFrom('/store', website)).toBe(true)
    expect(cameFrom('/about', website)).toBe(false)
  })

  it('compares paths alone: a query, a fragment and a trailing slash are the same page', () => {
    const website = site()
    visited('/store/?category=education#grid', '/store/courses')
    expect(cameFrom('/store', website)).toBe(true)
    expect(cameFrom('/store?other=1', website)).toBe(true)
  })

  it('reads the path under the base path, as a route', () => {
    const website = site({ basePath: '/shop' })
    visited('/shop/store', '/shop/store/courses')
    expect(previousPage(website)).toEqual({ path: '/store', key: 'key-0' })
    expect(cameFrom('/store', website)).toBe(true)
  })

  it('CONTROL — an address outside the base path is not a page of this site', () => {
    // Another app on the same origin, at /store; this site lives at /shop.
    const website = site({ basePath: '/shop' })
    visited('/store', '/shop/store/courses')
    expect(previousPage(website)).toBeNull()
    expect(cameFrom('/store', website)).toBe(false)
  })

  it('⭐ a route that redirects is the page it leads to: a folder to its first page', () => {
    // The visitor opened /solutions, which has no content of its own, and landed on its first page.
    const website = site({ redirects: { '/solutions': '/solutions/overview' } })
    visited('/solutions/overview', '/solutions/overview/courses')
    expect(cameFrom('/solutions', website)).toBe(true)
    // CONTROL: the folder's own path is not where anyone stood
    expect(cameFrom('/solutions', site())).toBe(false)
  })

  it('⭐ is the page before, past steps within this page — a link to one of its sections', () => {
    const website = site()
    visited('/store', '/store/courses', '/store/courses#pricing', '/store/courses#faq')
    expect(previousPage(website)).toEqual({ path: '/store', key: 'key-0' })
    expect(cameFrom('/store', website)).toBe(true)
  })

  it('an address in another alphabet is the same page, encoded or not', () => {
    const website = site()
    visited('/caf%C3%A9', '/caf%C3%A9/menu')
    expect(cameFrom('/café', website)).toBe(true)
  })

  it.each([
    ['a page opened directly, with no step before', () => visited('/store/courses')],
    ['a step before on another site', () => visited('https://search.example/q', '/store/courses')],
    ['a browser that cannot say', () => {}],
  ])('CONTROL — not: %s', (_, history) => {
    const website = site()
    history()
    expect(cameFrom('/store', website)).toBe(false)
  })
})

describe('<Link back>', () => {
  it('renders as the link does without it — the prerender and the browser agree', () => {
    site()
    expect(renderToStaticMarkup(<Link to="/store" back>All solutions</Link>))
      .toBe(renderToStaticMarkup(<Link to="/store">All solutions</Link>))
  })

  it('⭐ steps back to the page the visitor came from, rather than opening it at the top', () => {
    site()
    visited('/store', '/store/courses')
    const { getByText } = render(<Link to="/store" back>All solutions</Link>)
    fireEvent.click(getByText('All solutions'))
    expect(traversed).toEqual(['key-0'])
    expect(prevented).toEqual([true]) // the browser's own navigation is not followed
  })

  it('⭐ steps to the entry it checked, never the whole tab back — a frame may have taken a step', () => {
    site()
    visited('/', '/store', '/store/courses#team', '/store/courses')
    const { getByText } = render(<Link to="/store" back>All solutions</Link>)
    fireEvent.click(getByText('All solutions'))
    expect(traversed).toEqual(['key-1'])
    expect(back).not.toHaveBeenCalled()
  })

  it('a traversal another navigation interrupts says nothing', async () => {
    site()
    visited('/store', '/store/courses')
    window.navigation.traverseTo = () => ({
      committed: Promise.reject(new DOMException('interrupted', 'AbortError')),
      finished: Promise.reject(new DOMException('interrupted', 'AbortError')),
    })
    const { getByText } = render(<Link to="/store" back>All solutions</Link>)
    fireEvent.click(getByText('All solutions'))
    // An unhandled rejection would fail the run.
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(prevented).toEqual([true])
  })

  it('resolves a page: reference first', () => {
    site()
    visited('/store', '/store/courses')
    const { getByText } = render(<Link to="page:store" back>All solutions</Link>)
    fireEvent.click(getByText('All solutions'))
    expect(traversed).toEqual(['key-0'])
  })

  it.each([
    ['the visitor came from elsewhere', () => visited('/', '/store/courses'), {}],
    ['a key is held, for a new tab', () => visited('/store', '/store/courses'), { metaKey: true }],
    ['another button', () => visited('/store', '/store/courses'), { button: 1 }],
  ])('is an ordinary link when %s', (_, history, init) => {
    site()
    history()
    const { getByText } = render(<Link to="/store" back>All solutions</Link>)
    fireEvent.click(getByText('All solutions'), init)
    expect(traversed).toEqual([])
    expect(prevented).toEqual([false])
  })

  it("CONTROL — without `back`, the link is a link, whatever the step before", () => {
    site()
    visited('/store', '/store/courses')
    const { getByText } = render(<Link to="/store">All solutions</Link>)
    fireEvent.click(getByText('All solutions'))
    expect(traversed).toEqual([])
  })

  it("calls the caller's onClick first, and a click it prevents goes nowhere", () => {
    site()
    visited('/store', '/store/courses')
    const seen = []
    const { getByText } = render(
      <>
        <Link to="/store" back onClick={() => seen.push('a')}>A</Link>
        <Link to="/store" back onClick={(e) => e.preventDefault()}>B</Link>
      </>
    )
    fireEvent.click(getByText('A'))
    expect(seen).toEqual(['a'])
    expect(traversed).toEqual(['key-0'])
    fireEvent.click(getByText('B'))
    expect(traversed).toEqual(['key-0'])
  })

  it('a link that opens another tab is what it says', () => {
    site()
    visited('/store', '/store/courses')
    const { getByText } = render(<Link to="/store" back target="_blank">All solutions</Link>)
    fireEvent.click(getByText('All solutions'))
    expect(traversed).toEqual([])
  })
})

describe('useGoBack — for a button', () => {
  function Close({ to }) {
    const close = useGoBack(to)
    return <button onClick={close}>Close</button>
  }

  it('steps back when the visitor came from the page', () => {
    site()
    visited('/store', '/store/courses')
    const { getByText } = render(<Close to="/store" />)
    fireEvent.click(getByText('Close'))
    expect(traversed).toEqual(['key-0'])
    expect(navigated).toEqual([])
  })

  it('goes to the page otherwise, as a link would', () => {
    site()
    visited('/store/courses')
    const { getByText } = render(<Close to="page:store" />)
    fireEvent.click(getByText('Close'))
    expect(traversed).toEqual([])
    expect(navigated).toEqual(['/store'])
  })
})

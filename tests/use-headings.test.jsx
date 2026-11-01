/**
 * @vitest-environment jsdom
 *
 * `useHeadings` — which heading is marked, read in the browser's own order: the runtime measures the
 * header in the effect of the layout around the rail, and a parent's effect runs after its children's.
 *
 * The page here is a table of positions, since jsdom lays nothing out. What a browser does with them
 * is measured by hand on a real page; these hold the rules.
 */

import { act, render } from '@testing-library/react'
import { useEffect } from 'react'
import { useHeadings, headingAt } from '../src/hooks/useHeadings.js'

vi.mock('../src/hooks/useWebsite.js', () => ({ useWebsite: () => ({ website: { activePage: globalThis.__page } }) }))
vi.mock('../src/hooks/useActiveRoute.js', () => ({ useActiveRoute: () => ({ route: globalThis.__route }) }))

const heading = (text) => ({ type: 'heading', level: 2, text })

/** A page whose headings sit at these distances from its top, and which can scroll `room` far. */
function layOut(tops, room) {
  document.body.innerHTML = ''
  for (const [id, top] of Object.entries(tops)) {
    const el = document.createElement('h2')
    el.id = id
    el.getBoundingClientRect = () => ({ top: top - window.scrollY })
    document.body.appendChild(el)
  }
  Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: room + window.innerHeight })
  globalThis.__page = {
    getBodyBlocks: () => [{ parsedContent: { sequence: Object.keys(tops).map(heading) } }],
  }
}

/** `window.scrollTo` and a scroll event, as a browser's would be once the page has moved. */
function scrollPageTo(y) {
  act(() => {
    window.scrollY = y
    window.dispatchEvent(new Event('scroll'))
  })
}

/** The page stands still long enough to count as at rest. */
const pageRests = () => act(() => vi.advanceTimersByTime(1000))

let frames = []
const nextFrame = () =>
  act(() => {
    const due = frames
    frames = []
    due.forEach((run) => run())
  })

beforeEach(() => {
  frames = []
  vi.useFakeTimers()
  globalThis.__route = 'docs/install'
  window.scrollY = 0
  window.innerHeight = 800
  window.location.hash = ''
  window.scrollTo = vi.fn()
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((run) => frames.push(run))
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.documentElement.style.removeProperty('--uw-sticky-top')
  delete globalThis.__page
  delete globalThis.__route
})

/** The rail inside a layout that measures its header as the runtime's does: in its own effect. */
function Rail({ onRead, header = '65px' }) {
  function Inner() {
    onRead(useHeadings())
    return null
  }
  function Layout() {
    useEffect(() => {
      document.documentElement.style.setProperty('--uw-sticky-top', header)
      return () => document.documentElement.style.removeProperty('--uw-sticky-top')
    }, [])
    return <Inner />
  }
  return <Layout />
}

function mountRail() {
  const read = {}
  const view = render(<Rail onRead={(value) => Object.assign(read, value)} />)
  nextFrame()
  return { read, view }
}

describe('the line under the header', () => {
  const tops = { homebrew: 100, windows: 700, manual: 1100, npm: 1400, later: 1600 }

  it('uses the header the layout measured after this hook mounted', () => {
    layOut(tops, 5000)
    const { read } = mountRail()
    expect(read.activeId).toBe('homebrew')

    // 65 + 16 + 4 under the window's top: the heading counts at 85px and not at 86.
    scrollPageTo(700 - 86)
    expect(read.activeId).toBe('homebrew')
    scrollPageTo(700 - 85)
    expect(read.activeId).toBe('windows')
  })

  it('follows the header when it changes size', () => {
    layOut(tops, 5000)
    const { read } = mountRail()
    document.documentElement.style.setProperty('--uw-sticky-top', '165px')
    scrollPageTo(700 - 185)
    expect(read.activeId).toBe('windows')
  })

  it('marks the heading a page is already at, on the first frame, with nothing scrolled', () => {
    layOut(tops, 5000)
    window.scrollY = 700 - 81
    const { read } = mountRail()
    expect(read.activeId).toBe('windows')
  })

  it('reads the header again on the next page, which the layout measures again', () => {
    layOut(tops, 5000)
    const { read, view } = mountRail()
    scrollPageTo(0)

    // The layout's effect removes the variable and sets it again around this hook's, on each page.
    layOut({ overview: 100, usage: 700 }, 5000)
    globalThis.__route = 'docs/other'
    document.documentElement.style.removeProperty('--uw-sticky-top')
    view.rerender(<Rail onRead={(value) => Object.assign(read, value)} />)
    document.documentElement.style.setProperty('--uw-sticky-top', '65px')
    nextFrame()
    scrollPageTo(700 - 85)
    expect(read.activeId).toBe('usage')
  })
})

describe('a heading the reader asked for', () => {
  const tops = { homebrew: 100, windows: 700, manual: 1100, npm: 1300, later: 1500 }
  const room = 1000 // the page ends with `npm` and `later` still below the line

  it('is marked at once, and stays marked on the way there', () => {
    layOut(tops, room)
    const { read } = mountRail()

    act(() => read.scrollTo('manual'))
    expect(read.activeId).toBe('manual')
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 1100 - 81, behavior: 'smooth' })

    // Passing `windows` on the way leaves it alone.
    scrollPageTo(300)
    scrollPageTo(620)
    expect(read.activeId).toBe('manual')
  })

  it('stays marked where a page that ends early leaves it, short of the line', () => {
    layOut(tops, room)
    const { read } = mountRail()

    act(() => read.scrollTo('npm'))
    scrollPageTo(room)
    pageRests()
    expect(read.activeId).toBe('npm')

    // `manual` lands at the page's end too, so the page has nowhere to go and nothing scrolls.
    act(() => read.scrollTo('manual'))
    pageRests()
    expect(read.activeId).toBe('manual')
  })

  it('stays marked wherever the page comes to rest, which is the browser\'s to say', () => {
    // A heading's own scroll margin, or content filling in, moves the landing a few pixels.
    layOut(tops, room)
    const { read } = mountRail()

    act(() => read.scrollTo('windows'))
    scrollPageTo(500)
    scrollPageTo(617)
    scrollPageTo(615)
    pageRests()
    expect(read.activeId).toBe('windows')
    scrollPageTo(616)
    expect(read.activeId).toBe('windows')
  })

  it('lets go once the page moves on from where it came to rest', () => {
    layOut(tops, room)
    const { read } = mountRail()

    act(() => read.scrollTo('windows'))
    scrollPageTo(700 - 81)
    pageRests()
    expect(read.activeId).toBe('windows')

    scrollPageTo(700 - 81 - 300)
    expect(read.activeId).toBe('homebrew')
  })

  it('lets go a pixel at a time too, for a slow scroll that never moves far at once', () => {
    layOut(tops, room)
    const { read } = mountRail()

    act(() => read.scrollTo('windows'))
    scrollPageTo(700 - 81)
    pageRests()
    for (let y = 700 - 82; y > 300; y--) scrollPageTo(y)
    expect(read.activeId).toBe('homebrew')
  })

  it('lets go when a page that never scrolled is then moved', () => {
    layOut(tops, room)
    const { read } = mountRail()

    act(() => read.scrollTo('homebrew'))
    pageRests()
    scrollPageTo(700 - 81)
    expect(read.activeId).toBe('windows')
  })

  it('is forgotten on the next page', () => {
    layOut(tops, room)
    const { read, view } = mountRail()
    act(() => read.scrollTo('manual'))

    layOut({ overview: 100, usage: 700 }, 5000)
    globalThis.__route = 'docs/other'
    view.rerender(<Rail onRead={(value) => Object.assign(read, value)} />)
    nextFrame()
    expect(read.activeId).toBe('overview')
  })

  it('counts when the address named it', () => {
    layOut(tops, room)
    window.scrollY = room
    window.location.hash = '#npm'
    const { read } = mountRail()
    expect(read.activeId).toBe('npm')

    // The browser and the runtime are still settling the page.
    scrollPageTo(room - 30)
    pageRests()
    expect(read.activeId).toBe('npm')
    scrollPageTo(0)
    expect(read.activeId).toBe('homebrew')
  })

  it('counts when the address named it in another alphabet, as the browser encodes it', () => {
    layOut({ 'démarrer': 100, 'été-2026': 900, 'réglages': 1100 }, 500)
    window.scrollY = 500
    window.location.hash = '#été-2026'
    expect(window.location.hash).toBe('#%C3%A9t%C3%A9-2026')
    const { read } = mountRail()
    expect(read.activeId).toBe('été-2026')
  })

  it('ignores an address naming something that is no heading', () => {
    layOut(tops, room)
    window.location.hash = '#section-3'
    const { read } = mountRail()
    expect(read.activeId).toBe('homebrew')
  })
})

it('marks a page reached with the same headings as the last one', () => {
  layOut({ overview: 100, usage: 700 }, 5000)
  const { read, view } = mountRail()
  scrollPageTo(700 - 81)
  expect(read.activeId).toBe('usage')

  // The first effect clears the mark on a new route; nothing scrolls on a page already at the top.
  window.scrollY = 0
  globalThis.__route = 'docs/other'
  view.rerender(<Rail onRead={(value) => Object.assign(read, value)} />)
  nextFrame()
  expect(read.activeId).toBe('overview')
})

describe('headingAt', () => {
  const at = (positions, scrollY, room, gap = 81) => headingAt(positions, { scrollY, room, gap })
  const list = (...tops) => tops.map((top, i) => ({ id: `h${i}`, top }))

  it('is the first heading until one has come up', () => {
    expect(at(list(500, 900), 0, 5000)).toBe('h0')
  })

  it('is the last to have come up, on a page with room to bring them all up', () => {
    const positions = list(500, 900, 1300)
    expect(at(positions, 400, 5000)).toBe('h0')
    expect(at(positions, 1300 - 85, 5000)).toBe('h2')
  })

  it('gives each of the last headings its turn, in order, on a page that ends early', () => {
    // The last can get no higher than 381: the line comes down to it over the last 300px.
    const positions = list(100, 600, 900, 1100, 1381)
    const room = 1000
    const seen = []
    for (let y = 0; y <= room; y += 5) {
      const id = at(positions, y, room)
      if (seen[seen.length - 1] !== id) seen.push(id)
    }
    expect(seen).toEqual(['h0', 'h1', 'h2', 'h3', 'h4'])
    expect(at(positions, room, room)).toBe('h4')
  })

  it('leaves the line alone until that last stretch', () => {
    // The stretch starts 300px from the end, at 700, with the line still 85px below the window's top.
    const positions = list(100, 785, 1381)
    expect(at(positions, 699, 1000)).toBe('h0')
    expect(at(positions, 700, 1000)).toBe('h1')
    expect(at(list(100, 786, 1381), 700, 1000)).toBe('h0')
  })

  it('does not reach past the last heading, on a page where it comes up by itself', () => {
    const positions = list(100, 1000)
    expect(at(positions, 800, 5000)).toBe('h0')
    expect(at(positions, 915, 5000)).toBe('h1')
  })

  it('stays on the first heading of a page that cannot scroll', () => {
    expect(at(list(200, 400, 600), 0, 0)).toBe('h0')
  })

  it('shares out a small room among the headings below it', () => {
    const positions = list(200, 400, 600)
    expect(at(positions, 0, 50)).toBe('h0')
    expect(at(positions, 50, 50)).toBe('h2')
  })

  it('has nothing to say with no headings', () => {
    expect(at([], 0, 100)).toBe('')
  })
})

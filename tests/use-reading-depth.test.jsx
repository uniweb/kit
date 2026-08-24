/**
 * @vitest-environment jsdom
 *
 * `useReadingDepth` — depth through ONE element, not through the page.
 *
 * The distinction is the reason the hook exists, so it is asserted directly:
 * the same scroll position must produce different numbers for two elements of
 * different sizes on one page.
 */

import { renderHook, act } from '@testing-library/react'
import { useRef } from 'react'
import { useReadingDepth } from '../src/hooks/useReadingDepth.js'

/** An element whose box we control, standing in for a rendered section. */
function elementWithBox({ top, height }) {
  const el = document.createElement('div')
  el.getBoundingClientRect = () => ({ top, height, bottom: top + height })
  return el
}

function setup({ top, height, tracking, block }) {
  globalThis.uniweb = { tracking }
  window.innerHeight = 800
  const el = elementWithBox({ top, height })
  const view = renderHook(() => {
    const ref = useRef(el)
    useReadingDepth({ ref, block })
  })
  return { el, view }
}

const enabledTracker = () => {
  const sent = []
  return { sent, isEnabled: () => true, track: (event, data) => sent.push({ event, data }) }
}

// The hook throttles at 200ms, so a scripted scroll lands inside the window of
// the check it does at mount. A controlled clock is the only way to assert the
// second reading at all — with the real one, this test would pass by measuring
// nothing and look identical to a working hook.
// Starts far from zero on purpose: the hook's `lastCheck` begins at 0, so a
// clock that also began at 0 would throttle away the check it does at mount —
// and four of these tests would fail for a reason that has nothing to do with
// what they assert.
let now = 1_000_000
beforeEach(() => {
  now = 1_000_000
  vi.spyOn(Date, 'now').mockImplementation(() => now)
})

/** Move past the throttle window, then fire the event. */
const scrollPast = (fn) => {
  now += 1000
  act(fn)
}

afterEach(() => {
  vi.restoreAllMocks()
  delete globalThis.uniweb
})

describe('useReadingDepth', () => {
  it('reports nothing for an element still below the fold', () => {
    const tracking = enabledTracker()
    setup({ top: 900, height: 2000, tracking })
    expect(tracking.sent).toHaveLength(0)
  })

  it('reports every milestone for an element already fully read', () => {
    const tracking = enabledTracker()
    // Bottom at 700, above the 800px fold — all of it has been on screen.
    setup({ top: -1300, height: 2000, tracking })
    expect(tracking.sent.map((s) => s.data.depth)).toEqual([25, 50, 75, 100])
    expect(tracking.sent[0].event).toBe('read_depth')
  })

  // ⭐ The property that separates this from page scroll depth: the number is a
  // function of THIS element's box, so two sections at one scroll position
  // report differently and neither moves when the other changes.
  it('measures the element, not the page', () => {
    const short = enabledTracker()
    const long = enabledTracker()
    setup({ top: 0, height: 800, tracking: short })
    setup({ top: 0, height: 4000, tracking: long })
    expect(short.sent.map((s) => s.data.depth)).toEqual([25, 50, 75, 100])
    expect(long.sent.map((s) => s.data.depth)).toEqual([])
  })

  // ⛔ The question a consumer of this event has to ask about the rewrite: the
  // RETIRED page-level hook returned 100 whenever the document
  // was shorter than the viewport — unconditionally, at mount, because a page
  // with nothing to scroll has no scroll depth. This one measures an element, so
  // "shorter than the viewport" is no longer sufficient: the element also has to
  // be ON SCREEN. Both halves are asserted, because only the pair shows the
  // behaviour is position-dependent where the old one was not.
  it('emits all four at mount for a short element that is already fully visible', () => {
    const tracking = enabledTracker()
    // 300px tall, sitting at 100 — bottom at 400, well inside the 800px fold.
    setup({ top: 100, height: 300, tracking })
    expect(tracking.sent.map((s) => s.data.depth)).toEqual([25, 50, 75, 100])
  })

  it('emits NOTHING at mount for an equally short element below the fold', () => {
    const tracking = enabledTracker()
    const { el } = setup({ top: 900, height: 300, tracking })
    expect(tracking.sent).toHaveLength(0)

    // …and all four the moment it is fully on screen. So for a short section
    // `100` means "it was entirely in the viewport", never "it was read".
    el.getBoundingClientRect = () => ({ top: 400, height: 300, bottom: 700 })
    scrollPast(() => window.dispatchEvent(new Event('scroll')))
    expect(tracking.sent.map((s) => s.data.depth)).toEqual([25, 50, 75, 100])
  })

  // ⭐ The consumer-facing consequence: `100` is not one claim. A section TALLER
  // than the viewport reaches it only once its bottom edge arrives, i.e. the
  // visitor scrolled through the whole thing; a SHORTER one reaches it without
  // any scrolling through it at all. Same milestone, two meanings, decided by a
  // ratio the collector cannot see.
  it('reaches 100 only at the bottom edge for an element taller than the viewport', () => {
    const tracking = enabledTracker()
    const { el } = setup({ top: 0, height: 2000, tracking })
    expect(tracking.sent.map((s) => s.data.depth)).toEqual([25])

    // Bottom still below the fold at 900 — not yet 100.
    el.getBoundingClientRect = () => ({ top: -1100, height: 2000, bottom: 900 })
    scrollPast(() => window.dispatchEvent(new Event('scroll')))
    expect(tracking.sent.map((s) => s.data.depth)).toEqual([25, 50, 75])

    // Bottom reaches the fold — now, and only now, 100.
    el.getBoundingClientRect = () => ({ top: -1200, height: 2000, bottom: 800 })
    scrollPast(() => window.dispatchEvent(new Event('scroll')))
    expect(tracking.sent.map((s) => s.data.depth)).toEqual([25, 50, 75, 100])
  })

  // Hosting stamps `exactness.scroll_milestones = 'cumulative'` on the strength
  // of this: one pass reports EVERY milestone at or below the depth reached, so
  // n(25) >= n(50) >= n(75) >= n(100) holds by construction. Asserted here so
  // the guarantee has a home in the emitter, not only in the collector's doc.
  it('reports every milestone at or below the depth reached, in one pass', () => {
    const tracking = enabledTracker()
    // seen = 800 - (-1000) = 1800 of 2400 = depth 75, with 25 and 50 never
    // having been reported by an earlier check.
    setup({ top: -1000, height: 2400, tracking })
    expect(tracking.sent.map((s) => s.data.depth)).toEqual([25, 50, 75])
  })

  it('reports each milestone once as the reader descends', () => {
    const tracking = enabledTracker()
    const { el } = setup({ top: 0, height: 1600, tracking })
    expect(tracking.sent.map((s) => s.data.depth)).toEqual([25, 50])

    el.getBoundingClientRect = () => ({ top: -400, height: 1600, bottom: 1200 })
    scrollPast(() => window.dispatchEvent(new Event('scroll')))
    expect(tracking.sent.map((s) => s.data.depth)).toEqual([25, 50, 75])
  })

  // The block carries `section`, `section_id` and `path`, so an article's depth
  // is attributable to the section it was read in.
  it('reports through the block when one is supplied', () => {
    const tracking = enabledTracker()
    const calls = []
    setup({
      top: -1300,
      height: 2000,
      tracking,
      block: { track: (event, data) => calls.push({ event, data }) }
    })
    expect(calls).toHaveLength(4)
    expect(tracking.sent).toHaveLength(0)
  })

  // The listener must not attach at all — the calls would be no-ops, but the
  // handler would still run on every scroll frame of an unconfigured site.
  it('attaches nothing when the site has no tracking destination', () => {
    const spy = vi.spyOn(window, 'addEventListener')
    setup({ top: 0, height: 1600, tracking: { isEnabled: () => false, track: () => {} } })
    expect(spy.mock.calls.filter(([type]) => type === 'scroll')).toHaveLength(0)
    spy.mockRestore()
  })

  it('detaches on unmount', () => {
    const tracking = enabledTracker()
    const { view } = setup({ top: 900, height: 2000, tracking })
    view.unmount()
    scrollPast(() => window.dispatchEvent(new Event('scroll')))
    expect(tracking.sent).toHaveLength(0)
  })
})

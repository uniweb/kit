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

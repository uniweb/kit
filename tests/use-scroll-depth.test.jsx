/**
 * @vitest-environment jsdom
 *
 * useScrollDepth() promises "25 / 50 / 75 / 100, once each **per page**".
 *
 * The milestone set lives in a ref, so that promise depends entirely on the
 * effect re-running when the route changes. Without it the set is cleared once
 * at mount and every page after the first reports nothing — and the failure is
 * silent, because reporting nothing is also what a correctly-configured site
 * with no scrolling looks like.
 *
 * ⭐ It bites precisely where the hook is most naturally called: **once, in a
 * layout component**, which persists across SPA navigation. Calling it in every
 * section would have hidden it and multiplied the events instead.
 */

import { renderHook } from '@testing-library/react'
import { useScrollDepth } from '../src/hooks/useScrollDepth.js'

let previousUniweb
let pathname
let track

beforeEach(() => {
  previousUniweb = globalThis.uniweb
  pathname = '/first'
  track = vi.fn()
  globalThis.uniweb = {
    tracking: { isEnabled: () => true, track },
    routingComponents: { useLocation: () => ({ pathname }) }
  }
})

afterEach(() => {
  globalThis.uniweb = previousUniweb
})

/**
 * jsdom reports a zero-height document, so `getScrollDepth()` returns 100 and
 * the immediate check at effect setup reports every milestone. That makes this
 * testable without simulating a scroll — the question here is *when the set is
 * cleared*, not how depth is computed.
 */
const milestones = () => track.mock.calls.map((c) => c[1].depth)

describe('useScrollDepth — per page, not per document', () => {
  it('reports every milestone on the first page', () => {
    renderHook(() => useScrollDepth())
    expect(milestones()).toEqual([25, 50, 75, 100])
  })

  it('reports again after a route change', () => {
    const { rerender } = renderHook(() => useScrollDepth())
    expect(milestones()).toHaveLength(4)

    pathname = '/second'
    rerender()

    // 8, not 4: the second page is its own page. Before the path was in the
    // effect's deps this stayed at 4 — the ref survived and silently suppressed
    // every later page.
    expect(milestones()).toHaveLength(8)
    expect(track.mock.calls.slice(4).map((c) => c[1].depth)).toEqual([25, 50, 75, 100])
  })

  it('does not re-report on a re-render that is not a navigation', () => {
    const { rerender } = renderHook(() => useScrollDepth())
    rerender()
    rerender()

    expect(milestones()).toHaveLength(4)
  })

  it('reports nothing, and arms nothing, when there is nowhere to send', () => {
    globalThis.uniweb.tracking = { isEnabled: () => false, track }
    renderHook(() => useScrollDepth())

    expect(track).not.toHaveBeenCalled()
  })

  it('is inert when disabled, even across a navigation', () => {
    const { rerender } = renderHook(() => useScrollDepth({ enabled: false }))
    pathname = '/second'
    rerender()

    expect(track).not.toHaveBeenCalled()
  })
})

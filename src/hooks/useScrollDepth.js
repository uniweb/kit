/**
 * useScrollDepth — report how far down the page a visitor got.
 *
 * ```jsx
 * useScrollDepth()                       // 25 / 50 / 75 / 100, once each per page
 * ```
 *
 * ⭐ **Opt-in, and in kit rather than the runtime, on purpose.** The runtime
 * auto-emits only what requires runtime privilege — a page view needs the
 * router, so nothing else can emit it. Scroll depth needs nothing but the
 * window, so it is a foundation's choice and lives where tree-shaking can drop
 * it for the foundations that never call it.
 *
 * *(It previously lived in `@uniweb/runtime` as an unexported, unreachable file
 * that reported to a metric baked into the transport. The milestones are now an
 * ordinary event, which is both smaller and more general.)*
 *
 * ⛔ **No guard is needed.** With no tracking destination the report is a
 * silent no-op — but the scroll listener is skipped too, so an unconfigured
 * site pays nothing for the call.
 *
 * @module @uniweb/kit/hooks/useScrollDepth
 */

import { useEffect, useRef } from 'react'
import { getUniweb } from '@uniweb/core'
import { useRouting } from './useRouting.js'

const MILESTONES = [25, 50, 75, 100]

/** @returns {number} 0-100; 100 when the page fits in the viewport */
function getScrollDepth() {
  const scrollTop = window.scrollY
  const docHeight = document.documentElement.scrollHeight - window.innerHeight
  if (docHeight <= 0) return 100
  return Math.min(100, Math.round((scrollTop / docHeight) * 100))
}

/**
 * @param {Object} [options]
 * @param {boolean} [options.enabled=true]
 * @param {number} [options.throttleMs=200]
 * @param {string} [options.event='scroll_depth'] - override the event name
 */
export function useScrollDepth(options = {}) {
  const { enabled = true, throttleMs = 200, event = 'scroll_depth' } = options

  const lastCheck = useRef(0)
  const reported = useRef(new Set())

  // ⛔ **Keyed on the path, or "once each per page" is not true.** The milestone
  // set lives in a ref, so without this the effect runs once at mount and the
  // set is never cleared again — a second page reports nothing at all. That bites
  // exactly where this hook is most naturally called: once, in a layout
  // component, which persists across SPA navigation (`PageRenderer` does not
  // remount — the router declares a single catch-all route). Calling it in every
  // section would have hidden the bug and multiplied the events instead.
  //
  // ⭐ `pathname` rather than a route object, deliberately: it is the same
  // boundary `usePageView` emits on, so a `scroll_depth` always pairs with the
  // `page_view` it belongs to. `useRouting` returns a default location when there
  // is no Router, so this stays SSG-safe.
  const { useLocation } = useRouting()
  const { pathname } = useLocation()

  useEffect(() => {
    const tracking = getUniweb()?.tracking
    // Skip the listener entirely when there is nowhere to report — the calls
    // would be no-ops, but the scroll handler would still run on every frame.
    if (!enabled || !tracking?.isEnabled?.()) return

    reported.current.clear()
    // Reset the throttle too: a navigation within the throttle window would
    // otherwise make the immediate check below return early and miss the fold.
    lastCheck.current = 0

    const handleScroll = () => {
      const now = Date.now()
      if (now - lastCheck.current < throttleMs) return
      lastCheck.current = now

      const depth = getScrollDepth()
      for (const milestone of MILESTONES) {
        if (depth >= milestone && !reported.current.has(milestone)) {
          reported.current.add(milestone)
          tracking.track(event, { depth: milestone })
        }
      }
    }

    handleScroll() // a page that fits the viewport is already at 100
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [enabled, throttleMs, event, pathname])
}

export default useScrollDepth

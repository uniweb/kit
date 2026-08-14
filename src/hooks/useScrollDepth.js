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

  useEffect(() => {
    const tracking = getUniweb()?.tracking
    // Skip the listener entirely when there is nowhere to report — the calls
    // would be no-ops, but the scroll handler would still run on every frame.
    if (!enabled || !tracking?.isEnabled?.()) return

    reported.current.clear()

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
  }, [enabled, throttleMs, event])
}

export default useScrollDepth

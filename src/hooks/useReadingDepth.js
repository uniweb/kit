/**
 * useReadingDepth — how far through ONE long section a visitor actually read.
 *
 * ```jsx
 * export default function Article({ content, block }) {
 *   const ref = useRef(null)
 *   useReadingDepth({ ref, block })
 *   return <article ref={ref}>{…}</article>
 * }
 * ```
 *
 * ⭐ **Why this is kit's and not the runtime's.** The runtime emits what the
 * SITE OWNER buys — it cannot know that one section is five thousand words of
 * prose and another is a row of logos. **Only the foundation knows a section is
 * long-form reading**, which is exactly the criterion for living here: declared
 * by the component that has the knowledge, and tree-shaken to nothing for every
 * foundation that never asks.
 *
 * ⛔ **This is NOT page scroll depth, and the difference is the whole point.**
 * A page-scoped version measures the document, so on a page holding two long
 * articles both would report the same number, and adding any section above
 * silently rebases the series. This measures **the element's own box**, so it
 * keeps meaning the same thing when the page around it changes.
 *
 * ⚖️ **It complements `section_view` rather than duplicating it.** That event
 * fires once, when the section becomes half visible — it says the reader
 * *arrived*. This says how far they got, which for a long article is the only
 * question worth asking.
 *
 * ⛔ **No guard is needed at the call site.** With no tracking destination the
 * report is a silent no-op — and the listener is never attached either, so an
 * unconfigured site pays nothing for the call.
 *
 * @module @uniweb/kit/hooks/useReadingDepth
 */

import { useEffect } from 'react'
import { getUniweb } from '@uniweb/core'

const MILESTONES = [25, 50, 75, 100]
const THROTTLE_MS = 200

/**
 * How far the viewport has advanced through this element, 0-100.
 *
 * Measured against the element's own box: 0 when its top first reaches the
 * bottom of the viewport, 100 once its bottom has. An element shorter than the
 * viewport reports 100 as soon as it is fully on screen, which is correct —
 * there was nothing further to read.
 *
 * ⛔ **So `100` is TWO different claims, and a consumer labelling a panel needs
 * to know which.** Taller than the viewport: the visitor scrolled all the way
 * through it. Shorter: it was entirely on screen, with no scrolling through it
 * at all. The ratio that decides is not on the wire, so a collector cannot tell
 * them apart — and `100` never means *"saw the whole page"*, which is what the
 * retired document-scoped hook's `100` meant. Asserted by three cases in
 * `tests/use-reading-depth.test.jsx`.
 */
function depthOf(el) {
  const rect = el.getBoundingClientRect()
  if (rect.height <= 0) return 0
  const seen = window.innerHeight - rect.top
  return Math.max(0, Math.min(100, Math.round((seen / rect.height) * 100)))
}

/**
 * @param {Object} options
 * @param {{current: HTMLElement|null}} options.ref - the element to measure
 * @param {Object} [options.block] - report through the block, so the section
 *        type, its instance id and the page path ride along for free
 * @param {string} [options.event='read_depth']
 */
export function useReadingDepth({ ref, block, event = 'read_depth' } = {}) {
  useEffect(() => {
    const el = ref?.current
    const tracking = getUniweb()?.tracking
    // ⛔ `isEnabled()`, NOT `arms()`. A foundation's own events are never gated
    // by the site's `tracking.emit` or a host's list — the registry is open, and
    // a client-side allowlist over them would export one collector's policy to
    // every host. `emit` decides what the RUNTIME arms; this is not that.
    if (!el || !tracking?.isEnabled?.()) return

    const reported = new Set()
    let lastCheck = 0

    const report = (depth) => {
      // Prefer the block: it attaches `section`, `section_id` and `path`, so an
      // article's depth is attributable to the section it was read in.
      if (block?.track) block.track(event, { depth })
      else tracking.track(event, { depth })
    }

    const onScroll = () => {
      const now = Date.now()
      if (now - lastCheck < THROTTLE_MS) return
      lastCheck = now

      const depth = depthOf(el)
      for (const milestone of MILESTONES) {
        if (depth >= milestone && !reported.has(milestone)) {
          reported.add(milestone)
          report(milestone)
        }
      }
    }

    onScroll() // an element already fully read at mount reports immediately
    window.addEventListener('scroll', onScroll, { passive: true })
    // Resize changes the element's height and the viewport at once, so a
    // milestone can be crossed without any scrolling at all.
    window.addEventListener('resize', onScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
    // The reported set is a local of this effect, so a re-run IS the reset —
    // no ref to remember to clear, which is how the retired page-level hook
    // shipped a bug where every page after the first reported nothing.
  }, [ref, block, event])
}

export default useReadingDepth

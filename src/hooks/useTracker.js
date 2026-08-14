/**
 * useTracker — report an event from a foundation component.
 *
 * ```jsx
 * const { track } = useTracker()
 * <button onClick={() => track('brochure_download', { file: 'specs.pdf' })}>…</button>
 * ```
 *
 * ⛔ **No guard is needed.** A site with no tracking destination is the default
 * and the majority: the call returns having done nothing, opened no connection
 * and thrown nothing. Absent is the normal state, not an error — so never wrap
 * this in a "is tracking on?" check, and never render differently because of it.
 *
 * ⭐ **Prefer `block.track(name, data)` when you have a block**, which almost
 * every section type does. It attaches the section type and the page path for
 * you. Reach for this hook for events with no block in hand — a site-level
 * control, a layout element, a modal.
 *
 * The event name is yours: the registry is open, and the framework keeps no
 * list of permitted names. What a host does with an event it does not recognise
 * is the host's business.
 *
 * @module @uniweb/kit/hooks/useTracker
 */

import { useCallback } from 'react'
import { getUniweb } from '@uniweb/core'

/**
 * @returns {{ track: (event: string, data?: object) => void }}
 */
export function useTracker() {
  const track = useCallback((event, data = {}) => {
    getUniweb()?.tracking?.track(event, data)
  }, [])

  return { track }
}

export default useTracker

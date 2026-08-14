/**
 * useTrackingConsent — the visitor's decision, for a consent component to set.
 *
 * ```jsx
 * const { status, grant, deny } = useTrackingConsent()
 * if (status !== 'pending') return null          // nothing to ask
 * return <Banner onAccept={grant} onReject={deny} />
 * ```
 *
 * ## ⛔ Why this exists at all
 *
 * Tracking used to arrive as a third-party `<script>`, which consent tooling —
 * banners, browser blockers, CMPs — works by blocking. Emitting from inside the
 * site's own bundle means **none of that can see it**, so a site that was
 * compliant by virtue of its banner would silently stop being so, with no
 * symptom. The framework moved the capability in, so the framework owes the
 * gate.
 *
 * ## Status values
 *
 * - `'pending'` — the site declared `tracking: { consent: required }` and nobody
 *   has answered. Events are **buffered, not sent**; granting flushes them, so
 *   the views before the click are not lost, and denying discards them. Nothing
 *   leaves the device before the decision.
 * - `'granted'` — sending. **This is the default** when a site does not ask for
 *   a consent gate: declaring a destination is itself the operator's decision,
 *   and the framework does not presume a jurisdiction on their behalf.
 * - `'denied'` — nothing is sent and nothing accumulates.
 *
 * ⚖️ **Single-owner assumption.** The status is mirrored into component state so
 * a banner re-renders when it changes; two independent components calling this
 * will not observe each other's grant. Consent is a one-banner concern, so that
 * is the intended shape rather than a limitation to design around.
 *
 * @module @uniweb/kit/hooks/useTrackingConsent
 */

import { useCallback, useState } from 'react'
import { getUniweb } from '@uniweb/core'

function readStatus() {
  return getUniweb()?.tracking?.consentStatus?.() || 'granted'
}

/**
 * @returns {{ status: 'granted'|'denied'|'pending', grant: () => void, deny: () => void }}
 */
export function useTrackingConsent() {
  const [status, setStatus] = useState(readStatus)

  const set = useCallback((granted) => {
    getUniweb()?.tracking?.setConsent(granted)
    // Read back rather than assuming: a tracker with no destination stays
    // 'granted' and never moves, and the banner should not claim otherwise.
    setStatus(readStatus())
  }, [])

  const grant = useCallback(() => set(true), [set])
  const deny = useCallback(() => set(false), [set])

  return { status, grant, deny }
}

export default useTrackingConsent

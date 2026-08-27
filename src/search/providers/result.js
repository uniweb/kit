/**
 * The search result contract.
 *
 * Every provider returns objects of this shape. The point is that a foundation's
 * search UI is written once and works against any provider — the same reason
 * `prepare-props` guarantees a content shape so components need no null checks.
 *
 * Two tiers, and the distinction is load-bearing:
 *
 * - **Guaranteed** — `id`, `type`, `route`, `href`, `title`, `pageTitle`,
 *   `excerpt`, `snippetHtml`. Every provider fills these. A component may
 *   render them unconditionally.
 * - **Provider-optional** — everything else. Present when the provider can
 *   supply it, `null` when it cannot. A component that renders one must
 *   tolerate `null`, because whether it arrives is a *deployment* fact, not a
 *   content fact: the same site yields `item` on a server-backed provider and
 *   `null` on a static one.
 *
 * Concretely today: a local index can produce `matches` / `snippetText` (Fuse
 * reports match ranges) but knows nothing about API-backed collection records;
 * a server endpoint is the reverse. Neither is a subset of the other, which is
 * why the contract is a union with a guaranteed core rather than a
 * lowest-common-denominator.
 *
 * `snippetHtml` is HTML containing `<mark>` elements. Render it through kit's
 * `SafeHtml`, never as text.
 */

/**
 * A result with every optional field nulled and every guaranteed field at its
 * empty value. Spread this first so a provider filling a subset still returns
 * the full shape, and adding a field later cannot silently produce `undefined`
 * at one provider and a value at another.
 *
 * @returns {Object}
 */
export function emptyResult() {
  return {
    // ── Guaranteed ──────────────────────────────────────────────
    id: '',
    type: '',
    route: '',
    href: '',
    title: '',
    pageTitle: '',
    excerpt: '',
    snippetHtml: '',

    // ── Provider-optional ───────────────────────────────────────
    // Deep-linking within a page.
    sectionId: null,
    anchor: null,
    // Extra display material.
    description: null,
    component: null,
    // Plain-text twin of snippetHtml, for non-HTML surfaces.
    snippetText: null,
    // Match ranges, when the provider scores locally and can report them.
    matches: null,
    // Collection provenance, when the hit is a record rather than a page.
    group: null,
    item: null
  }
}

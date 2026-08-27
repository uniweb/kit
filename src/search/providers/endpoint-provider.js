/**
 * The `endpoint` search provider — ask a server.
 *
 * What this buys over a downloaded index is not better matching; it is *when
 * the index can be built*. A local index contains what existed at build time,
 * so records that arrive from an API afterwards can never be in it. A server
 * can index them, and can be told to re-index without the site being rebuilt.
 *
 * Nothing here is specific to any host. The endpoint is a declared path and the
 * response envelope is sniffed, so this works against a self-hosted search API
 * as readily as against a managed one. A backend whose shape is genuinely
 * different wants a foundation-supplied transport, which is the open end of the
 * seam — the same escalation `fetcher:` offers.
 */

import { emptyResult } from './result.js'
import { resolveServiceUrl } from '../../utils/services.js'

/**
 * Path used when a site declares `provider: endpoint` without an `endpoint:`.
 *
 * ⛔ THIS COVERS THE AUTHORED TIER ONLY — it is unreachable for a HOST-declared
 * service, and it must stay that way.
 *
 * A host that declares the service name while offering no address is a
 * **decline** (`@uniweb/core/services`), and `client.js` short-circuits on it
 * before any provider is selected. So `{ "search": {} }` from a host means
 * "draw nothing", never "use the default".
 *
 * ⇒ **The contract, settled with a host implementation 2026-08-25: a host that
 * OFFERS a service must declare it WITH an address.** Offered is `{endpoint}`;
 * declined is `{}`. The two are one byte apart and the failure is silent — an
 * entitled site drawing no search box.
 *
 * ⚠️ **The saving that looks available from either side, and is not.** From
 * here: *"a host need not send an address, kit defaults to `_search` anyway."*
 * From the emitter: *"why emit `/_search` when kit defaults to it?"* **Both
 * collapse the two states into one.** It was proposed and withdrawn the day
 * this was written, by the lane that had just shipped the decline branch — the
 * hazard does not look like a hazard while you are authoring it.
 */
const DEFAULT_ENDPOINT = '_search'

/**
 * Resolve the endpoint against the site's base path.
 *
 * This is the whole reason the endpoint is declared base-RELATIVE. One spelling
 * — `_search` — has to work when the site is served from the root, from a
 * subdirectory (`base: /docs/`), and from a backend subpath. It mirrors how the
 * runtime's default fetcher resolves its base rather than assuming the origin
 * root, and it is what lets a backend expose search as a subroute of the path
 * it already serves the site from, with no framework change.
 *
 * An absolute URL is passed through untouched, for a search service on another
 * origin.
 *
 * The join itself is the shared one every site service uses — this function is
 * now only the *default*, which is the one thing search has that the others must
 * not: a form submission with no declared target has nowhere to go, whereas
 * search with no declared endpoint has a conventional one.
 *
 * @param {string} endpoint - Declared endpoint (relative or absolute)
 * @param {string} basePath - `website.basePath`, normalized without a trailing slash
 * @returns {string}
 */
export function resolveEndpointUrl(endpoint, basePath = '') {
  return resolveServiceUrl(endpoint || DEFAULT_ENDPOINT, basePath)
}

/**
 * Pull the result array out of a response envelope.
 *
 * Deliberately tolerant: `results` is our own shape, `hits` and `items` are the
 * two next most common spellings, and a bare array covers the rest. Anything
 * further afield is a transport's job, not a guessing game here.
 *
 * @param {*} payload
 * @returns {Object[]}
 */
function extractResults(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.results)) return payload.results
  if (Array.isArray(payload?.hits)) return payload.hits
  if (Array.isArray(payload?.items)) return payload.items
  return []
}

/**
 * Normalize one server result into the shared contract.
 *
 * @param {Object} raw
 * @returns {Object}
 */
function normalize(raw) {
  const route = raw?.route ?? ''
  const anchor = raw?.anchor ?? null

  return {
    ...emptyResult(),
    id: raw?.id ?? '',
    type: raw?.type ?? '',
    route,
    // Prefer a server-built href; fall back to composing one, so a backend that
    // returns only route + anchor still yields a working link.
    href: raw?.href ?? (anchor ? `${route}#${anchor}` : route),
    title: raw?.title ?? '',
    pageTitle: raw?.pageTitle ?? '',
    excerpt: raw?.excerpt ?? '',
    snippetHtml: raw?.snippetHtml ?? '',
    sectionId: raw?.sectionId ?? null,
    anchor,
    description: raw?.description ?? null,
    component: raw?.component ?? null,
    snippetText: raw?.snippetText ?? null,
    matches: raw?.matches ?? null,
    // ⭐ `group` — the named set a record came from, renamed from `collection`
    // 2026-08-27 with @uniweb/projections. "Collection" is framework's BUILD
    // concept; a hosted site's records come from a folder and have no collection,
    // so the word did not survive the lane it was travelling into.
    // ⚠️ `collection` is still read as a fallback: a search index is a PUBLISHED
    // ARTIFACT, and a site that has not rebuilt since the rename is still serving
    // the old key. Dropping it would blank the field for every such site.
    group: raw?.group ?? raw?.collection ?? null,
    item: raw?.item ?? null
  }
}

/**
 * Create an `endpoint` provider bound to a Website.
 *
 * @param {Object} website - Website instance from @uniweb/core
 * @param {Object} [options]
 * @param {string} [options.endpoint] - Base-relative path or absolute URL
 * @returns {{query: Function, preload: Function, clearCache: Function}}
 */
export function createEndpointProvider(website, options = {}) {
  const { endpoint } = options

  return {
    async query(text, { limit = 10, type, route, signal } = {}) {
      const url = new URL(
        resolveEndpointUrl(endpoint, website.basePath),
        // A base is required to parse a relative path; in a non-browser context
        // (tests, SSR) there is no location, so use a placeholder we strip below.
        typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
      )

      url.searchParams.set('q', text)
      url.searchParams.set('lang', website.getActiveLocale())
      url.searchParams.set('limit', String(limit))

      const response = await fetch(url.toString(), {
        signal,
        headers: { Accept: 'application/json' }
      })

      if (!response.ok) {
        // ⛔ A HOST'S DECLINE TEXT IS A DIAGNOSTIC, NEVER VISITOR COPY.
        //
        // This block used to argue the opposite — that an endpoint "explains
        // why, in words meant for a visitor", so kit should carry that sentence
        // up for a foundation to render. That is wrong, and it was ruled
        // against on 2026-08-25: a control for a service the site does not have
        // must not be DRAWN in the first place, so there is no place for an
        // apology and nothing for a visitor to read. A site with no search is
        // not broken; it simply has no search, the same way it has no contact
        // form when submissions are not enabled.
        //
        // Two reasons it cannot be visitor copy even if one wanted it to be:
        // it reports the operator's provisioning state to the public, and it
        // arrives in one language from a service layer, bypassing the site's
        // localization entirely. Any text a visitor reads is site content.
        //
        // ⇒ The message is kept because a developer reading a console needs
        // more than "403". `isEnabled()` is what a foundation asks, and it is
        // false long before this line runs.
        //
        // ⛔ THE HOST'S SENTENCE GOES TO THE CONSOLE, NEVER INTO THE THROW.
        //
        // It used to become the Error's message, and `useSearch` exposes
        // `error` — so a foundation rendering it would have shown a visitor a
        // host-authored English sentence about someone's provisioning state.
        // The only thing preventing that was `client.js`'s local-index
        // fallback swallowing the throw, which is incidental: that fallback
        // exists to DEGRADE, and removing it (reasonable — on a host-served
        // lane there is no index to fall back to) would have surfaced the
        // sentence as its first act.
        //
        // ⇒ Splitting the two registers removes the ordering hazard entirely
        // rather than documenting it: whatever reaches `error` is now
        // framework-authored and carries no host prose, so the fallback can be
        // removed on its own merits whenever someone wants to.
        let declined
        try {
          declined = (await response.json())?.error
        } catch {
          /* not JSON — the status is all there is */
        }
        if (typeof declined === 'string' && declined.trim()) {
          // Developer register: a console reader needs more than a number.
          console.warn(`[uniweb] search endpoint declined: ${declined.trim()}`)
        }
        throw new Error(`Search endpoint returned ${response.status}`)
      }

      const payload = await response.json()
      const results = extractResults(payload).map(normalize)

      // Filters are applied client-side because they are not part of the wire
      // contract a third-party endpoint is expected to honor. A server that
      // does support them narrows the set first; re-applying is a no-op.
      let filtered = results
      if (type) filtered = filtered.filter(r => r.type === type)
      if (route) filtered = filtered.filter(r => r.route?.startsWith(route))

      // How many matched, when the endpoint says. Null when it does not, and
      // null is a real answer — see `total` in client.js.
      //
      // ⚠️ Discarded when a local filter removed anything, because then the
      // server counted a DIFFERENT set: it does not know about `type`/`route`,
      // so its number describes matches we just narrowed away. Reporting it
      // would render "showing 3 of 47" beside a filter that produced the 3 —
      // a number that is not wrong about anything the reader can see, which is
      // the worst kind. We cannot recompute it either: what arrived was already
      // capped at `limit`, so the filtered count is a floor, not a total.
      const narrowed = filtered.length !== results.length
      const stated = Number.isInteger(payload?.total) ? payload.total : null

      return {
        results: filtered.slice(0, limit),
        total: narrowed ? null : stated
      }
    },

    // Nothing to warm: there is no index to download. Defined so every provider
    // answers the same calls.
    async preload() {},

    clearCache() {}
  }
}

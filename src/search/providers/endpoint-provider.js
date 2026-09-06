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
 * Resolve a declared endpoint against the site's base path.
 *
 * A declared endpoint is base-RELATIVE, and that is the whole point: one
 * spelling has to work when the site is served from the root, from a
 * subdirectory (`base: /docs/`), and from a backend subpath. It mirrors how the
 * runtime's default fetcher resolves its base rather than assuming the origin
 * root, and it is what lets a host expose search as a subroute of the path it
 * already serves the site from, with no framework change.
 *
 * An absolute URL is passed through untouched, for a search service on another
 * origin. Nothing declared yields `''` — see below.
 *
 * ## ⛔ THERE IS NO DEFAULT ENDPOINT — removed 2026-09-06
 *
 * This returned `'_search'` when nothing was declared, and it was the ONE
 * site-visible service path the framework constructed rather than read. It is
 * gone, and search now behaves like every other service: **a declared target or
 * nothing.** *[Diego, 2026-09-06: "I doubt we need an exception for `/_`."]*
 *
 * ⭐ **Why the default was a liability, not a convenience.** A `/_` path is the
 * host's to name and to switch on or off per site; a framework constant
 * competes with that, and the two can disagree with nothing failing. The
 * docblock that used to sit here spent twenty lines explaining that the default
 * must never be reachable from the host tier, because collapsing *offered*
 * (`{endpoint}`) into *declined* (`{}`) is silent — an entitled site drawing no
 * search box. Deleting the constant deletes the hazard and the explanation.
 * `client.js`'s decline branch is unchanged and still pinned by
 * `tests/search-host-decline.test.js`.
 *
 * @param {string} endpoint - Declared endpoint (relative or absolute)
 * @param {string} basePath - `website.basePath`, normalized without a trailing slash
 * @returns {string} the resolved URL, or `''` when nothing is declared
 */
export function resolveEndpointUrl(endpoint, basePath = '') {
  return resolveServiceUrl(endpoint, basePath)
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
      // ⛔ No declared target, nowhere to go. With no default endpoint (see
      // `resolveEndpointUrl`) an empty resolution would otherwise become a
      // request to the site's own root, which answers HTML and parses as no
      // results — a misconfiguration wearing the shape of an empty index.
      const resolved = resolveEndpointUrl(endpoint, website.basePath)
      if (!resolved) {
        throw new Error(
          'search provider "endpoint" has no endpoint: declare one in the site config, ' +
            'or let the host offer the service.'
        )
      }
      const url = new URL(
        resolved,
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

/**
 * Going back to the page the visitor came from, rather than opening it again.
 *
 * A link opens its page at the top, as a new step in the tab's history — even the page the visitor
 * just left. The runtime brings a page back where the visitor left it only when they go back
 * (`useRememberScroll`, keyed by history entry). So a link that means "back to the list" — a detail
 * page's "← All solutions", a close button — steps back when the page before this one is its page,
 * and is an ordinary link otherwise: on a page opened directly, reached from elsewhere, or in a
 * browser that can't say what the step before was.
 *
 * ⭐ Only the click changes. The link renders as it always does, so a prerendered page, a visit
 * without JavaScript, a new tab and a copied address keep working, and the two renders agree.
 *
 * The history is the browser's to say (`navigation.entries()`, Baseline since 2026-01-13:
 * Chromium 102, Safari 26.2, Firefox 147), so it holds however the visitor got here: a link in
 * prose, the header, another foundation's section, the browser's own buttons. Nothing is recorded
 * along the way, and the runtime carries none of it. Pages compare by path alone, since stepping
 * back returns to the entry with its own query and fragment.
 *
 * ⭐ THE PAGE BEFORE, NOT THE STEP BEFORE. Steps within this page — a link to one of its sections,
 * which adds an entry — are passed over, back to the last entry of another page.
 *
 * ⭐ IT STEPS TO THE ENTRY IT CHECKED, `navigation.traverseTo(key)`. `history.back()` steps the
 * whole tab, which also takes a step each time a frame on the page navigates (an embedded booking
 * widget, a form submitted in an iframe), so it sent only the frame back and the link seemed to do
 * nothing: measured 2026-11-06 in Chromium, Firefox and WebKit. A traversal still fires `popstate`
 * with the entry's own state, so the router and the scroll the runtime remembers apply as before.
 *
 * @module @uniweb/kit/utils/go-back
 */

/** A path, with a trailing slash and its encoding taken off, so two spellings of a page compare equal. */
function comparable(path) {
  let decoded = path
  try {
    decoded = decodeURI(path)
  } catch {
    // An address that does not decode compares as it is written.
  }
  return decoded.length > 1 ? decoded.replace(/\/+$/, '') : decoded
}

/**
 * An entry's path as a route of this site: without the base path. Null for an address on another
 * origin, outside the base path, or one that does not parse.
 *
 * @param {string} address
 * @param {string} base - the site's base path, without a trailing slash ('' at the root)
 * @returns {string|null}
 */
function routeOf(address, base) {
  let url
  try {
    url = new URL(address)
  } catch {
    return null
  }
  if (url.origin !== window.location.origin) return null
  const path = url.pathname
  if (!base) return path
  if (path !== base && !path.startsWith(`${base}/`)) return null
  return path.slice(base.length) || '/'
}

/**
 * The last entry before this one, in this tab, that is another page of this site: its route and
 * its key. Null when there is none — a page opened directly, a visitor who came from elsewhere —
 * or the browser can't say.
 *
 * @param {Object} [website] - the active Website, for its base path
 * @returns {{ path: string, key: string }|null}
 */
export function previousPage(website) {
  const navigation = typeof window !== 'undefined' ? window.navigation : undefined
  const current = navigation?.currentEntry
  if (!current || typeof navigation.entries !== 'function') return null
  const base = website?.basePath || ''
  const entries = navigation.entries()
  const here = routeOf(current.url, base)
  for (let index = current.index - 1; index >= 0; index--) {
    const entry = entries[index]
    const path = entry?.url ? routeOf(entry.url, base) : null
    if (path == null) return null
    if (here != null && comparable(path) === comparable(here)) continue
    return { path, key: entry.key }
  }
  return null
}

/**
 * The page the visitor came from, when it is the page at `route` — or null.
 *
 * @param {string} route - a route as kit's `Link` resolves one (`resolveRoute`): the active
 *   locale's, without the base path
 * @param {Object} [website] - the active Website
 * @returns {{ path: string, key: string }|null}
 */
function cameFromEntry(route, website) {
  if (typeof route !== 'string' || !route.startsWith('/') || route.startsWith('//')) return null
  const before = previousPage(website)
  return before && comparable(before.path) === comparable(route.split(/[?#]/)[0]) ? before : null
}

/**
 * Whether the page before this one, in this tab, was the page at `route`.
 *
 * @param {string} route - as `cameFromEntry` takes it
 * @param {Object} [website] - the active Website
 * @returns {boolean}
 */
export function cameFrom(route, website) {
  return cameFromEntry(route, website) !== null
}

/** Traverse this tab's history to `entry`, the page then coming back where the visitor left it. */
function traverseTo(entry) {
  const { committed, finished } = window.navigation.traverseTo(entry.key) || {}
  // Another navigation started before this one lands interrupts it, and the browser has moved on:
  // there is nothing to recover, and nothing for the console.
  committed?.catch?.(() => {})
  finished?.catch?.(() => {})
}

/**
 * Step back to `route` when the visitor came from it.
 *
 * @param {string} route - as `cameFrom` takes it
 * @param {Object} [website]
 * @returns {boolean} whether it stepped back
 */
export function stepBackTo(route, website) {
  const entry = cameFromEntry(route, website)
  if (entry) traverseTo(entry)
  return entry !== null
}

/**
 * Step back to `route` when the visitor came from it, for a click that would follow a link in this
 * tab: the main button, no key held, nothing else having handled it.
 *
 * @param {MouseEvent} event
 * @param {string} route - as `cameFrom` takes it
 * @param {Object} [website]
 * @returns {boolean} whether it stepped back
 */
export function stepBackOnClick(event, route, website) {
  if (event.defaultPrevented || event.button !== 0) return false
  if (event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) return false
  const entry = cameFromEntry(route, website)
  if (!entry) return false
  event.preventDefault()
  traverseTo(entry)
  return true
}

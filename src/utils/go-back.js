/**
 * Going back to the page the visitor came from, rather than opening it again.
 *
 * A link opens its page at the top, as a new step in the tab's history — even the page the visitor
 * just left. The runtime brings a page back where the visitor left it only when they go back
 * (`useRememberScroll`, keyed by history entry). So a link that means "back to the list" — a detail
 * page's "← All solutions", a close button — steps back when the step before this one is its page,
 * and is an ordinary link otherwise: on a page opened directly, reached from elsewhere, or in a
 * browser that can't say what the step before was.
 *
 * ⭐ Only the click changes. The link renders as it always does, so a prerendered page, a visit
 * without JavaScript, a new tab and a copied address keep working, and the two renders agree.
 *
 * The step before is the browser's to say (`navigation.entries()`, Baseline since 2026-01-13:
 * Chromium 102, Safari 26.2, Firefox 147), so it holds however the visitor got here: a link in
 * prose, the header, another foundation's section, the browser's own buttons. Nothing is recorded
 * along the way, and the runtime carries none of it. Pages compare by path alone, since stepping
 * back returns to the entry with its own query and fragment.
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
 * The path of the history entry before this one, without the base path — or null when there is
 * none in this site, or the browser can't say.
 *
 * @param {Object} [website] - the active Website, for its base path
 * @returns {string|null}
 */
export function previousPath(website) {
  const navigation = typeof window !== 'undefined' ? window.navigation : undefined
  const current = navigation?.currentEntry
  if (!current || typeof navigation.entries !== 'function') return null
  const previous = navigation.entries()[current.index - 1]
  if (!previous?.url) return null
  let url
  try {
    url = new URL(previous.url)
  } catch {
    return null
  }
  if (url.origin !== window.location.origin) return null
  const base = website?.basePath || ''
  let path = url.pathname
  if (base && (path === base || path.startsWith(`${base}/`))) path = path.slice(base.length) || '/'
  return path
}

/**
 * Whether the step before this one, in this tab, was the page at `route`.
 *
 * @param {string} route - a route as kit's `Link` resolves one (`resolveRoute`): the active
 *   locale's, without the base path
 * @param {Object} [website] - the active Website
 * @returns {boolean}
 */
export function cameFrom(route, website) {
  if (typeof route !== 'string' || !route.startsWith('/') || route.startsWith('//')) return false
  const before = previousPath(website)
  return before != null && comparable(before) === comparable(route.split(/[?#]/)[0])
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
  if (!cameFrom(route, website)) return false
  event.preventDefault()
  window.history.back()
  return true
}

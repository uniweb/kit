/**
 * URL predicates
 *
 * Classification of an href, independent of any website or deployment. Kept in
 * its own module so href.js can use it without importing the utils barrel,
 * which re-exports href.js in turn.
 *
 * Both predicates must give the same answer in the browser and during
 * SSR/prerender — the prerendered document and the hydrated DOM are meant to
 * be the same document, and a classification that flips between them produces
 * exactly the kind of corruption isExternalUrl once caused.
 *
 * @module @uniweb/kit/utils/url
 */

/**
 * Check if a URL is external (different origin)
 * @param {string} url
 * @returns {boolean}
 */
export function isExternalUrl(url) {
  if (!url || typeof url !== 'string') return false

  // Protocol-relative (//host/path) targets another authority by construction.
  // Checked before the '/' test, which it would otherwise satisfy.
  if (url.startsWith('//')) return true

  // Site-root-relative paths and bare fragments are always internal
  if (url.startsWith('/') || url.startsWith('#')) return false

  // Anything carrying a scheme (https:, mailto:, tel:, ...) is absolute.
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) {
    // In a browser we can compare origins, so a same-origin absolute URL is
    // internal. Under SSR/prerender there is no origin to compare against —
    // report external, which is both true in practice and the safe answer.
    //
    // This used to read window.location.origin unguarded. The ReferenceError
    // was swallowed by a catch, so during prerender EVERY url — including
    // https:// ones — was reported internal, and callers that treat "internal"
    // as "site-relative" then mangled it.
    const origin = typeof window !== 'undefined' ? window.location?.origin : null
    if (!origin) return true

    try {
      return new URL(url, origin).origin !== origin
    } catch {
      return true
    }
  }

  // Document-relative path (./x, x/y) — internal
  return false
}

// Extensions that mark an href as a file rather than a page route.
const FILE_EXTENSIONS = [
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.zip', '.rar', '.7z', '.tar', '.gz',
  '.mp3', '.wav', '.ogg', '.flac',
  '.mp4', '.avi', '.mov', '.wmv', '.webm',
  '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp',
  '.txt', '.csv', '.json', '.xml'
]

/**
 * Check if a URL points to a downloadable file
 * @param {string} url
 * @returns {boolean}
 */
export function isFileUrl(url) {
  if (!url || typeof url !== 'string') return false

  const lowerUrl = url.toLowerCase()
  return FILE_EXTENSIONS.some(ext => lowerUrl.includes(ext))
}

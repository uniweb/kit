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

// Extensions that mark any URL as a file. On another site, only these do.
const FILE_EXTENSIONS = [
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.zip', '.rar', '.7z', '.tar', '.gz',
  '.mp3', '.wav', '.ogg', '.flac',
  '.mp4', '.avi', '.mov', '.wmv', '.webm',
  '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp',
  '.txt', '.csv', '.json', '.xml'
]

// A path on this site that ends in one of these is a page some other way.
const PAGE_EXTENSIONS = ['.html', '.htm']

/**
 * What a URL's last segment ends in, in lower case, with its query and fragment aside: `.pdf`, or ''.
 * It starts with a letter, or the folder of a version like `/docs/v2.1` would have one.
 */
function extensionOf(url) {
  const path = url.split(/[?#]/)[0]
  const match = /\.[a-z][a-z0-9]*$/i.exec(path.slice(path.lastIndexOf('/') + 1))
  return match ? match[0].toLowerCase() : ''
}

/**
 * Check if a URL points to a downloadable file.
 *
 * ⭐ A path on this site that ends in an extension is a file, whichever one: a site's records and
 * `public/` hold whatever their authors put there, and a route has no extension. ⛔ Until 2026-11-02
 * only the list counted, so a link to `/records/glossary.md` read as a page, and on a French page
 * took a locale prefix to a path that doesn't exist: `.md`, `.yml` and `.geojson` all did.
 *
 * On another site the list decides, since `/wiki/Node.js` and `/index.php` are pages there.
 *
 * @param {string} url
 * @returns {boolean}
 */
export function isFileUrl(url) {
  if (!url || typeof url !== 'string') return false

  const extension = extensionOf(url)
  if (!extension) return false
  if (FILE_EXTENSIONS.includes(extension)) return true
  return /^\/(?!\/)/.test(url) && !PAGE_EXTENSIONS.includes(extension)
}

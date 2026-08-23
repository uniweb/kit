/**
 * Kit Utilities
 *
 * Common utility functions for kit components.
 */

import { clsx } from 'clsx'
import { twMerge, twJoin } from 'tailwind-merge'

// Re-export tailwind-merge utilities
export { twMerge, twJoin }

// ─────────────────────────────────────────────────────────────────
// Locale Utilities
// ─────────────────────────────────────────────────────────────────

/**
 * Locale display names and label resolution now live in `@uniweb/core`, because
 * core is what BUILDS the locale objects a foundation reads (`getLocales()`,
 * `website.langs`) and could not resolve a label from over here. Re-exported so
 * `import { LOCALE_DISPLAY_NAMES } from '@uniweb/kit'` keeps working.
 *
 * Imported by leaf subpath, not bare `@uniweb/core`, to keep the graph kit drags
 * into every foundation bundle small — the same reason `@uniweb/projections`
 * reaches for `@uniweb/core/locale-config`.
 */
export { LOCALE_DISPLAY_NAMES } from '@uniweb/core/locale-config'

/**
 * Get display label for a locale.
 * Priority: locale.label (from site config) -> LOCALE_DISPLAY_NAMES -> code.toUpperCase()
 *
 * Thin alias for core's `localeLabel` — kept so the kit-facing name and the
 * existing foundation call sites do not move.
 *
 * @param {Object|string} locale - Locale object {code, label?} or locale code string
 * @returns {string} Display label for the locale
 *
 * @example
 * getLocaleLabel({ code: 'es', label: 'Spanish' }) // 'Spanish'
 * getLocaleLabel({ code: 'es' })                   // 'Español'
 * getLocaleLabel('es')                             // 'Español'
 * getLocaleLabel({ code: 'xx' })                   // 'XX'
 */
export { localeLabel as getLocaleLabel } from '@uniweb/core/locale-config'

// ─────────────────────────────────────────────────────────────────
// Icon Utilities
// ─────────────────────────────────────────────────────────────────

/**
 * Short icon family codes (2-3 chars) used for dash-format parsing.
 * Matches the content-reader's ICON_FAMILIES_SHORT list.
 */
const ICON_SHORT_CODES = [
  'lu', 'hi', 'hi2', 'pi', 'tb', 'fi', 'bs', 'md', 'ai',
  'ri', 'si', 'io5', 'bi', 'vsc', 'wi', 'gi', 'fa', 'fa6'
]

const ICON_SHORT_CODE_SET = new Set(ICON_SHORT_CODES)

/**
 * Parse an icon reference string into { library, name }.
 *
 * Accepts all standard icon formats:
 * - Dash format:  "lu-house", "hi2-arrow-right"
 * - Colon format: "lu:house", "lucide:house"
 *
 * Returns null if the string doesn't match any known format.
 *
 * @param {string} ref - Icon reference string
 * @returns {{ library: string, name: string } | null}
 *
 * @example
 * parseIconRef('lu-house')       // { library: 'lu', name: 'house' }
 * parseIconRef('lu:house')       // { library: 'lu', name: 'house' }
 * parseIconRef('lucide:house')   // { library: 'lucide', name: 'house' }
 * parseIconRef('not-an-icon')    // null
 */
export function parseIconRef(ref) {
  if (!ref || typeof ref !== 'string') return null

  // Colon format: "lu:house", "lucide:house"
  const colonIdx = ref.indexOf(':')
  if (colonIdx > 0) {
    return { library: ref.slice(0, colonIdx), name: ref.slice(colonIdx + 1) }
  }

  // Dash format: "lu-house" — only short codes (2-3 chars) to avoid
  // ambiguity with regular hyphenated strings
  const dashIdx = ref.indexOf('-')
  if (dashIdx > 0) {
    const prefix = ref.slice(0, dashIdx)
    if (ICON_SHORT_CODE_SET.has(prefix)) {
      return { library: prefix, name: ref.slice(dashIdx + 1) }
    }
  }

  return null
}

// ─────────────────────────────────────────────────────────────────
// Runtime Utilities
// ─────────────────────────────────────────────────────────────────

/**
 * Get the child block renderer component from the runtime.
 * Internal — used by Visual and Render. Components should use ChildBlocks instead.
 */
export function getChildBlockRenderer() {
  return globalThis.uniweb.childBlockRenderer
}

/**
 * Renders child blocks or insets. Wrapper that defers runtime lookup to render time.
 *
 * By default renders each child as a bare component (no wrapper, no section chrome).
 * Pass `wrapAs` to opt into full section treatment.
 *
 * @param {Object} props
 * @param {Object} props.from - Parent block (renders block.childBlocks)
 * @param {Array} props.blocks - Explicit array of blocks to render
 * @param {string} [props.wrapAs] - Wrapper element tag for section treatment ('div', 'article', etc.)
 *
 * @example
 * import { ChildBlocks } from '@uniweb/kit'
 *
 * <ChildBlocks from={block} />
 * <ChildBlocks from={block} wrapAs="div" />
 */
export function ChildBlocks(props) {
  const Renderer = globalThis.uniweb.childBlockRenderer
  return Renderer(props)
}

// ─────────────────────────────────────────────────────────────────
// Class / String Utilities
// ─────────────────────────────────────────────────────────────────

/**
 * Merge class names with Tailwind CSS conflict resolution
 * @param {...string} classes - Class names to merge
 * @returns {string}
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

/**
 * Strip HTML tags from a string
 * @param {string} html - HTML string
 * @returns {string} Plain text
 */
export function stripTags(html) {
  if (!html || typeof html !== 'string') return ''

  // Use DOMParser for safe HTML entity decoding
  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    return doc.body.textContent || ''
  }

  // Fallback: simple regex (less accurate but works in Node)
  return html.replace(/<[^>]*>/g, '')
}

// URL predicates live in url.js so href.js can use them without importing
// this barrel, which re-exports href.js in turn.
export { isExternalUrl, isFileUrl } from './url.js'

// ─────────────────────────────────────────────────────────────────
// Content Utilities
// ─────────────────────────────────────────────────────────────────

export { splitContent } from './splitContent.js'

// Prose href resolution — exported so a foundation rendering its own prose
// HTML resolves authored hrefs the same way kit's <Text> and <SafeHtml> do,
// rather than reinventing (and diverging from) it.
export { applyBasePath, resolveRoute, resolveHref, resolveProseHrefs } from './href.js'

/**
 * Detect media type from URL
 * @param {string} url
 * @returns {'youtube'|'vimeo'|'video'|'image'|'audio'|'unknown'}
 */
export function detectMediaType(url) {
  if (!url) return 'unknown'

  const lowerUrl = url.toLowerCase()

  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) {
    return 'youtube'
  }
  if (lowerUrl.includes('vimeo.com')) {
    return 'vimeo'
  }
  if (/\.(mp4|webm|ogg|mov|avi)/.test(lowerUrl)) {
    return 'video'
  }
  if (/\.(mp3|wav|ogg|flac|aac)/.test(lowerUrl)) {
    return 'audio'
  }
  if (/\.(jpg|jpeg|png|gif|svg|webp|avif)/.test(lowerUrl)) {
    return 'image'
  }

  return 'unknown'
}

// ─────────────────────────────────────────────────────────────────
// Form Submission
// ─────────────────────────────────────────────────────────────────

export { submitForm, deriveSummary } from './submitForm.js'
export { resolveSubmitTarget } from './submitTarget.js'
export {
  resolveService,
  resolveServiceUrl
} from './services.js'

/**
 * The text of a ProseMirror node, flattened.
 *
 * @param {Object|string} node - A ProseMirror node
 * @returns {string}
 */
export function nodeText(node) {
  if (!node) return ''
  if (typeof node === 'string') return node
  if (node.text) return node.text
  if (node.content) return node.content.map(nodeText).join('')
  return ''
}

/**
 * The anchor id for a heading.
 *
 * One generator, used by every renderer that stamps a heading and by anything
 * that links to one. That agreement is the whole point: a table of contents
 * scrolls to an id some other module produced, so a second implementation is a
 * drift waiting to happen — and there were two, differing in whether they
 * stripped markup first, which decided whether a heading containing a link got
 * a usable anchor.
 *
 * @param {string} text - Heading text, plain or containing markup
 * @returns {string}
 */
export function headingId(text) {
  return stripTags(String(text ?? ''))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

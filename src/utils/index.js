/**
 * Kit Utilities
 *
 * Common utility functions for kit components.
 */

import { twMerge, twJoin } from 'tailwind-merge'

// Re-export tailwind-merge utilities
export { twMerge, twJoin }

// ─────────────────────────────────────────────────────────────────
// Locale Utilities
// ─────────────────────────────────────────────────────────────────

/**
 * Common locale display names (native language names)
 * Used as fallback when site.yml doesn't specify labels.
 * Tree-shakeable: only included if foundation uses getLocaleLabel().
 */
export const LOCALE_DISPLAY_NAMES = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  it: 'Italiano',
  pt: 'Português',
  nl: 'Nederlands',
  pl: 'Polski',
  ru: 'Русский',
  ja: '日本語',
  ko: '한국어',
  zh: '中文',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  ar: 'العربية',
  he: 'עברית',
  hi: 'हिन्दी',
  th: 'ไทย',
  vi: 'Tiếng Việt',
  tr: 'Türkçe',
  uk: 'Українська',
  cs: 'Čeština',
  el: 'Ελληνικά',
  hu: 'Magyar',
  ro: 'Română',
  sv: 'Svenska',
  da: 'Dansk',
  fi: 'Suomi',
  no: 'Norsk',
  id: 'Bahasa Indonesia',
  ms: 'Bahasa Melayu'
}

/**
 * Get display label for a locale
 * Priority: locale.label (from site config) → LOCALE_DISPLAY_NAMES → code.toUpperCase()
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
export function getLocaleLabel(locale) {
  // Handle string input (just a code)
  if (typeof locale === 'string') {
    return LOCALE_DISPLAY_NAMES[locale] || locale.toUpperCase()
  }

  // Handle object input
  if (!locale || !locale.code) return ''

  // Priority: explicit label → known display name → uppercase code
  return locale.label || LOCALE_DISPLAY_NAMES[locale.code] || locale.code.toUpperCase()
}

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
// Class / String Utilities
// ─────────────────────────────────────────────────────────────────

/**
 * Merge class names with Tailwind CSS conflict resolution
 * @param {...string} classes - Class names to merge
 * @returns {string}
 */
export function cn(...classes) {
  return twMerge(twJoin(classes.filter(Boolean)))
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

/**
 * Check if a URL is external (different origin)
 * @param {string} url
 * @returns {boolean}
 */
export function isExternalUrl(url) {
  if (!url || typeof url !== 'string') return false
  if (url.startsWith('/') || url.startsWith('#')) return false

  try {
    const urlObj = new URL(url, window.location.origin)
    return urlObj.origin !== window.location.origin
  } catch {
    return false
  }
}

/**
 * Check if a URL points to a downloadable file
 * @param {string} url
 * @returns {boolean}
 */
export function isFileUrl(url) {
  if (!url || typeof url !== 'string') return false

  const fileExtensions = [
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.zip', '.rar', '.7z', '.tar', '.gz',
    '.mp3', '.wav', '.ogg', '.flac',
    '.mp4', '.avi', '.mov', '.wmv', '.webm',
    '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp',
    '.txt', '.csv', '.json', '.xml'
  ]

  const lowerUrl = url.toLowerCase()
  return fileExtensions.some(ext => lowerUrl.includes(ext))
}

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

/**
 * Kit Utilities
 *
 * Common utility functions for kit components.
 */

import { twMerge, twJoin } from 'tailwind-merge'

// Re-export tailwind-merge utilities
export { twMerge, twJoin }

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

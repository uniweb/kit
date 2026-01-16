/**
 * useWebsite Hook
 *
 * Provides access to the current website instance and common utilities.
 * This is the primary hook for kit components to interact with the runtime.
 *
 * @example
 * function MyComponent() {
 *   const { website, localize, makeHref } = useWebsite()
 *   return <a href={makeHref('/about')}>{localize({ en: 'About', fr: 'À propos' })}</a>
 * }
 */

import { getUniweb } from '@uniweb/core'

/**
 * Get the current website instance and utilities
 * @returns {Object} Website utilities
 */
export function useWebsite() {
  const uniweb = getUniweb()

  if (!uniweb) {
    console.warn('[Kit] Runtime not initialized. Components require @uniweb/runtime.')
    return {
      website: null,
      localize: (val, defaultVal = '') => defaultVal,
      makeHref: (href) => href,
      getLanguage: () => 'en',
      getLanguages: () => []
    }
  }

  const website = uniweb.activeWebsite

  return {
    /**
     * The active Website instance
     */
    website,

    /**
     * Localize a multilingual value
     * @param {Object|string} value - Object with language keys or string
     * @param {string} defaultVal - Fallback value
     * @returns {string}
     */
    localize: (value, defaultVal = '') => website.localize(value, defaultVal),

    /**
     * Transform a href (handles topic: protocol, etc.)
     * @param {string} href
     * @returns {string}
     */
    makeHref: (href) => website.makeHref(href),

    /**
     * Get current language code
     * @returns {string}
     */
    getLanguage: () => website.getLanguage(),

    /**
     * Get available languages
     * @returns {Array<{label: string, value: string}>}
     */
    getLanguages: () => website.getLanguages(),

    /**
     * Get routing components (Link, useNavigate, etc.)
     * @returns {Object}
     */
    getRoutingComponents: () => website.getRoutingComponents()
  }
}

export default useWebsite

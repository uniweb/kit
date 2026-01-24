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
 * Get the current website instance and utilities.
 * This hook assumes the runtime is properly initialized.
 *
 * @returns {Object} Website utilities
 * @throws {Error} If called before runtime initialization
 */
export function useWebsite() {
  const uniweb = getUniweb()
  const website = uniweb?.activeWebsite

  if (!website) {
    throw new Error(
      '[Kit] useWebsite() called before runtime initialization. ' +
      'Components must be rendered within a properly initialized Uniweb runtime.'
    )
  }

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

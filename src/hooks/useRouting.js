/**
 * useRouting Hook
 *
 * Provides SSG-safe access to routing functionality.
 *
 * The runtime registers routing components (Link, useNavigate, useLocation, useParams)
 * via the bridge pattern. This hook provides safe access that gracefully handles
 * SSG/SSR contexts where the Router context isn't available.
 *
 * @example
 * function NavItem({ route }) {
 *   const { useLocation } = useRouting()
 *   const location = useLocation()
 *   const isActive = location.pathname === route
 *   return <Link to={route} className={isActive ? 'active' : ''}>...</Link>
 * }
 */

import { getUniweb } from '@uniweb/core'

/**
 * Default location object for SSG/SSR contexts
 */
const DEFAULT_LOCATION = {
  pathname: '/',
  search: '',
  hash: '',
  state: null,
  key: 'default'
}

/**
 * Default params object for SSG/SSR contexts
 */
const DEFAULT_PARAMS = {}

/**
 * Get routing utilities with SSG-safe fallbacks
 * @returns {Object} Routing utilities
 */
export function useRouting() {
  const uniweb = getUniweb()
  const routing = uniweb?.routingComponents || {}

  return {
    /**
     * SSG-safe useLocation hook
     * Returns current location or defaults during SSG
     * @returns {Object} Location object { pathname, search, hash, state, key }
     */
    useLocation: () => {
      if (!routing.useLocation) {
        return DEFAULT_LOCATION
      }
      try {
        return routing.useLocation()
      } catch {
        // Router context not available (SSG/SSR)
        return DEFAULT_LOCATION
      }
    },

    /**
     * SSG-safe useParams hook
     * Returns route params or empty object during SSG
     * @returns {Object} Params object
     */
    useParams: () => {
      if (!routing.useParams) {
        return DEFAULT_PARAMS
      }
      try {
        return routing.useParams()
      } catch {
        // Router context not available (SSG/SSR)
        return DEFAULT_PARAMS
      }
    },

    /**
     * SSG-safe useNavigate hook
     * Returns navigate function or no-op during SSG
     * @returns {Function} Navigate function
     */
    useNavigate: () => {
      if (!routing.useNavigate) {
        return () => {} // No-op during SSG
      }
      try {
        return routing.useNavigate()
      } catch {
        // Router context not available (SSG/SSR)
        return () => {}
      }
    },

    /**
     * Router Link component (or fallback to 'a')
     * Use Kit's Link component instead for most cases
     */
    Link: routing.Link || 'a',

    /**
     * Check if routing is available (browser with Router context)
     * @returns {boolean}
     */
    isRoutingAvailable: () => {
      if (!routing.useLocation) return false
      try {
        routing.useLocation()
        return true
      } catch {
        return false
      }
    }
  }
}

export default useRouting

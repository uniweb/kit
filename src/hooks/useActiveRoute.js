/**
 * useActiveRoute Hook
 *
 * SSG-safe hook for active route detection in navigation components.
 * Provides utilities for checking if pages are active or ancestors of the current route.
 *
 * All route comparison logic is delegated to Website class methods to ensure
 * a single source of truth for route normalization and matching.
 *
 * @example
 * function NavItem({ page }) {
 *   const { isActiveOrAncestor } = useActiveRoute()
 *
 *   return (
 *     <Link
 *       href={page.navigableRoute || page.route}
 *       className={isActiveOrAncestor(page) ? 'active' : ''}
 *     >
 *       {page.label}
 *     </Link>
 *   )
 * }
 */

import { useRouting } from './useRouting.js'
import { useWebsite } from './useWebsite.js'

/**
 * Hook for active route detection with SSG-safe fallbacks.
 * Delegates all logic to Website class for consistency.
 *
 * @returns {Object} Route utilities
 * @property {string} route - Current normalized route (e.g., 'docs/getting-started')
 * @property {string} rootSegment - First segment of route (e.g., 'docs')
 * @property {function} isActive - Check if a page is the current page
 * @property {function} isActiveOrAncestor - Check if a page or its descendants are active
 */
export function useActiveRoute() {
  const { useLocation } = useRouting()
  const website = useWebsite()
  const location = useLocation()

  // Delegate normalization to Website
  const currentRoute = website?.normalizeRoute(location?.pathname) || ''
  const rootSegment = currentRoute.split('/')[0]

  return {
    /**
     * Current normalized route (no leading/trailing slashes)
     * @type {string}
     */
    route: currentRoute,

    /**
     * First segment of the current route
     * Useful for root-level navigation highlighting
     * @type {string}
     */
    rootSegment,

    /**
     * Check if a page is the current active page (exact match)
     * Delegates to Website.isRouteActive() for consistent comparison.
     *
     * @param {Object|string} pageOrRoute - Page object or route string
     * @returns {boolean}
     */
    isActive: (pageOrRoute) => {
      const targetRoute = typeof pageOrRoute === 'string'
        ? pageOrRoute
        : pageOrRoute.route
      return website?.isRouteActive(targetRoute, currentRoute) || false
    },

    /**
     * Check if a page or any of its descendants is active
     * Useful for highlighting parent nav items when child is active.
     * Delegates to Website.isRouteActiveOrAncestor() for consistent logic.
     *
     * @param {Object|string} pageOrRoute - Page object or route string
     * @returns {boolean}
     */
    isActiveOrAncestor: (pageOrRoute) => {
      const targetRoute = typeof pageOrRoute === 'string'
        ? pageOrRoute
        : pageOrRoute.route
      return website?.isRouteActiveOrAncestor(targetRoute, currentRoute) || false
    },
  }
}

export default useActiveRoute

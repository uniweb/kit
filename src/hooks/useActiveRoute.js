/**
 * useActiveRoute Hook
 *
 * SSG-safe hook for active route detection in navigation components.
 * Provides utilities for checking if pages are active or ancestors of the current route.
 *
 * @example
 * function NavItem({ page }) {
 *   const { isActiveOrAncestor } = useActiveRoute()
 *
 *   return (
 *     <Link
 *       href={page.getNavigableRoute()}
 *       className={isActiveOrAncestor(page) ? 'active' : ''}
 *     >
 *       {page.label}
 *     </Link>
 *   )
 * }
 */

import { useRouting } from './useRouting.js'

/**
 * Normalize a route by removing leading/trailing slashes
 * @param {string} route
 * @returns {string}
 */
function normalizeRoute(route) {
  return (route || '').replace(/^\//, '').replace(/\/$/, '')
}

/**
 * Hook for active route detection with SSG-safe fallbacks.
 *
 * @returns {Object} Route utilities
 * @property {string} route - Current normalized route (e.g., 'docs/getting-started')
 * @property {string} rootSegment - First segment of route (e.g., 'docs')
 * @property {function} isActive - Check if a page is the current page
 * @property {function} isActiveOrAncestor - Check if a page or its descendants are active
 */
export function useActiveRoute() {
  const { useLocation } = useRouting()
  const location = useLocation()

  const route = normalizeRoute(location?.pathname)
  const rootSegment = route.split('/')[0]

  return {
    /**
     * Current normalized route (no leading/trailing slashes)
     * @type {string}
     */
    route,

    /**
     * First segment of the current route
     * Useful for root-level navigation highlighting
     * @type {string}
     */
    rootSegment,

    /**
     * Check if a page is the current active page (exact match)
     *
     * @param {Object} page - Page object with getNormalizedRoute() or route property
     * @returns {boolean}
     */
    isActive: (page) => {
      if (typeof page.getNormalizedRoute === 'function') {
        return page.getNormalizedRoute() === route
      }
      // Fallback for page info objects from getPageHierarchy
      return normalizeRoute(page.route) === route
    },

    /**
     * Check if a page or any of its descendants is active
     * Useful for highlighting parent nav items when child is active
     *
     * @param {Object} page - Page object with isActiveOrAncestor() or route property
     * @returns {boolean}
     */
    isActiveOrAncestor: (page) => {
      if (typeof page.isActiveOrAncestor === 'function') {
        return page.isActiveOrAncestor(route)
      }
      // Fallback for page info objects from getPageHierarchy
      const pageRoute = normalizeRoute(page.route)
      if (pageRoute === route) return true
      // if (pageRoute === '') return true // Root is ancestor of all
      return route.startsWith(pageRoute + '/')
    },
  }
}

export default useActiveRoute

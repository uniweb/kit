/**
 * useVersion Hook
 *
 * Hook for version switching in documentation sites.
 * Provides access to version information and utilities for building
 * version switcher components.
 *
 * @example
 * function VersionSwitcher() {
 *   const { isVersioned, currentVersion, versions, getVersionUrl } = useVersion()
 *
 *   if (!isVersioned) return null
 *
 *   return (
 *     <select
 *       value={currentVersion?.id}
 *       onChange={(e) => navigate(getVersionUrl(e.target.value))}
 *     >
 *       {versions.map(v => (
 *         <option key={v.id} value={v.id}>
 *           {v.label} {v.latest ? '(latest)' : ''} {v.deprecated ? '(deprecated)' : ''}
 *         </option>
 *       ))}
 *     </select>
 *   )
 * }
 */

import { useRouting } from './useRouting.js'
import { useWebsite } from './useWebsite.js'

/**
 * Hook for version information and switching.
 * Works both at page level (when page has version context) and
 * at site level (checking versioned scopes).
 *
 * @param {Object} options - Optional configuration
 * @param {Page} options.page - Specific page to check (default: active page)
 * @returns {Object} Version utilities
 */
export function useVersion(options = {}) {
  const { useLocation } = useRouting()
  const { website } = useWebsite()
  const location = useLocation()

  const page = options.page || website.activePage
  // Prefer page route for SSG accuracy, fallback to location pathname
  const currentRoute = page?.route || location?.pathname || '/'

  // Check if the current page/route is within a versioned section
  const isVersioned = page?.isVersioned() || website.isVersionedRoute(currentRoute)

  // Get version information from page (preferred) or compute from route
  const currentVersion = page?.getVersion() || null
  const versionMeta = page?.versionMeta || website.getVersionMeta(website.getVersionScope(currentRoute))
  const versions = versionMeta?.versions || []
  const latestVersionId = versionMeta?.latestId || null

  // Find the version scope for the current route
  const versionScope = page?.versionScope || website.getVersionScope(currentRoute)

  return {
    /**
     * Whether the current page is within a versioned section
     * @type {boolean}
     */
    isVersioned,

    /**
     * Current version info { id, label, latest, deprecated }
     * @type {Object|null}
     */
    currentVersion,

    /**
     * All available versions for this scope
     * @type {Array<{id: string, label: string, latest: boolean, deprecated: boolean}>}
     */
    versions,

    /**
     * The ID of the latest version
     * @type {string|null}
     */
    latestVersionId,

    /**
     * The route where versioning starts (e.g., '/docs')
     * @type {string|null}
     */
    versionScope,

    /**
     * Check if current version is the latest
     * @type {boolean}
     */
    isLatestVersion: currentVersion?.latest === true,

    /**
     * Check if current version is deprecated
     * @type {boolean}
     */
    isDeprecatedVersion: currentVersion?.deprecated === true,

    /**
     * Get URL for switching to a different version
     * @param {string} targetVersion - Target version ID (e.g., 'v1')
     * @returns {string|null} Target URL or null if not versioned
     */
    getVersionUrl: (targetVersion) => {
      if (!isVersioned) return null
      return website.getVersionUrl(targetVersion, currentRoute)
    },

    /**
     * Check if site has any versioned content
     * @type {boolean}
     */
    hasVersionedContent: website.hasVersionedContent(),

    /**
     * Get all versioned scopes in the site
     * @type {Object} Map of scope → { versions, latestId }
     */
    versionedScopes: website.getVersionedScopes(),
  }
}

export default useVersion

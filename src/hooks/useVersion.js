/**
 * useVersion Hook
 *
 * What a foundation needs to draw older versions of a site's docs: which version a page belongs to,
 * where each other version leads from it, and the page tree with only that version's pages in it.
 *
 * A folder named `v1` or `v2.1` holds a version of the pages beside it, at its own URL. The pages
 * beside the folders are the latest; with none, the newest folder is. On a page in no such section,
 * and on any site with no version folders, `isVersioned` is false and there is nothing to draw.
 *
 * @example
 * function VersionSwitcher() {
 *   const { isVersioned, currentVersion, versions } = useVersion()
 *   if (!isVersioned || versions.length < 2) return null
 *
 *   return (
 *     <ul>
 *       {versions.map((version) => (
 *         <li key={version.id} aria-current={version.id === currentVersion.id}>
 *           <Link href={version.href}>{version.label ?? 'Latest'}</Link>
 *         </li>
 *       ))}
 *     </ul>
 *   )
 * }
 *
 * @example
 * // A sidebar of the version being read
 * const { hierarchy } = useVersion()
 * const pages = hierarchy({ for: 'left' })
 */

import { readVersion } from '../utils/versions.js'
import { useRouting } from './useRouting.js'
import { useWebsite } from './useWebsite.js'

/**
 * @param {Object} [options]
 * @param {Page} [options.page] - The page to read (default: the active page)
 * @returns {{
 *   isVersioned: boolean,
 *   versions: Array<{id: string, label: string|null, latest: boolean, route: string, href: string}>,
 *   currentVersion: Object|null,
 *   latestVersion: Object|null,
 *   isOlderVersion: boolean,
 *   versionScope: string|null,
 *   holds: (route: string) => boolean,
 *   hierarchy: (options?: Object) => Array<Object>,
 * }}
 *   - `versions`: the section's versions, latest first. `id` is the folder's name, or `latest` for
 *     the pages beside the folders. `label` is the folder page's `label` or `title`, and null for
 *     the pages beside the folders, which have no page of their own to name them: a foundation
 *     names those. `route` is where the version starts. `href` is where it leads from this page:
 *     the same page, else the nearest folder above it the version has, else the version's first
 *     page. Pass it to `<Link>`, which adds the site's `base` and the reader's language.
 *   - `currentVersion`: the one being read. `latestVersion`: the section's latest.
 *   - `isOlderVersion`: reading anything but the latest.
 *   - `versionScope`: the route of the folder holding the versions.
 *   - `holds(route)`: whether a page belongs with what's being read: the same version, or no
 *     version at all. Filter a flat list of pages with it, for previous and next.
 *   - `hierarchy(options)`: `website.getPageHierarchy(options)`, keeping to the version being read
 *     here and to the latest in any other section.
 */
export function useVersion(options = {}) {
  const { useLocation } = useRouting()
  const { website } = useWebsite()
  const location = useLocation()

  // The page's route first, which is what a prerender has. The location keeps this current across
  // navigation in the browser.
  const route = (options.page || website.activePage)?.route || location?.pathname || '/'
  const { isVersioned, versions, currentVersion, latestVersion, isOlderVersion, versionScope, holds, hierarchy } =
    readVersion(website, route)

  return { isVersioned, versions, currentVersion, latestVersion, isOlderVersion, versionScope, holds, hierarchy }
}

export default useVersion

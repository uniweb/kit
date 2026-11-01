/**
 * What versions a site's page tree holds, and which one a route belongs to.
 *
 * A folder named `v1` or `v2.1` holds a version of the pages beside it, at its own URL
 * (`@uniweb/projections/versions`). Everything here is read off the routes of the pages a site has,
 * so it reads the same on a built site and on one a backend publishes: there is no version data in
 * a site's payload, in core or in the runtime, and a foundation that draws no version switcher
 * carries none of this.
 *
 * ⛔ Don't compute a version's URLs by rewriting the path being read. That was `getVersionUrl`, and
 * it led to pages that didn't exist, past the site's `base`, and out of the reader's language. A
 * version's `href` is a page this site has, found in the tree, and a `<Link>` adds the rest.
 */

import { compareVersionFolders, isVersionFolder } from '@uniweb/projections/versions'

const segmentsOf = (route) => String(route ?? '').split('/').filter(Boolean)
const routeOf = (segments, count) => `/${segments.slice(0, count).join('/')}`
const under = (root, rest) => (root === '/' ? rest || '/' : `${root}${rest}`)

/**
 * The section a route belongs to: the nearest folder above it that holds versions, or the version
 * folder it's inside. `id` is that folder's name, and null for a page beside the folders.
 */
function locate(route, sections) {
  const segments = segmentsOf(route)
  for (let i = segments.length; i > 0; i--) {
    const here = routeOf(segments, i)
    if (sections.has(here)) return { scope: here, id: null }
    if (isVersionFolder(segments[i - 1])) {
      const scope = routeOf(segments, i - 1)
      if (sections.has(scope)) return { scope, id: segments[i - 1] }
    }
  }
  return sections.has('/') ? { scope: '/', id: null } : null
}

const indexes = new WeakMap()

/** What a site's pages say about versions, once per list of pages. */
function indexOf(pages) {
  const known = indexes.get(pages)
  if (known && known.count === pages.length) return known

  const byRoute = new Map()
  const sections = new Map()
  for (const page of pages) {
    byRoute.set(page.route, page)
    const segments = segmentsOf(page.route)
    segments.forEach((segment, i) => {
      if (!isVersionFolder(segment)) return
      const scope = routeOf(segments, i)
      if (!sections.has(scope)) sections.set(scope, { folders: new Set(), own: false })
      sections.get(scope).folders.add(segment)
    })
  }
  // A homepage promoted out of its folder answers to that folder's path too.
  for (const page of pages) {
    if (page.sourcePath && !byRoute.has(page.sourcePath)) byRoute.set(page.sourcePath, page)
  }

  if (sections.size) {
    for (const page of pages) {
      const where = locate(page.route, sections)
      if (!where || where.id !== null) continue
      if (page.route !== where.scope || page.hasContent()) sections.get(where.scope).own = true
    }
    for (const [scope, section] of sections) {
      section.versions = [...section.folders].sort(compareVersionFolders).map((id) => {
        const route = under(scope, `/${id}`)
        return { id, route, label: byRoute.get(route)?.getLabel() || id, latest: false }
      })
      // The pages beside the folders are the latest; with none, the newest folder is.
      if (section.own) section.versions.unshift({ id: 'latest', route: scope, label: null, latest: true })
      else section.versions[0].latest = true
    }
  }

  const index = { count: pages.length, byRoute, sections }
  indexes.set(pages, index)
  return index
}

/**
 * Where a page of one version leads in another: the same page, else the nearest folder above it
 * that version has, else that version's first page. Always a page this site has.
 */
function landingIn(version, rest, byRoute) {
  for (let path = rest; ; path = path.slice(0, path.lastIndexOf('/'))) {
    const page = byRoute.get(under(version.route, path))
    if (page) return page.getNavigableRoute()
    if (!path) return version.route
  }
}

const NOT_VERSIONED = {
  isVersioned: false,
  versions: [],
  currentVersion: null,
  latestVersion: null,
  isOlderVersion: false,
  versionScope: null,
}

/**
 * The version of the page at a route, and what that means for what a reader of it should see.
 *
 * @param {Object} website - a Website
 * @param {string} [route] - the route being read
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
 */
export function readVersion(website, route) {
  const { byRoute, sections } = indexOf(website.pages ?? [])

  const isLatest = (where) => where.id === null || sections.get(where.scope).versions[0].id === where.id
  const reading = route === undefined || route === null ? null : locate(route, sections)
  const readingId = reading && (reading.id ?? sections.get(reading.scope).versions[0].id)

  const holds = (other) => {
    const where = locate(other, sections)
    if (!where) return true
    if (reading?.scope !== where.scope) return isLatest(where)
    return (where.id ?? sections.get(where.scope).versions[0].id) === readingId
  }
  const isInLatest = (other) => {
    const where = locate(other, sections)
    return !where || isLatest(where)
  }

  const answer = reading ? readSection() : NOT_VERSIONED

  function readSection() {
    const { versions: list } = sections.get(reading.scope)
    const current = list.find((version) => version.id === readingId)
    const page = byRoute.get(route)
    const from = page?.sourcePath || route
    const rest = current.route === '/' ? (from === '/' ? '' : from) : from.slice(current.route.length)
    const versions = list.map((version) => ({ ...version, href: landingIn(version, rest, byRoute) }))
    return {
      isVersioned: true,
      versions,
      currentVersion: versions.find((version) => version.id === readingId),
      latestVersion: versions[0],
      isOlderVersion: !current.latest,
      versionScope: reading.scope,
    }
  }

  const hierarchy = (options = {}) => {
    const { filter, nested = true } = options
    const keep = (test) => (page) => test(page.route) && (!filter || filter(page))
    if (!answer.isOlderVersion || !nested) {
      return website.getPageHierarchy({ ...options, filter: keep(holds) })
    }
    const own = website.getPageHierarchy({
      ...options,
      under: answer.currentVersion.route,
      filter: keep(holds),
    })
    if (answer.versionScope === '/') return own
    // The rest of the site as it always is, with this section's pages swapped for the version's.
    const landing = landingIn(answer.currentVersion, '', byRoute)
    const swap = (items) =>
      items.map((item) =>
        item.route === answer.versionScope
          ? { ...item, navigableRoute: landing, children: own }
          : { ...item, children: swap(item.children ?? []) }
      )
    return swap(website.getPageHierarchy({ ...options, filter: keep(isInLatest) }))
  }

  return { ...answer, holds, isInLatest, hierarchy, hasVersions: sections.size > 0 }
}

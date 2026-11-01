/**
 * What a site's page tree says about versions, read through a real Website, since the routes, the
 * parents and the labels are all the graph's.
 */
import { describe, test, expect, vi, afterEach } from 'vitest'
import { Website } from '@uniweb/core'
import { readVersion } from '../src/utils/versions.js'
import { createSearchClient } from '../src/search/client.js'

const page = (route, extra = {}) => ({ route, title: route.split('/').pop() || 'Home', hasContent: true, sections: [], ...extra })
const folder = (route, title, extra = {}) => page(route, { title, hasContent: false, ...extra })

const site = (pages) => new Website({ content: { config: { name: 'Test', defaultLanguage: 'en' }, theme: {}, pages } })

/** `/docs` with its latest pages beside two older versions, and a page outside it all. */
const docs = () =>
  site([
    page('/', { title: 'Home', isIndex: true }),
    page('/about'),
    folder('/docs', 'Docs'),
    page('/docs/start'),
    page('/docs/start/install'),
    page('/docs/guide'),
    page('/docs/new-thing'),
    folder('/docs/v2', '2.x'),
    page('/docs/v2/start'),
    page('/docs/v2/start/install'),
    page('/docs/v2/guide'),
    folder('/docs/v1', '1.x'),
    page('/docs/v1/start'),
    page('/docs/v1/guide'),
  ])

const ids = (versions) => versions.map((version) => version.id)
const hrefs = (versions) => Object.fromEntries(versions.map((version) => [version.id, version.href]))
const routes = (items) => items.map((item) => item.route)

describe('which version a page belongs to', () => {
  test('a page beside the version folders is the latest', () => {
    const answer = readVersion(docs(), '/docs/guide')
    expect(answer.isVersioned).toBe(true)
    expect(answer.versionScope).toBe('/docs')
    expect(answer.currentVersion.id).toBe('latest')
    expect(answer.currentVersion.latest).toBe(true)
    expect(answer.isOlderVersion).toBe(false)
  })

  test('a page in a version folder is that version', () => {
    const answer = readVersion(docs(), '/docs/v1/guide')
    expect(answer.versionScope).toBe('/docs')
    expect(answer.currentVersion).toMatchObject({ id: 'v1', label: '1.x', latest: false, route: '/docs/v1' })
    expect(answer.latestVersion.id).toBe('latest')
    expect(answer.isOlderVersion).toBe(true)
  })

  test('a page elsewhere has no version', () => {
    const answer = readVersion(docs(), '/about')
    expect(answer).toMatchObject({ isVersioned: false, versions: [], currentVersion: null, isOlderVersion: false })
  })

  test('a site with no version folders has nothing to say', () => {
    const answer = readVersion(site([page('/'), page('/about')]), '/about')
    expect(answer).toMatchObject({ isVersioned: false, hasVersions: false })
    expect(answer.holds('/about')).toBe(true)
  })

  test('versions list the latest first, then newest by number', () => {
    const answer = readVersion(
      site([page('/docs/a'), page('/docs/v1/a'), page('/docs/v2.10/a'), page('/docs/v2.9/a')]),
      '/docs/a'
    )
    expect(ids(answer.versions)).toEqual(['latest', 'v2.10', 'v2.9', 'v1'])
  })

  test('a folder with no title of its own is labelled by its name', () => {
    const answer = readVersion(site([page('/docs/a'), page('/docs/v1/a')]), '/docs/a')
    expect(answer.versions[1].label).toBe('v1')
  })

  test('the pages beside the folders have no name of their own', () => {
    expect(readVersion(docs(), '/docs/guide').latestVersion.label).toBeNull()
  })

  test('with nothing beside the folders, the newest folder is the latest', () => {
    const answer = readVersion(site([folder('/docs', 'Docs'), page('/docs/v1/a'), page('/docs/v2/a')]), '/docs/v1/a')
    expect(ids(answer.versions)).toEqual(['v2', 'v1'])
    expect(answer.versions[0].latest).toBe(true)
    expect(answer.isOlderVersion).toBe(true)
    expect(readVersion(site([folder('/docs', 'Docs'), page('/docs/v1/a'), page('/docs/v2/a')]), '/docs/v2/a').isOlderVersion).toBe(false)
  })

  test('a folder whose own page has content counts as the latest', () => {
    const answer = readVersion(site([page('/docs'), page('/docs/v1')]), '/docs')
    expect(ids(answer.versions)).toEqual(['latest', 'v1'])
  })

  test('at the root of a site', () => {
    const tree = site([page('/', { isIndex: true, sourcePath: '/start' }), page('/guide'), folder('/v1', '1.x'), page('/v1/start'), page('/v1/guide')])
    expect(readVersion(tree, '/guide').currentVersion.id).toBe('latest')
    expect(readVersion(tree, '/').currentVersion.id).toBe('latest')
    expect(readVersion(tree, '/v1/guide').currentVersion.id).toBe('v1')
    expect(readVersion(tree, '/v1/guide').versionScope).toBe('/')
  })

  test('the nearest folder wins, when a version holds versions of its own', () => {
    const tree = site([page('/docs/a'), page('/docs/v1/api/x'), page('/docs/v1/api/v9/x')])
    expect(readVersion(tree, '/docs/v1/api/v9/x').versionScope).toBe('/docs/v1/api')
    expect(readVersion(tree, '/docs/v1/api/x').currentVersion.id).toBe('latest')
    expect(readVersion(tree, '/docs/v1/api/x').versionScope).toBe('/docs/v1/api')
  })

  test('a name that only looks like a version is an ordinary page', () => {
    const tree = site([page('/docs/version1/a'), page('/docs/v-1/a'), page('/docs/1/a')])
    expect(readVersion(tree, '/docs/version1/a').isVersioned).toBe(false)
  })
})

describe('where each version leads', () => {
  test('to the same page, when the version has it', () => {
    expect(hrefs(readVersion(docs(), '/docs/guide').versions)).toEqual({
      latest: '/docs/guide',
      v2: '/docs/v2/guide',
      v1: '/docs/v1/guide',
    })
    expect(hrefs(readVersion(docs(), '/docs/v2/start/install').versions).latest).toBe('/docs/start/install')
  })

  test('else to the nearest folder above it that the version has', () => {
    expect(hrefs(readVersion(docs(), '/docs/start/install').versions).v1).toBe('/docs/v1/start')
  })

  test('else to the first page of the version', () => {
    expect(hrefs(readVersion(docs(), '/docs/new-thing').versions)).toEqual({
      latest: '/docs/new-thing',
      v2: '/docs/v2/start',
      v1: '/docs/v1/start',
    })
  })

  test('every link names a page the site has, at the root of a site too', () => {
    const tree = site([
      page('/', { isIndex: true, sourcePath: '/start' }),
      page('/start/install'),
      page('/guide'),
      folder('/v1', '1.x'),
      page('/v1/start'),
      page('/v1/start/install'),
    ])
    const known = new Set(tree.pages.map((p) => p.route))
    for (const from of ['/', '/start/install', '/guide', '/v1/start', '/v1/start/install']) {
      for (const version of readVersion(tree, from).versions) expect(known.has(version.href)).toBe(true)
    }
    // The promoted home page answers to the folder it came from, in both directions.
    expect(hrefs(readVersion(tree, '/').versions).v1).toBe('/v1/start')
    expect(hrefs(readVersion(tree, '/v1/start').versions).latest).toBe('/')
  })

  test('a folder with no content leads to its first page with some', () => {
    const answer = readVersion(docs(), '/docs/start')
    const tree = site([folder('/docs', 'Docs'), folder('/docs/a', 'A'), page('/docs/a/b'), folder('/docs/v1', '1.x'), folder('/docs/v1/a', 'A'), page('/docs/v1/a/b')])
    expect(hrefs(readVersion(tree, '/docs/a/b').versions).v1).toBe('/docs/v1/a/b')
    expect(answer.versions).toHaveLength(3)
  })
})

describe('what belongs with the page being read', () => {
  const flat = (tree, route) => tree.getPageHierarchy({ nested: false, filter: (p) => readVersion(tree, route).holds(p.route) }).map((p) => p.route)

  test('reading the latest, older versions stay out', () => {
    const tree = docs()
    const seen = flat(tree, '/docs/guide')
    expect(seen).toContain('/docs/guide')
    expect(seen).toContain('/about')
    expect(seen.filter((r) => r.includes('/v'))).toEqual([])
  })

  test('reading an older version, the others stay out', () => {
    const seen = flat(docs(), '/docs/v1/guide')
    expect(seen).toContain('/docs/v1/guide')
    expect(seen).toContain('/about')
    expect(seen).not.toContain('/docs/guide')
    expect(seen).not.toContain('/docs/v2/guide')
  })

  test('off the docs, the latest', () => {
    const seen = flat(docs(), '/about')
    expect(seen).toContain('/docs/guide')
    expect(seen).not.toContain('/docs/v1/guide')
  })
})

describe('the page tree of the version being read', () => {
  const docsNode = (items) => items.find((item) => item.route === '/docs')

  test('reading the latest, its pages and none of the folders', () => {
    const { hierarchy } = readVersion(docs(), '/docs/guide')
    expect(routes(docsNode(hierarchy()).children)).toEqual(['/docs/start', '/docs/guide', '/docs/new-thing'])
  })

  test('reading an older version, its pages in the same place in the tree', () => {
    const { hierarchy } = readVersion(docs(), '/docs/v1/guide')
    const tree = hierarchy()
    expect(routes(tree)).toEqual(['/', '/about', '/docs'])
    expect(routes(docsNode(tree).children)).toEqual(['/docs/v1/start', '/docs/v1/guide'])
    expect(docsNode(tree).navigableRoute).toBe('/docs/v1/start')
  })

  test('off the docs, the latest', () => {
    const { hierarchy } = readVersion(docs(), '/about')
    expect(routes(docsNode(hierarchy()).children)).toEqual(['/docs/start', '/docs/guide', '/docs/new-thing'])
  })

  test('at the root of a site, the version is the tree', () => {
    const tree = site([page('/', { isIndex: true }), page('/guide'), folder('/v1', '1.x'), page('/v1/start'), page('/v1/guide')])
    expect(routes(readVersion(tree, '/v1/guide').hierarchy())).toEqual(['/v1/start', '/v1/guide'])
    expect(routes(readVersion(tree, '/guide').hierarchy())).toEqual(['/', '/guide'])
  })

  test('a version folder hidden from menus still has its own tree', () => {
    const tree = site([folder('/docs', 'Docs'), page('/docs/a'), folder('/docs/v1', '1.x', { hideIn: ['*'] }), page('/docs/v1/a')])
    const { hierarchy } = readVersion(tree, '/docs/v1/a')
    expect(routes(docsNode(hierarchy()).children)).toEqual(['/docs/v1/a'])
  })

  test('an area and a filter still apply', () => {
    const tree = site([folder('/docs', 'Docs'), page('/docs/a'), page('/docs/b', { hideIn: ['left'] }), folder('/docs/v1', '1.x'), page('/docs/v1/a'), page('/docs/v1/b', { hideIn: ['left'] }), page('/docs/v1/c')])
    const older = readVersion(tree, '/docs/v1/a').hierarchy
    expect(routes(docsNode(older({ for: 'left' })).children)).toEqual(['/docs/v1/a', '/docs/v1/c'])
    expect(routes(docsNode(older({ filter: (p) => !p.route.endsWith('/c') })).children)).toEqual(['/docs/v1/a', '/docs/v1/b'])
  })

  test('a flat list keeps to the version too', () => {
    const { hierarchy } = readVersion(docs(), '/docs/v1/guide')
    const list = routes(hierarchy({ nested: false })).filter((r) => r.startsWith('/docs'))
    expect(list).toEqual(['/docs/v1', '/docs/v1/start', '/docs/v1/guide'])
  })
})

describe('a site\'s search keeps to the version being read', () => {
  const original = globalThis.fetch
  afterEach(() => {
    globalThis.fetch = original
    vi.restoreAllMocks()
  })

  const entry = (route, text = 'configure the thing') => ({ id: route, type: 'page', route, href: route, title: text, pageTitle: text, content: text })

  function searchable(pages, activeRoute) {
    const tree = site(pages)
    tree.activePage = tree.pages.find((p) => p.route === activeRoute)
    return tree
  }

  const pages = () => [page('/about'), folder('/docs', 'Docs'), page('/docs/a'), page('/docs/only-new'), folder('/docs/v1', '1.x'), page('/docs/v1/a')]

  test('reading the latest, older versions are not found', async () => {
    const tree = searchable(pages(), '/docs/a')
    const transport = { query: async () => [entry('/docs/a'), entry('/docs/v1/a'), entry('/about')] }
    const client = createSearchClient(tree, { provider: 'mine', transports: { mine: transport } })
    const { results } = await client.queryWithTotal('configure')
    expect(results.map((r) => r.route)).toEqual(['/docs/a', '/about'])
  })

  test('reading an older version, its pages are found, and what no version has', async () => {
    const tree = searchable(pages(), '/docs/v1/a')
    const transport = { query: async () => [entry('/docs/a'), entry('/docs/v1/a'), entry('/about')] }
    const client = createSearchClient(tree, { provider: 'mine', transports: { mine: transport } })
    const { results } = await client.queryWithTotal('configure')
    expect(results.map((r) => r.route)).toEqual(['/docs/v1/a', '/about'])
  })

  test('with no match in an older version, it answers from the latest', async () => {
    const tree = searchable(pages(), '/docs/v1/a')
    const transport = { query: async () => [entry('/docs/only-new')] }
    const client = createSearchClient(tree, { provider: 'mine', transports: { mine: transport } })
    const { results } = await client.queryWithTotal('configure')
    expect(results.map((r) => r.route)).toEqual(['/docs/only-new'])
  })

  test('with no match reading the latest, it finds nothing rather than an older page', async () => {
    const tree = searchable(pages(), '/docs/a')
    const transport = { query: async () => [entry('/docs/v1/a')] }
    const client = createSearchClient(tree, { provider: 'mine', transports: { mine: transport } })
    const { results } = await client.queryWithTotal('configure')
    expect(results).toEqual([])
  })

  test('a count survives only when nothing was removed', async () => {
    const tree = searchable(pages(), '/docs/a')
    const whole = { query: async () => ({ results: [entry('/docs/a')], total: 7 }) }
    const narrowed = { query: async () => ({ results: [entry('/docs/a'), entry('/docs/v1/a')], total: 7 }) }
    expect((await createSearchClient(tree, { provider: 'a', transports: { a: whole } }).queryWithTotal('x')).total).toBe(7)
    expect((await createSearchClient(tree, { provider: 'a', transports: { a: narrowed } }).queryWithTotal('x')).total).toBeNull()
  })

  test('a site with no version folders asks with no filter at all', async () => {
    const tree = searchable([page('/a'), page('/b')], '/a')
    const query = vi.fn(async () => [entry('/a')])
    await createSearchClient(tree, { provider: 'a', transports: { a: { query } } }).query('x')
    expect(query.mock.calls[0][1].keep).toBeUndefined()
  })
})

/**
 * kit takes the content parser from `@uniweb/core`, never from `@uniweb/semantic-parser`.
 *
 * A foundation's build leaves the bare `@uniweb/core` for the runtime to supply, and bundles everything
 * else kit imports. So `parseContent`, `sanitizeSVG` and `isStyleName` taken from core are the
 * runtime's copy, the one Block parses every section with. Imported from the parser's own package, they
 * put a second copy into every foundation, frozen at the foundation's build while core moves on with
 * the runtime: a record's body parsed by one version and its section by another, and a fix to the SVG
 * allowlist missing from every icon the foundation draws.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import * as core from '@uniweb/core'

const KIT = fileURLToPath(new URL('..', import.meta.url))
const SRC = join(KIT, 'src')

/** An import or re-export of the parser's package, any subpath, static or dynamic. */
const PARSER_IMPORT = /(?:\bfrom\s*|\bimport\s*\(?\s*)['"]@uniweb\/semantic-parser(?:\/[^'"]*)?['"]/

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return sourceFiles(full)
    return /\.(?:js|jsx)$/.test(entry) ? [full] : []
  })
}

describe('kit takes the content parser from core', () => {
  it('imports nothing from @uniweb/semantic-parser', () => {
    const importing = sourceFiles(SRC)
      .filter((file) => PARSER_IMPORT.test(readFileSync(file, 'utf8')))
      .map((file) => relative(KIT, file))
    expect(importing, 'take parseContent, sanitizeSVG and isStyleName from @uniweb/core').toEqual([])
  })

  it('does not depend on the parser package', () => {
    const pkg = JSON.parse(readFileSync(join(KIT, 'package.json'), 'utf8'))
    const declared = Object.keys({ ...pkg.dependencies, ...pkg.peerDependencies })
    expect(declared).not.toContain('@uniweb/semantic-parser')
  })

  it('finds what it takes on core', () => {
    for (const name of ['parseContent', 'sanitizeSVG', 'isStyleName']) {
      expect(typeof core[name], name).toBe('function')
    }
  })
})

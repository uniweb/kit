/**
 * A grammar or theme name becomes part of a URL kit IMPORTS, so only a name
 * shaped like the corpus's own may reach one. A code fence's language is
 * content: until 2026-10-19 it went into the URL as written, and a language
 * holding path segments addressed a module outside the corpus.
 */

import { readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { isCorpusName, grammarUrl, themeUrl, loadGrammar, loadThemeByName } from '../src/styled/Section/renderers/shiki-corpus.js'

// The corpus kit loads from: the @shikijs packages of the Shiki release kit resolves.
const shikiDir = dirname(createRequire(import.meta.url).resolve('shiki/package.json'))
const corpusNames = (pkg) => {
  const dist = join(dirname(createRequire(join(shikiDir, 'package.json')).resolve(`@shikijs/${pkg}`)))
  return readdirSync(dist).filter((f) => f.endsWith('.mjs') && f !== 'index.mjs').map((f) => f.slice(0, -4))
}

describe('isCorpusName — the shape of every name in the corpus', () => {
  it('accepts every grammar and every theme Shiki ships', () => {
    const langs = corpusNames('langs')
    const themes = corpusNames('themes')
    expect(langs.length).toBeGreaterThan(300)
    expect(themes.length).toBeGreaterThan(60)
    expect(langs.filter((name) => !isCorpusName(name))).toEqual([])
    expect(themes.filter((name) => !isCorpusName(name))).toEqual([])
  })

  it('refuses anything that is not a name — a path, a URL, a space, a symbol', () => {
    for (const name of ['../x', '../../../some-package@1.0.0/dist/x', 'a/b', 'https://x', 'js fixed', 'c#', 'c++', 'a..b', '-x', 'x-', '', 'JS', null, 3]) {
      expect(isCorpusName(name), JSON.stringify(name)).toBe(false)
    }
  })
})

describe('a URL is built from a name, or not at all', () => {
  it('a grammar and a theme by name', async () => {
    expect(await grammarUrl('javascript')).toMatch(/\/@shikijs\/langs@[\d.]+\/dist\/javascript\.mjs$/)
    expect(await themeUrl('github-dark')).toMatch(/\/@shikijs\/themes@[\d.]+\/dist\/github-dark\.mjs$/)
  })

  it('⛔ a path is refused before anything is imported', async () => {
    await expect(grammarUrl('../../../some-package@1.0.0/dist/x')).rejects.toThrow(/not a grammar name/)
    await expect(loadGrammar('../../../some-package@1.0.0/dist/x')).rejects.toThrow(/not a grammar name/)
    await expect(themeUrl('../x')).rejects.toThrow(/not a theme name/)
    await expect(loadThemeByName('../x')).rejects.toThrow(/not a theme name/)
  })
})

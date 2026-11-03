/**
 * kit does not decide what anything is called.
 *
 * Kit is bundled into every foundation, for sites in any language, and it knows none of them. So a
 * word in kit is English on a site in Korean: `Open external link` on every link that left a site,
 * `Play video` on every video, `Close` on every dialog. Where a word comes from is a foundation's
 * to say, since some are built for one site and know their words and others read them from content.
 *
 * Kit prefers what needs no words: a role, a symbol, what the author already wrote. Where a word
 * would help, a component takes it as a prop with no default [Diego, 2026-11-02].
 *
 * One escape, requiring a stated reason, for text that is the same in every language or that a
 * reader never meets:
 *
 *   `kit-words-ok: <why>`    in a comment just above
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = fileURLToPath(new URL('../src', import.meta.url))

/** An attribute a reader or a screen reader meets, holding a word as a literal. */
const WORD_IN_ATTRIBUTE = /\b(?:aria-label|title|alt|placeholder)=(?:"[^"{]*\p{L}{2}|\{['"`][^'"`]*\p{L}{2})/u

/** A word that fills in when nothing was given: `alt={caption || 'Video thumbnail'}`. */
const WORD_AS_FALLBACK = /(?:\|\||\?\?)\s*['"`]\p{Lu}\p{Ll}+/u

/** Kit's own translation table: `localize({ en: …, fr: … })`. */
const OWN_TRANSLATIONS = /\blocalize\(\{|\ben:\s*['"`]/

/** Text between tags, as a `<p>Loading…</p>`. */
const WORD_BETWEEN_TAGS = /^\s*(?:<[^<>]+>)?\s*\p{Lu}\p{Ll}+(?:\s+\p{L}+)*\s*[.…!?]*\s*(?:<\/[^<>]+>)?\s*$/u

const CHECKS = [WORD_IN_ATTRIBUTE, WORD_AS_FALLBACK, OWN_TRANSLATIONS]

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return sourceFiles(full)
    return /\.jsx?$/.test(entry) ? [full] : []
  })
}

/** How far above a line the escape may sit. */
const ESCAPE_WINDOW = 3

const isComment = (line) => /^\s*(?:\/\/|\*|\/\*|\{\/\*)/.test(line)

function violationsIn(file) {
  const lines = readFileSync(file, 'utf8').split('\n')
  const excused = (i) => lines.slice(Math.max(0, i - ESCAPE_WINDOW), i).some((l) => /kit-words-ok:\s*\S/.test(l))
  const isJsx = file.endsWith('.jsx')

  const found = []
  lines.forEach((line, i) => {
    // An Error is read by a developer, and a foundation decides what to show of it.
    if (isComment(line) || excused(i) || /\bnew Error\(/.test(line)) return
    if (CHECKS.some((check) => check.test(line)) || (isJsx && WORD_BETWEEN_TAGS.test(line))) {
      found.push(`${relative(SRC, file)}:${i + 1}  ${line.trim()}`)
    }
  })
  return found
}

describe('kit supplies no words', () => {
  const files = sourceFiles(SRC)

  it('finds source to check', () => {
    expect(files.length).toBeGreaterThan(50)
  })

  it('has no word of its own anywhere a reader meets one', () => {
    expect(files.flatMap(violationsIn)).toEqual([])
  })

  it('still catches one when it appears', () => {
    expect(WORD_IN_ATTRIBUTE.test('<button aria-label="Close">')).toBe(true)
    expect(WORD_IN_ATTRIBUTE.test(`<button aria-label={'Fermer'}>`)).toBe(true)
    expect(WORD_IN_ATTRIBUTE.test('title="Vimeo video"')).toBe(true)
    expect(WORD_AS_FALLBACK.test(`alt={caption || 'Video thumbnail'}`)).toBe(true)
    expect(OWN_TRANSLATIONS.test(`title={localize({ en: 'Download' })}`)).toBe(true)
    expect(WORD_BETWEEN_TAGS.test('    <p>Loading results…</p>')).toBe(true)
    expect(WORD_BETWEEN_TAGS.test('      Read more')).toBe(true)
  })

  it('leaves a symbol, a prop and a value alone', () => {
    expect(WORD_IN_ATTRIBUTE.test(`aria-label={label || '▶'}`)).toBe(false)
    expect(WORD_IN_ATTRIBUTE.test('aria-label={closeLabel}')).toBe(false)
    expect(WORD_IN_ATTRIBUTE.test('alt=""')).toBe(false)
    expect(WORD_AS_FALLBACK.test(`title: result.title || ''`)).toBe(false)
    expect(OWN_TRANSLATIONS.test('localize(value)')).toBe(false)
    expect(WORD_BETWEEN_TAGS.test('    <p>{caption}</p>')).toBe(false)
    expect(WORD_BETWEEN_TAGS.test('    ×')).toBe(false)
  })
})

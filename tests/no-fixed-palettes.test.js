/**
 * kit does not decide what colour anything is.
 *
 * A foundation's whole job is to look like its site, and a site's theme.yml is
 * where that is decided. A fixed Tailwind palette in kit — `bg-white`,
 * `text-gray-500`, `border-gray-200` — quietly overrides that for every site
 * that touches the component. `SidebarLayout` was the case that proved it — the
 * one kit component built for documentation shells, unusable by any themed
 * site, so all three foundations that needed a docs shell wrote their own
 * instead. It has since been removed: a layout is a foundation's design, and
 * kit renders what the framework produces, not what a foundation designs.
 *
 * That rule was already written down (framework CLAUDE.md, gotcha #8) and it
 * decayed anyway, inside kit, where it reads as the sanctioned example. A
 * principle nothing enforces is a preference. So this is a test.
 *
 * Two escapes, both deliberate and both requiring a stated reason:
 *
 *   `kit-palette-ok: <why>`    in a comment just above, for a colour that
 *                              genuinely is not thematic — a modal scrim, a
 *                              video letterbox, a play control — where a token
 *                              would be wrong. The reason is the point: it is
 *                              what a reviewer checks.
 *
 * There was a second escape — a baseline of files that predated the rule, kept
 * as a ratchet so nothing new could be added while the debt was worked off. It
 * is gone, because the debt is paid: every fixed colour left in kit sits behind
 * a stated reason. A migration device that outlives its migration just becomes
 * a place to hide things.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = fileURLToPath(new URL('../src', import.meta.url))

const PALETTES =
  'gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose'
const PROPS = 'bg|text|border|ring|divide|from|to|via|fill|stroke|placeholder|decoration|outline|shadow|accent|caret'

const FIXED_PALETTE = new RegExp(
  `\\b(?:${PROPS})-(?:${PALETTES})-[0-9]{2,3}\\b|\\b(?:bg|text|border|fill|stroke|divide)-(?:white|black)\\b`,
  'g'
)

function sourceFiles(dir) {
  return readdirSync(dir).flatMap(entry => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return sourceFiles(full)
    return /\.jsx?$/.test(entry) ? [full] : []
  })
}

/**
 * How far above a line the escape may sit.
 *
 * Not one line: a reason worth stating rarely fits on one, and a JSX element
 * often puts two coloured lines next to each other. Both would force the
 * comment to be repeated verbatim, which is how a reason turns into a
 * rubber stamp. Three is enough for a sentence or a small adjacent group and
 * short enough that the comment is still visibly about the code beneath it.
 */
const ESCAPE_WINDOW = 3

function violationsIn(file) {
  const lines = readFileSync(file, 'utf8').split('\n')
  const found = []

  const excused = i =>
    lines.slice(Math.max(0, i - ESCAPE_WINDOW), i).some(l => /kit-palette-ok:\s*\S/.test(l))

  lines.forEach((line, i) => {
    const matches = line.match(FIXED_PALETTE)
    if (!matches) return
    if (excused(i)) return
    found.push(`${relative(SRC, file)}:${i + 1}  ${matches.join(' ')}`)
  })

  return found
}

describe('kit ships no fixed palettes', () => {
  const files = sourceFiles(SRC)

  it('finds source to check', () => {
    expect(files.length).toBeGreaterThan(50)
  })

  it('has no fixed palette anywhere', () => {
    expect(files.flatMap(violationsIn)).toEqual([])
  })

  it('still catches one when it appears', () => {
    // The rule is only worth having if it fails. Proving that here means a
    // future refactor of the matcher cannot quietly stop matching.
    const probe = ['const x = "bg-gray-200 text-white"'].join('\n')
    expect(probe.match(FIXED_PALETTE)).toEqual(['bg-gray-200', 'text-white'])
  })
})

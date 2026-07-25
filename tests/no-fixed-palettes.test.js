/**
 * kit does not decide what colour anything is.
 *
 * A foundation's whole job is to look like its site, and a site's theme.yml is
 * where that is decided. A fixed Tailwind palette in kit — `bg-white`,
 * `text-gray-500`, `border-gray-200` — quietly overrides that for every site
 * that touches the component. `SidebarLayout` is the case that proved it: the
 * one kit component built for documentation shells, unusable by any themed
 * site, so all three foundations that needed a docs shell wrote their own.
 *
 * That rule was already written down (framework CLAUDE.md, gotcha #8) and it
 * decayed anyway, inside kit, where it reads as the sanctioned example. A
 * principle nothing enforces is a preference. So this is a test.
 *
 * Two escapes, both deliberate and both requiring a stated reason:
 *
 *   `// kit-palette-ok: <why>`  on the line above, for a colour that genuinely
 *                              is not thematic — a modal scrim, a video
 *                              letterbox — where a token would be wrong.
 *
 *   BASELINE below             for files that predate the rule. This is a
 *                              ratchet, not absolution: nothing new gets added,
 *                              and what is already owed is visible and counted.
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

/**
 * Files that carried fixed palettes before this rule existed. Each is real debt
 * against the theming contract; converting them is a visual change to every
 * foundation, so it happens deliberately rather than in the commit that adds
 * the rule. Delete an entry when its file is converted — never add one.
 */
const BASELINE = new Map([
  ['hooks/useTheme.js', 'The pre-token theme-object helper itself. Retiring it is the conversion.'],
  ['hooks/useScrolled.js', 'Example classes in the docblock, not shipped markup.'],
  ['components/Asset/Asset.jsx', 'File-type chrome.'],
  ['components/FileLogo/FileLogo.jsx', 'Per-format brand colours — arguably correct, needs a decision.'],
  ['components/MediaIcon/MediaIcon.jsx', 'Per-format brand colours — same decision as FileLogo.'],
  ['styled/Asset/Asset.jsx', 'File-type chrome.'],
  ['styled/Disclaimer/Disclaimer.jsx', 'Fixed blue notice styling.'],
  ['styled/Media/Media.jsx', 'Letterboxing; black is probably right, the greys are not.'],
  ['styled/Section/Render.jsx', 'Link and caption colours in the document renderer.'],
  ['styled/Section/Section.jsx', 'Section surface fallbacks.'],
  ['styled/Section/renderers/Alert.jsx', 'Status colours — should move to the status tokens.'],
  ['styled/Section/renderers/Details.jsx', 'Border and summary chrome.'],
  ['styled/Section/renderers/Divider.jsx', 'Rule colour.'],
  ['styled/Section/renderers/Table.jsx', 'Header, stripe and divider colours.'],
])

function sourceFiles(dir) {
  return readdirSync(dir).flatMap(entry => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return sourceFiles(full)
    return /\.jsx?$/.test(entry) ? [full] : []
  })
}

function violationsIn(file) {
  const lines = readFileSync(file, 'utf8').split('\n')
  const found = []

  lines.forEach((line, i) => {
    const matches = line.match(FIXED_PALETTE)
    if (!matches) return
    // An explicit, reasoned escape on the line above.
    if (/kit-palette-ok:\s*\S/.test(lines[i - 1] ?? '')) return
    found.push(`${relative(SRC, file)}:${i + 1}  ${matches.join(' ')}`)
  })

  return found
}

describe('kit ships no fixed palettes', () => {
  const files = sourceFiles(SRC)

  it('finds source to check', () => {
    expect(files.length).toBeGreaterThan(50)
  })

  it('has no fixed palette outside the baseline', () => {
    const offenders = files
      .filter(file => !BASELINE.has(relative(SRC, file)))
      .flatMap(violationsIn)

    expect(offenders).toEqual([])
  })

  it('keeps the baseline honest — an entry that is clean must be deleted', () => {
    // The ratchet only tightens if a converted file cannot quietly stay listed.
    const stale = [...BASELINE.keys()].filter(rel => violationsIn(join(SRC, rel)).length === 0)

    expect(stale).toEqual([])
  })

  it('has converted SidebarLayout — the component the rule came from', () => {
    expect(violationsIn(join(SRC, 'styled/SidebarLayout/SidebarLayout.jsx'))).toEqual([])
  })
})

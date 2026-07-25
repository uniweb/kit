/**
 * `theme.yml`'s `code:` block reaching the highlighter.
 *
 * The block was documented and parsed for a long time without ever reaching a
 * rendered code listing: its keys were mapped onto `--shiki-*` CSS variables,
 * and Shiki writes its theme as an inline style, which no stylesheet outranks.
 * Nothing tested the declared value against the output, so nothing noticed.
 *
 * These assert on the theme Shiki is actually handed.
 */

import { buildCodeTheme, parseCodeConfig, SITE_CODE_THEME } from '../src/styled/Section/renderers/Code.jsx'

// Stands in for github-dark: a background, a foreground, and one scope rule.
const BASE = {
  name: 'github-dark',
  type: 'dark',
  bg: '#24292e',
  fg: '#e1e4e8',
  colors: { 'editor.background': '#24292e', 'editor.foreground': '#e1e4e8' },
  settings: [{ scope: 'comment', settings: { foreground: '#6a737d' } }],
}

const foregroundFor = (theme, scopeName) =>
  theme.settings.filter(rule => [].concat(rule.scope ?? []).includes(scopeName)).at(-1)
    ?.settings.foreground

describe('buildCodeTheme', () => {
  it('puts a declared background where Shiki reads it', () => {
    const theme = buildCodeTheme(BASE, { background: '#0D0D0D' })

    expect(theme.bg).toBe('#0D0D0D')
    expect(theme.colors['editor.background']).toBe('#0D0D0D')
  })

  it('keeps the base syntax colours when only the surface is declared', () => {
    // The common case by far — "the same highlighting, on my background".
    // Building a theme from the declared keys alone would answer it by
    // stripping every syntax colour.
    const theme = buildCodeTheme(BASE, { background: '#0D0D0D' })

    expect(foregroundFor(theme, 'comment')).toBe('#6a737d')
    expect(theme.fg).toBe('#e1e4e8')
  })

  it('maps each documented key onto its token scopes', () => {
    const theme = buildCodeTheme(BASE, {
      keyword: '#E35D25',
      string: '#8FB573',
      comment: '#5C5751',
      function: '#4FA3E3',
      tag: '#4FA3E3',
      attribute: '#D9A05B',
      number: '#D9A05B',
    })

    expect(foregroundFor(theme, 'keyword')).toBe('#E35D25')
    expect(foregroundFor(theme, 'string')).toBe('#8FB573')
    expect(foregroundFor(theme, 'entity.name.function')).toBe('#4FA3E3')
    expect(foregroundFor(theme, 'entity.name.tag')).toBe('#4FA3E3')
    expect(foregroundFor(theme, 'entity.other.attribute-name')).toBe('#D9A05B')
    expect(foregroundFor(theme, 'constant.numeric')).toBe('#D9A05B')
  })

  it('lets a declared scope override the base rather than sit behind it', () => {
    const theme = buildCodeTheme(BASE, { comment: '#5C5751' })

    expect(foregroundFor(theme, 'comment')).toBe('#5C5751')
  })

  it('adds no rule for a key the site did not declare', () => {
    const theme = buildCodeTheme(BASE, { background: '#0D0D0D' })

    expect(theme.settings).toHaveLength(BASE.settings.length)
  })

  it('names itself so the highlighter can be pointed at it', () => {
    expect(buildCodeTheme(BASE, { background: '#000' }).name).toBe(SITE_CODE_THEME)
  })

  it('does not mutate the base theme', () => {
    buildCodeTheme(BASE, { background: '#0D0D0D', keyword: '#E35D25' })

    expect(BASE.bg).toBe('#24292e')
    expect(BASE.settings).toHaveLength(1)
    expect(BASE.colors['editor.background']).toBe('#24292e')
  })
})

describe('parseCodeConfig — the three forms a site can write', () => {
  it('defaults to one bundled theme when a site says nothing', () => {
    const c = parseCodeConfig(undefined)
    expect(c.light).toEqual({ base: 'github-dark', overrides: {} })
    expect(c.dark).toBeUndefined()
  })

  it('takes a bare theme name', () => {
    // The form most sites want: 65 themes ship inside Shiki, and picking one is
    // a job a site owner can actually do.
    expect(parseCodeConfig('dracula').light).toEqual({ base: 'dracula', overrides: {} })
  })

  it('takes a light/dark pair, by name', () => {
    const c = parseCodeConfig({ light: 'github-light', dark: 'github-dark' })
    expect(c.light.base).toBe('github-light')
    expect(c.dark.base).toBe('github-dark')
  })

  it('fills in a missing side of a pair rather than half-configuring', () => {
    const c = parseCodeConfig({ dark: 'nord' })
    expect(c.light.base).toBe('nord')
    expect(c.dark.base).toBe('nord')
  })

  it('reads a colour map as overrides on the default base', () => {
    // The escape hatch. Still supported, no longer the only way in.
    const c = parseCodeConfig({ background: '#0D0D0D', keyword: '#E35D25' })
    expect(c.light.base).toBe('github-dark')
    expect(c.light.overrides).toEqual({ background: '#0D0D0D', keyword: '#E35D25' })
  })

  it('reads a named base with colours overridden — "that theme, on my surface"', () => {
    const c = parseCodeConfig({ theme: 'nord', background: '#0D0D0D' })
    expect(c.light.base).toBe('nord')
    expect(c.light.overrides).toEqual({ background: '#0D0D0D' })
  })

  it('allows overrides on each side of a pair', () => {
    const c = parseCodeConfig({
      light: { theme: 'github-light', background: '#FFFDF9' },
      dark: 'github-dark',
    })
    expect(c.light).toEqual({ base: 'github-light', overrides: { background: '#FFFDF9' } })
    expect(c.dark).toEqual({ base: 'github-dark', overrides: {} })
  })
})

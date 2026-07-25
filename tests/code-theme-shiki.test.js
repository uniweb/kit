/**
 * The declaration → output test.
 *
 * code-theme.test.js checks the theme object we hand Shiki. This one checks
 * that Shiki accepts it and that the declared colours come out the other end,
 * because the bug being fixed lived exactly in that gap: the keys were read,
 * an object was built from them, and the rendered HTML never showed them.
 *
 * It loads real Shiki, so it is the slowest test in the package. That is the
 * price of asserting on output instead of plumbing.
 */

import { buildCodeTheme, parseCodeConfig, SITE_CODE_THEME } from '../src/styled/Section/renderers/Code.jsx'

const SOURCE = 'const x = 1 // note'
const styleOf = html => html.match(/<pre[^>]*style="([^"]*)"/)?.[1] ?? ''

// A fresh highlighter per test on purpose. Shiki keeps the first theme
// registered under a given name and ignores a later one with the same name —
// which is also why the component registers the site theme exactly once — so a
// shared instance would silently answer the second test with the first
// test's theme.
async function freshHighlighter() {
  const { createHighlighter } = await import('shiki/bundle/full')
  return createHighlighter({ themes: ['github-dark'], langs: ['javascript'] })
}

describe('a site\'s code: declaration reaches the rendered listing', () => {
  it('paints the surface the site asked for', async () => {
    const highlighter = await freshHighlighter()
    const base = highlighter.getTheme('github-dark')
    expect(styleOf(highlighter.codeToHtml(SOURCE, { lang: 'javascript', theme: 'github-dark' })))
      .toContain('#24292e')

    await highlighter.loadTheme(buildCodeTheme(base, { background: '#0D0D0D', foreground: '#C0C0C0' }))
    const html = highlighter.codeToHtml(SOURCE, { lang: 'javascript', theme: SITE_CODE_THEME })

    expect(styleOf(html)).toContain('#0D0D0D')
    expect(styleOf(html)).toContain('#C0C0C0')
  })

  it('colours the tokens the site named, and leaves the rest to the base', async () => {
    const highlighter = await freshHighlighter()
    await highlighter.loadTheme(
      buildCodeTheme(highlighter.getTheme('github-dark'), { keyword: '#E35D25', comment: '#5C5751' })
    )
    const html = highlighter.codeToHtml(SOURCE, { lang: 'javascript', theme: SITE_CODE_THEME })

    expect(html).toContain('#E35D25') // `const`
    expect(html).toContain('#5C5751') // `// note`
    // Untouched scopes still carry github-dark's colours rather than going flat.
    expect(html).toMatch(/#79b8ff|#9ecbff|#b392f0|#e1e4e8/i)
  })
})

describe('each form reaches Shiki as the right output', () => {
  // resolveThemeOptions is internal; this exercises the same composition a
  // render does, against real Shiki, so the wiring is proven end to end.
  async function render(code, source = 'const x = 1 // hi') {
    const highlighter = await freshHighlighter()
    const config = parseCodeConfig(code)

    const side = async (s, name) => {
      if (!highlighter.getLoadedThemes().includes(s.base)) await highlighter.loadTheme(s.base)
      if (!Object.keys(s.overrides).length) return s.base
      await highlighter.loadTheme({ ...buildCodeTheme(highlighter.getTheme(s.base), s.overrides), name })
      return name
    }

    const light = await side(config.light, 'probe-light')
    const opts = config.dark
      ? { themes: { light, dark: await side(config.dark, 'probe-dark') }, defaultColor: false }
      : { theme: light }

    return highlighter.codeToHtml(source, { lang: 'javascript', ...opts })
  }

  it('a named theme paints that theme, inline', async () => {
    const html = await render('github-light')
    expect(styleOf(html)).toContain('#fff')       // github-light's background
    expect(html).not.toContain('--shiki-light')   // one theme: no variables
  })

  it('a pair emits CSS variables instead of inline colour', async () => {
    // This is what `defaultColor: false` buys, and the only way one rendered
    // block can follow the visitor's light/dark choice.
    const html = await render({ light: 'github-light', dark: 'github-dark' })

    expect(styleOf(html)).toContain('--shiki-light')
    expect(styleOf(html)).toContain('--shiki-dark')
    expect(html).toMatch(/<span style="--shiki-light:#[0-9A-Fa-f]{6};--shiki-dark:#[0-9A-Fa-f]{6}"/)
  })

  it('a named base with an override keeps the theme and moves the surface', async () => {
    const html = await render({ theme: 'github-light', background: '#FFFDF9' })

    expect(styleOf(html)).toContain('#FFFDF9')
    // github-light's own token colours survive — only the ground moved.
    expect(html).toMatch(/#D73A49|#005CC5|#6A737D/i)
  })

  it('overrides apply per side of a pair', async () => {
    const html = await render({
      light: { theme: 'github-light', background: '#FFFDF9' },
      dark: { theme: 'github-dark', background: '#0D0D0D' },
    })

    expect(styleOf(html)).toContain('--shiki-light-bg:#FFFDF9')
    expect(styleOf(html)).toContain('--shiki-dark-bg:#0D0D0D')
  })
})

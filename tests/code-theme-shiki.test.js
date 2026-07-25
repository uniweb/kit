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

import { buildCodeTheme, SITE_CODE_THEME } from '../src/styled/Section/renderers/Code.jsx'

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

/**
 * A code block is one <pre>, the same before and after the highlighter paints.
 *
 * The prerender and the browser's first render write the code as text; when
 * Shiki arrives, only the text inside <code> becomes token spans. If the two
 * states drew different boxes, the page would move when the colours arrived —
 * which it did until 2026-10-19 (each block grew 34px inside prose). These pin
 * what makes the box the same: the element, its classes, its colours, its text.
 * The layout itself was measured in Chrome; markup is what a unit test can hold.
 */

import { readFileSync } from 'node:fs'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  Code,
  CodeBlock,
  CODE_BLOCK_CLASS,
  CODE_FACE_CLASS,
  DEFAULT_THEME_COLORS,
  buildCodeTheme,
  knownCodeColors,
  toHighlighted,
  SITE_CODE_THEME,
} from '../src/styled/Section/renderers/Code.jsx'

const SOURCE = 'function sum(values) {\n  let total = 0 // running\n  return total\n}'

const openTag = (html, tag) => html.match(new RegExp(`<${tag}[^>]*>`))?.[0]
const textOf = (html) =>
  html.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&')

// A fresh highlighter per test: Shiki keeps the first theme registered under a
// name, so a shared one would answer a later test with an earlier theme.
async function freshHighlighter() {
  const { createHighlighter } = await import('shiki/bundle/full')
  return createHighlighter({ themes: ['github-dark', 'github-light'], langs: ['javascript'] })
}

const draw = (props) => renderToStaticMarkup(<CodeBlock content={SOURCE} lang="javascript" {...props} />)

describe('the default theme paints its own colours before it loads', () => {
  it('kit’s copy of github-dark’s ground and text is the Shiki release’s', async () => {
    const theme = (await freshHighlighter()).getTheme('github-dark')
    expect(DEFAULT_THEME_COLORS.background).toBe(theme.bg.toLowerCase())
    expect(DEFAULT_THEME_COLORS.foreground).toBe(theme.fg.toLowerCase())
  })
})

describe('knownCodeColors — what a block can paint before its theme loads', () => {
  it('the default theme, when a site says nothing', () => {
    expect(knownCodeColors(undefined)).toEqual(DEFAULT_THEME_COLORS)
  })

  it('the colours a site declares', () => {
    expect(knownCodeColors({ background: '#0D0D0D', foreground: '#C0C0C0' })).toEqual({
      background: '#0D0D0D',
      foreground: '#C0C0C0',
    })
    expect(knownCodeColors({ theme: 'dracula', background: '#101010', foreground: '#eeeeee' })).toEqual({
      background: '#101010',
      foreground: '#eeeeee',
    })
  })

  it('a declared ground on the default theme keeps the default’s text, as the derived theme does', () => {
    expect(knownCodeColors({ background: '#1c1917' })).toEqual({
      background: '#1c1917',
      foreground: DEFAULT_THEME_COLORS.foreground,
    })
  })

  it('nothing for another theme named without its colours, or for a pair — both colours or neither', () => {
    expect(knownCodeColors('dracula')).toBeNull()
    expect(knownCodeColors({ theme: 'dracula', background: '#101010' })).toBeNull()
    expect(knownCodeColors({ light: 'github-light', dark: 'github-dark' })).toBeNull()
  })
})

describe('⭐ one <pre>, the same before and after', () => {
  it('the default theme: the same element, classes and colours — and the same text', async () => {
    const highlighter = await freshHighlighter()
    const before = draw({ colors: knownCodeColors(undefined) })
    const after = draw({
      colors: knownCodeColors(undefined),
      highlighted: toHighlighted(highlighter.codeToTokens(SOURCE, { lang: 'javascript', theme: 'github-dark' }), false),
    })

    expect(openTag(after, 'pre')).toBe(openTag(before, 'pre'))
    expect(openTag(after, 'code')).toBe(openTag(before, 'code'))
    expect(openTag(before, 'pre')).toContain('style="background-color:#24292e;color:#e1e4e8"')
    expect(textOf(before)).toBe(SOURCE)
    expect(textOf(after)).toBe(SOURCE)
    // The tokens are coloured spans inside the same <code>, a `.line` per line.
    expect(after.match(/<span class="line">/g)).toHaveLength(4)
    expect(after).toMatch(/<span style="color:#F97583">function<\/span>/i)
    // Exactly one of each — no wrapper around the <pre>.
    expect(after.match(/<pre/g)).toHaveLength(1)
    expect(after.startsWith('<pre')).toBe(true)
  })

  it('a site’s declared colours: painted first, and the derived theme paints the same', async () => {
    const highlighter = await freshHighlighter()
    const code = { background: '#0D0D0D', foreground: '#C0C0C0' }
    await highlighter.loadTheme(buildCodeTheme(highlighter.getTheme('github-dark'), code))
    const tokens = highlighter.codeToTokens(SOURCE, { lang: 'javascript', theme: SITE_CODE_THEME })

    const before = draw({ colors: knownCodeColors(code) })
    const after = draw({ colors: knownCodeColors(code), highlighted: toHighlighted(tokens, false) })
    expect(openTag(after, 'pre')).toBe(openTag(before, 'pre'))
    expect(openTag(before, 'pre')).toContain('background-color:#0D0D0D;color:#C0C0C0')
  })

  it('a text that ends in a line break keeps it, so the line count cannot change', async () => {
    const highlighter = await freshHighlighter()
    const source = 'const a = 1\n'
    const after = renderToStaticMarkup(
      <CodeBlock
        content={source}
        lang="javascript"
        highlighted={toHighlighted(highlighter.codeToTokens(source, { lang: 'javascript', theme: 'github-dark' }), false)}
      />
    )
    expect(textOf(after)).toBe(source)
  })

  it('a pair: its variables and `shiki-themes` arrive with the tokens; the box classes do not change', async () => {
    const highlighter = await freshHighlighter()
    const tokens = highlighter.codeToTokens(SOURCE, {
      lang: 'javascript',
      themes: { light: 'github-light', dark: 'github-dark' },
      defaultColor: false,
    })
    const before = draw({ colors: null })
    const after = draw({ highlighted: toHighlighted(tokens, true) })

    expect(openTag(before, 'pre')).not.toContain('style=')
    expect(openTag(after, 'pre')).toContain('--shiki-light-bg:#fff')
    expect(openTag(after, 'pre')).toContain('--shiki-dark-bg:#24292e')
    expect(openTag(after, 'pre')).toContain('shiki-themes')
    expect(after).toMatch(/<span style="--shiki-light:#[0-9A-Fa-f]{6};--shiki-dark:#[0-9A-Fa-f]{6}">/)
    const classes = (html) => openTag(html, 'pre').match(/class="([^"]*)"/)[1].split(' ').filter((c) => c !== 'shiki-themes')
    expect(classes(after)).toEqual(classes(before))
  })

  it('a token’s font style, as Shiki’s own renderer writes it', () => {
    const html = draw({
      highlighted: {
        tokens: [[{ content: 'note', color: '#6a737d', fontStyle: 1 }, { content: ' x', color: '#e1e4e8', fontStyle: -1 }]],
        style: {},
        pair: false,
      },
    })
    expect(html).toContain('<span style="color:#6a737d;font-style:italic">note</span>')
    expect(html).toContain('<span style="color:#e1e4e8"> x</span>') // NotSet (-1) is no style
  })
})

describe('what the first render writes — the prerender’s page', () => {
  it('one <pre> with the default theme’s colours, and the foundation’s className on it', () => {
    const html = renderToStaticMarkup(<Code content={SOURCE} language="js" className="rounded-none" />)
    expect(html.startsWith('<pre')).toBe(true)
    expect(openTag(html, 'pre')).toContain('style="background-color:#24292e;color:#e1e4e8"')
    expect(openTag(html, 'pre')).toContain('rounded-none')
    expect(openTag(html, 'pre')).not.toContain('rounded-lg') // the className wins over kit's corners
    // The face is the site's code role, on the <code> itself — the reset gives <code> its own.
    expect(openTag(html, 'code')).toBe(`<code class="language-javascript ${CODE_FACE_CLASS}">`)
    expect(textOf(html)).toBe(SOURCE)
  })
})

describe('the size reads the prose step', () => {
  it('every variable the block’s classes read is one the prose layer sets on `.prose`', () => {
    const css = readFileSync(new URL('../src/prose-tokens.css', import.meta.url), 'utf8')
    const container = css.slice(css.indexOf('  .prose {'), css.indexOf('}', css.indexOf('  .prose {')))
    const read = [...CODE_BLOCK_CLASS.matchAll(/var\((--_prose-[a-z-]+)/g)].map((m) => m[1])
    expect(read).toEqual(['--_prose-small', '--_prose-pre-leading'])
    for (const name of read) expect(container).toContain(`${name}:`)
  })
})

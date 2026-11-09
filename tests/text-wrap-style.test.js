/**
 * Kit says how text wraps, never whether it does: its rules set `text-wrap-style`, never the `text-wrap`
 * shorthand.
 *
 * The shorthand also sets `text-wrap-mode: wrap` on the element, and `white-space: nowrap` sets that
 * same property on the box around it, by inheritance. So `text-wrap: balance` on every heading made a
 * heading inside a nowrap box wrap. Measured 2026-11-09 in a 120px nowrap box: a paragraph took 3 lines
 * in Chromium 156 and WebKit 27.2, a heading 4 in those and Firefox 157, and one line each with the
 * longhand. Kit 1.7.15 and 1.7.16 shipped the shorthand outside prose; the prose layer had it since
 * 2026-10-19.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

const SRC = fileURLToPath(new URL('../src', import.meta.url))
const stylesheets = readdirSync(SRC).filter((f) => f.endsWith('.css'))

/** A `text-wrap:` declaration: the shorthand, not one of its longhands. */
const SHORTHAND = /(^|[\s;{])text-wrap\s*:/m

describe('kit sets the style of wrapping, never whether text wraps', () => {
  it('reads its stylesheets', () => {
    expect(stylesheets).toContain('theme-tokens.css')
    expect(stylesheets).toContain('prose-tokens.css')
  })

  it.each(stylesheets)('%s declares no `text-wrap` shorthand', (file) => {
    const css = readFileSync(join(SRC, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    expect(SHORTHAND.test(css), 'use text-wrap-style: balance | pretty').toBe(false)
  })

  it('balances headings and prettifies paragraphs by the longhand', () => {
    const css = readFileSync(join(SRC, 'theme-tokens.css'), 'utf8')
    expect(css).toMatch(/:where\(h1, h2, h3, h4, h5, h6\) \{\s*text-wrap-style: balance;/)
    expect(css).toMatch(/:where\(p\) \{\s*text-wrap-style: pretty;/)
  })
})

/**
 * Where an anchor lands: below how far the site's header reaches.
 *
 * `useHeadings` reads it from the page — `--uw-sticky-top` when the runtime has measured a header
 * that sticks, else the foundation's declared `--header-height` — as a CSS length. ⛔ Until
 * 2026-10-20 the declared value was read with `parseInt`, so `4rem`, how the starter templates
 * declare it, came out as 4.
 */

import { lengthInPx } from '../src/hooks/useHeadings.js'

describe('lengthInPx — a CSS length as the page measures it', () => {
  it('px as written; rem and em against the root size', () => {
    expect(lengthInPx('64px')).toBe(64)
    expect(lengthInPx(' 64.5px ')).toBe(64.5)
    expect(lengthInPx('4rem')).toBe(64)
    expect(lengthInPx('3.5rem', 16)).toBe(56)
    expect(lengthInPx('4rem', 20)).toBe(80)
    expect(lengthInPx('2em')).toBe(32)
  })

  it('anything it cannot read is 0, never a guess', () => {
    for (const value of ['', undefined, null, 'calc(4rem + 1px)', 'var(--x)', 'auto']) expect(lengthInPx(value), String(value)).toBe(0)
  })
})

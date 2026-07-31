/**
 * What a `[#id]` marker renders as.
 *
 * The registry side of cross-references was complete and the render side was
 * not: every path in `Ref` returned a `<span>`, and no element emitted the
 * author's `{#id}`, so a reference resolved to "Equation 1" and pointed at
 * nothing. On the web that reads as prose someone typed — the feature works
 * and is invisible, which is exactly how the first reader took it (2026-07-31).
 *
 * These pin the navigable half. The label text itself is print-shaped and
 * unchanged: kit still decides the wording from the style preset.
 */

import React from 'react'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { buildXrefRegistry } from '../src/xref/registry.js'
import { Ref } from '../src/xref/Ref.jsx'

/** A Website shaped the way buildXrefRegistry walks it. */
function websiteWith(...sequence) {
  return {
    config: {},
    pages: [{ route: '/p', bodyBlocks: [{ parsedContent: { sequence } }] }],
  }
}

function render(website, key) {
  const block = { website }
  return renderToStaticMarkup(<Ref params={{ key }} block={block} />)
}

describe('a resolved reference is navigable', () => {
  it('links a single target to its anchor', () => {
    const website = websiteWith({ type: 'math', display: true, id: 'eq-energy', latex: 'E=mc^2' })
    buildXrefRegistry(website)

    const out = render(website, '#eq-energy')
    expect(out).toMatch(/<a[^>]+href="#eq-energy"/)
    expect(out).toMatch(/class="xref"/)
    expect(out).toContain('Equation 1')
  })

  it('uses the id, not the label, as the href', () => {
    // The label is presentation and changes with the style preset; the id is
    // identity. Linking to a slug of "Figure 1" would break the moment a site
    // switched preset or inserted an earlier figure.
    const website = websiteWith({ type: 'image', attrs: { id: 'fig-cell', src: '/c.png' } })
    buildXrefRegistry(website)

    expect(render(website, '#fig-cell')).toMatch(/href="#fig-cell"/)
  })

  it('links each counter in a cluster separately', () => {
    // "Figures 1 and 2" is one label over two targets, so the label cannot sit
    // inside a link — but each number can, and each points at its own element.
    const website = websiteWith(
      { type: 'image', attrs: { id: 'fig-a', src: '/a.png' } },
      { type: 'image', attrs: { id: 'fig-b', src: '/b.png' } },
    )
    buildXrefRegistry(website)

    const out = render(website, '#fig-a;#fig-b')
    expect(out).toMatch(/href="#fig-a"[^>]*>1</)
    expect(out).toMatch(/href="#fig-b"[^>]*>2</)
    // The plural label stays outside the links, and the prose reads correctly.
    expect(out.replace(/<[^>]+>/g, '')).toBe('Figures 1 and 2')
  })

  it('punctuates three or more as prose', () => {
    const website = websiteWith(
      { type: 'image', attrs: { id: 'fig-a', src: '/a.png' } },
      { type: 'image', attrs: { id: 'fig-b', src: '/b.png' } },
      { type: 'image', attrs: { id: 'fig-c', src: '/c.png' } },
    )
    buildXrefRegistry(website)

    const out = render(website, '#fig-a;#fig-b;#fig-c')
    expect(out.replace(/<[^>]+>/g, '')).toBe('Figures 1, 2, and 3')
    expect(out.match(/<a /g)).toHaveLength(3)
  })

  it('links the resolved half of a cluster and leaves the typo visible', () => {
    const website = websiteWith({ type: 'image', attrs: { id: 'fig-a', src: '/a.png' } })
    buildXrefRegistry(website)

    const out = render(website, '#fig-a;#fig-typo')
    expect(out).toMatch(/href="#fig-a"/)
    expect(out).toContain('[?fig-typo]')
    expect(out.replace(/<[^>]+>/g, '')).toBe('Figure 1, [?fig-typo]')
  })

  it('links each part of a mixed-kind cluster to its own target', () => {
    const website = websiteWith(
      { type: 'image', attrs: { id: 'fig-a', src: '/a.png' } },
      { type: 'math', display: true, id: 'eq-a', latex: 'x' },
    )
    buildXrefRegistry(website)

    const out = render(website, '#fig-a;#eq-a')
    expect(out).toMatch(/href="#fig-a"/)
    expect(out).toMatch(/href="#eq-a"/)
    // Each keeps its own singular label, since they are different kinds.
    expect(out.replace(/<[^>]+>/g, '')).toBe('Figure 1, Equation 1')
  })

  it('does not link an id that was never declared', () => {
    // A dead link is worse than visible breakage: it looks like it works.
    const website = websiteWith({ type: 'image', attrs: { id: 'fig-a', src: '/a.png' } })
    buildXrefRegistry(website)

    const out = render(website, '#fig-typo')
    expect(out).not.toMatch(/<a\b/)
    expect(out).toContain('[?fig-typo]')
  })
})

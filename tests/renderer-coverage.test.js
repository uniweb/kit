/**
 * What each renderer handles, written down so divergence fails a test rather
 * than being discovered.
 *
 * kit has two renderers with different jobs and different inputs:
 *
 *   Render — the DOCUMENT renderer. Walks raw ProseMirror nodes
 *            (`block.rawContent`). Use it for document-shaped content: a
 *            markdown file rendered whole, a mounted docs page.
 *
 *   Prose  — the SEQUENCE renderer. Walks `content.sequence`, what the
 *            semantic parser produces after splitting a section into title,
 *            items, paragraphs. Use it for section content.
 *
 * The two are not interchangeable, and nothing said so. Reaching for Prose to
 * render a document silently drops every table, because Prose has no table
 * case — a fact only readable by opening both files. This test makes the
 * difference explicit, and makes an accidental change to either one loud.
 *
 * Adding a case to a renderer? Add it here. If it belongs in both, put it in
 * both — that is the point of the shared list.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const read = rel => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

const casesIn = source => new Set([...source.matchAll(/case '([a-zA-Z_]+)'/g)].map(m => m[1]))

// Inline marks, not block nodes — Render handles them in its own switch.
const MARKS = new Set(['bold', 'strong', 'italic', 'em', 'code', 'link', 'text'])

const renderCases = casesIn(read('../src/styled/Section/Render.jsx'))
const proseCases = casesIn(read('../src/styled/Prose/index.jsx'))

/** Block-level node types Render is expected to handle. */
const RENDER_NODES = [
  'paragraph', 'heading', 'image', 'video', 'codeBlock',
  'blockquote', 'bulletList', 'orderedList', 'table', 'details',
  'alert', 'warning', 'divider', 'horizontalRule', 'button',
  // `inset_placeholder` is the leaf inset's slot; `inset_block` is the
  // block-bodied container (a ```@Component{params} fence). Both resolve a
  // component reference — one has children, the other does not.
  'inset_placeholder', 'inset_block',
]

/** Sequence element types Prose is expected to handle. */
const PROSE_ELEMENTS = [
  'paragraph', 'heading', 'image', 'video', 'codeBlock',
  'blockquote', 'list', 'divider', 'button', 'link',
  'inset', 'icon', 'math', 'dataBlock', 'inset_block',
]

describe('Render — the document renderer', () => {
  it.each(RENDER_NODES)('handles %s', node => {
    expect(renderCases).toContain(node)
  })

  it('handles every documented node and nothing undocumented', () => {
    const blockCases = [...renderCases].filter(name => !MARKS.has(name))
    expect(blockCases.sort()).toEqual([...RENDER_NODES].sort())
  })
})

describe('Prose — the sequence renderer', () => {
  it.each(PROSE_ELEMENTS)('handles %s', element => {
    expect(proseCases).toContain(element)
  })

  it('handles every documented element and nothing undocumented', () => {
    expect([...proseCases].sort()).toEqual([...PROSE_ELEMENTS].sort())
  })
})

describe('a container names FOUNDATION vocabulary, not kit vocabulary', () => {
  // The rule a leaf inset already follows: `inset_placeholder` resolves via
  // `block.getInset()`, and that Block looks its component up on the
  // foundation. kit's own Details and Alert have never been reachable that
  // way, and an `@Component` container must not make them reachable — a
  // foundation shipping its own Alert would be shadowed by ours, which
  // inverts who owns a site's vocabulary.
  //
  // This is source-level on purpose. The dispatch it forbids was three lines
  // inside a `case`, invisible to every behavioural test in this package, and
  // it shipped. A grep-shaped assertion is what would have caught it.
  const containerCase = source => {
    const start = source.indexOf("case 'inset_block'")
    expect(start).toBeGreaterThan(-1)
    return source.slice(start, source.indexOf('\n    }', start))
  }

  it.each([
    ['Render', '../src/styled/Section/Render.jsx'],
    ['Prose', '../src/styled/Prose/index.jsx'],
  ])('%s does not map a container name to a kit component', (_name, path) => {
    const body = containerCase(read(path))
    // No comparison of the component name against a name kit implements.
    expect(body).not.toMatch(/===\s*'(Details|Alert|Warning)'/)
    // And the unresolved case still keeps the body — visible, never a drop.
    expect(body).toMatch(/data-inset-block=/)
    expect(body).toMatch(/\{body\}/)
  })

  it('kit still renders the editor DOCUMENT node types, which are its job', () => {
    // The other half of the distinction: `details` / `alert` / `warning` are
    // node types a document format has, and giving them a standard
    // presentation on the sequential path is exactly what Prose and Article
    // are for. Only the `@Component` reference belongs to the foundation.
    for (const node of ['details', 'alert', 'warning']) {
      expect(renderCases).toContain(node)
    }
  })
})

describe('the difference between them is deliberate', () => {
  it('records what only the document renderer handles', () => {
    // Tables above all. A document body rendered with Prose loses them
    // silently, which is exactly the trap this file exists to make visible.
    const onlyRender = RENDER_NODES.filter(n => !proseCases.has(n))

    expect(onlyRender).toEqual([
      'bulletList', 'orderedList', 'table', 'details',
      'alert', 'warning', 'horizontalRule', 'inset_placeholder',
    ])
    // `inset_block` is deliberately NOT in that list: a container carries
    // authored prose, so both renderers must handle it or a page section
    // rendered with Prose loses the body — the trap this file exists for.
    expect(proseCases.has('inset_block')).toBe(true)
  })

  it('records what only the sequence renderer handles', () => {
    // These are shapes the semantic parser produces; they have no raw
    // ProseMirror equivalent for Render to meet.
    const onlyProse = PROSE_ELEMENTS.filter(e => !renderCases.has(e))

    expect(onlyProse).toEqual(['list', 'inset', 'icon', 'math', 'dataBlock'])
  })

  it('agrees on the core of a document', () => {
    const shared = ['paragraph', 'heading', 'image', 'video', 'codeBlock', 'blockquote', 'divider', 'button']

    for (const node of shared) {
      expect(renderCases).toContain(node)
      expect(proseCases).toContain(node)
    }
  })
})

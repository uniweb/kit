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
  'inset_placeholder',
]

/** Sequence element types Prose is expected to handle. */
const PROSE_ELEMENTS = [
  'paragraph', 'heading', 'image', 'video', 'codeBlock',
  'blockquote', 'list', 'divider', 'button', 'link',
  'inset', 'icon', 'math', 'dataBlock',
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

describe('the difference between them is deliberate', () => {
  it('records what only the document renderer handles', () => {
    // Tables above all. A document body rendered with Prose loses them
    // silently, which is exactly the trap this file exists to make visible.
    const onlyRender = RENDER_NODES.filter(n => !proseCases.has(n))

    expect(onlyRender).toEqual([
      'bulletList', 'orderedList', 'table', 'details',
      'alert', 'warning', 'horizontalRule', 'inset_placeholder',
    ])
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

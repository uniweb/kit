/**
 * Heading anchors, and the pieces a table of contents is built from.
 *
 * The id generator is shared on purpose: a contents rail scrolls to an id that
 * a renderer stamped, so two implementations are drift waiting to happen — and
 * there were two, differing over whether markup was stripped first, which
 * decided whether a heading containing a link got a usable anchor at all.
 */

import { headingId, nodeText } from '../src/utils/index.js'

describe('headingId', () => {
  it('slugifies a plain heading', () => {
    expect(headingId('Getting Started')).toBe('getting-started')
  })

  it('strips markup before slugifying', () => {
    // The divergence between the two old generators. Render fed it plain text
    // and Prose fed it HTML, so only one of them stripped — and a heading with
    // a link or inline code got a slug full of tag names from the other.
    expect(headingId('Using <code>site.yml</code>')).toBe('using-site-yml')
    expect(headingId('See <a href="/x">the guide</a>')).toBe('see-the-guide')
  })

  it('collapses punctuation and trims the edges', () => {
    expect(headingId('  What is Uniweb?  ')).toBe('what-is-uniweb')
    expect(headingId('site.yml / page.yml')).toBe('site-yml-page-yml')
  })

  it('survives nothing useful', () => {
    expect(headingId('')).toBe('')
    expect(headingId(null)).toBe('')
    expect(headingId(undefined)).toBe('')
  })

  it('agrees with itself for the same text from either renderer', () => {
    // Render passes flattened node text; Prose passes HTML for the same heading.
    const fromRender = headingId('Adding a Page')
    const fromProse = headingId('Adding a <em>Page</em>')

    expect(fromRender).toBe(fromProse)
  })
})

describe('nodeText', () => {
  it('flattens a ProseMirror heading to its text', () => {
    const heading = {
      type: 'heading',
      attrs: { level: 2 },
      content: [
        { type: 'text', text: 'Using ' },
        { type: 'text', text: 'site.yml', marks: [{ type: 'code' }] },
      ],
    }

    expect(nodeText(heading)).toBe('Using site.yml')
  })

  it('gives an id that matches what the renderer stamps', () => {
    const heading = { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Quick Start' }] }

    expect(headingId(nodeText(heading))).toBe('quick-start')
  })

  it('survives an empty or malformed node', () => {
    expect(nodeText(null)).toBe('')
    expect(nodeText({})).toBe('')
    expect(nodeText({ type: 'heading', content: [] })).toBe('')
  })
})

/**
 * Heading anchors, and the pieces a table of contents is built from.
 *
 * The id generator is shared on purpose: a contents rail scrolls to an id that
 * a renderer stamped, so two implementations are drift waiting to happen — and
 * there were two, differing over whether markup was stripped first, which
 * decided whether a heading containing a link got a usable anchor at all.
 */

import { headingId, nodeText } from '../src/utils/index.js'
import { headingsFromContent } from '../src/hooks/useHeadings.js'

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

describe('headingsFromContent', () => {
  const heading = (level, text) => ({
    type: 'heading',
    attrs: { level },
    content: [{ type: 'text', text }],
  })

  const pageOf = (blocks) => ({ getBodyBlocks: () => blocks })

  it('lists the body headings of a plain document', () => {
    // An untyped section: the parser claims nothing, so every heading counts.
    const page = pageOf([
      {
        rawContent: { content: [heading(2, 'Prerequisites'), heading(3, 'Node'), heading(2, 'Install')] },
        parsedContent: {},
      },
    ])

    expect(headingsFromContent(page).map((h) => h.text)).toEqual([
      'Prerequisites', 'Node', 'Install',
    ])
  })

  it('skips the headings the parser took as the section\'s own structure', () => {
    // In this framework a leading `###` is a pretitle and the `##` after the
    // title is a subtitle — structure, not sections of the article. Listing
    // them opened every contents rail with two entries no reader recognised.
    const page = pageOf([
      {
        rawContent: {
          content: [
            heading(3, 'Guide'),
            heading(1, 'Overview'),
            heading(2, 'Comprehensive guide to the platform'),
            heading(2, 'Topics covered'),
            heading(2, 'Who is this for?'),
          ],
        },
        parsedContent: {
          pretitle: 'Guide',
          title: 'Overview',
          subtitle: 'Comprehensive guide to the platform',
        },
      },
    ])

    expect(headingsFromContent(page).map((h) => h.text)).toEqual([
      'Topics covered', 'Who is this for?',
    ])
  })

  it('handles a multi-line title, which the parser gives as an array', () => {
    const page = pageOf([
      {
        rawContent: { content: [heading(2, 'Build the site.'), heading(2, 'Real heading')] },
        parsedContent: { title: ['Build the site.', 'Get the platform.'] },
      },
    ])

    expect(headingsFromContent(page).map((h) => h.text)).toEqual(['Real heading'])
  })

  it('stamps ids that match what the renderers produce', () => {
    const page = pageOf([
      { rawContent: { content: [heading(2, 'Using site.yml')] }, parsedContent: {} },
    ])

    expect(headingsFromContent(page)[0].id).toBe(headingId('Using site.yml'))
  })

  it('survives a page with no blocks', () => {
    expect(headingsFromContent(null)).toEqual([])
    expect(headingsFromContent(pageOf([]))).toEqual([])
  })
})

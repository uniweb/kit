/**
 * Heading anchors, and the pieces a table of contents is built from.
 *
 * The id generator is shared on purpose: a contents rail scrolls to an id that
 * a renderer stamped, so two implementations are drift waiting to happen — and
 * there were two, differing over whether markup was stripped first, which
 * decided whether a heading containing a link got a usable anchor at all.
 */

import { Website } from '@uniweb/core'
import { headingId, nodeText } from '../src/utils/index.js'
import { headingsFromContent } from '../src/hooks/useHeadings.js'

describe('headingId', () => {
  it('slugifies a plain heading', () => {
    expect(headingId('Getting Started')).toBe('getting-started')
  })

  it('keeps a letter in any language', () => {
    expect(headingId('Été 2026')).toBe('été-2026')
    expect(headingId('Résumé des Résultats')).toBe('résumé-des-résultats')
    expect(headingId('日本語の見出し')).toBe('日本語の見出し')
    expect(headingId('Über uns: 3 Schritte')).toBe('über-uns-3-schritte')
    expect(headingId('हिन्दी शीर्षक')).toBe('हिन्दी-शीर्षक')
  })

  it('gives one anchor however the text was typed', () => {
    expect(headingId('Cafe\u0301 noir')).toBe(headingId('Caf\u00e9 noir'))
  })

  it('leaves a heading in plain English as it was', () => {
    expect(headingId("It doesn't — matter")).toBe('it-doesn-t-matter')
    expect(headingId('C++ & friends')).toBe('c-friends')
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
  const heading = (level, text) => ({ type: 'heading', level, text })
  const pageOf = (blocks) => ({ getBodyBlocks: () => blocks })
  const texts = (page) => headingsFromContent(page).map((h) => h.text)

  it('lists the body headings of a plain document', () => {
    // No title or subtitle, so the parser claims nothing, and every heading counts.
    const page = pageOf([
      {
        parsedContent: { sequence: [heading(2, 'Prerequisites'), heading(3, 'Node'), heading(2, 'Install')] },
      },
    ])

    expect(texts(page)).toEqual(['Prerequisites', 'Node', 'Install'])
  })

  it('skips the headings the parser took as the section\'s own structure', () => {
    // In this framework a `#>` label line is a pretitle (as is a smaller
    // ordinary heading above the title) and the `##` after the
    // title is a subtitle — structure, not sections of the article. Listing
    // them opened every contents rail with two entries no reader recognised.
    const page = pageOf([
      {
        parsedContent: {
          pretitle: 'Guide',
          title: 'Overview',
          subtitle: 'Comprehensive guide to the platform',
          sequence: [
            heading(3, 'Guide'),
            heading(1, 'Overview'),
            heading(2, 'Comprehensive guide to the platform'),
            heading(2, 'Topics covered'),
            heading(2, 'Who is this for?'),
          ],
        },
      },
    ])

    expect(texts(page)).toEqual(['Topics covered', 'Who is this for?'])
  })

  it('skips a claimed heading with marks in it too', () => {
    const page = pageOf([
      {
        parsedContent: {
          title: 'Overview',
          subtitle: 'The <em>whole</em> guide',
          sequence: [heading(1, 'Overview'), heading(2, 'The <em>whole</em> guide'), heading(2, 'Topics')],
        },
      },
    ])

    expect(texts(page)).toEqual(['Topics'])
  })

  it('never lists a label line, which is drawn as a paragraph with no anchor', () => {
    const page = pageOf([
      {
        parsedContent: {
          sequence: [{ type: 'heading', level: 2, text: 'A label', attrs: { role: 'pretitle' } }, heading(2, 'Real')],
        },
      },
    ])

    expect(texts(page)).toEqual(['Real'])
  })

  it('counts every heading of a file that names no type, the `##` under its `#` too', () => {
    // `# Install`, `## Homebrew`: the parser calls the second a subtitle, and the
    // site's default section type draws it as a heading. Skipping it opened the
    // rail at the page's second section.
    const blockOf = (type) => ({
      type,
      website: { getDefaultBlockType: () => 'Section' },
      parsedContent: {
        title: 'Install',
        subtitle: 'Homebrew',
        sequence: [heading(1, 'Install'), heading(2, 'Homebrew'), heading(2, 'Windows')],
      },
    })

    expect(texts(pageOf([blockOf('Section')]))).toEqual(['Homebrew', 'Windows'])
    // A section of its own type draws its subtitle as one.
    expect(texts(pageOf([blockOf('Article')]))).toEqual(['Windows'])
  })

  describe("⭐ the type's own `header` decides, where its runtime schema says", () => {
    // A docs page: `#> Guide`, `# Overview`, `## Comprehensive guide…` (a lead line), then its sections.
    const docsPage = (type, defaultType) => pageOf([{
      type,
      website: { getDefaultBlockType: () => defaultType },
      parsedContent: {
        pretitle: 'Guide',
        title: 'Overview',
        subtitle: 'Comprehensive guide',
        sequence: [heading(1, 'Overview'), heading(2, 'Comprehensive guide'), heading(3, 'Topics covered'), heading(3, 'Who is this for?')],
      },
    }])
    const withMeta = (meta, run) => {
      const saved = globalThis.uniweb
      globalThis.uniweb = { getComponentMeta: (type) => meta[type] ?? null }
      try {
        return run()
      } finally {
        globalThis.uniweb = saved
      }
    }

    it('a header type skips its header even when it is the default: named or not, one page, one rail', () => {
      // ⛔ Until 2026-11-05 a docs starter declaring `defaultSection: 'DocSection'` listed the lead line.
      const listed = withMeta({ DocSection: { header: true } }, () => texts(docsPage('DocSection', 'DocSection')))
      expect(listed).toEqual(['Topics covered', 'Who is this for?'])
    })

    it('an as-written type counts every heading even when the file named it', () => {
      const listed = withMeta({ Section: { header: false } }, () => texts(docsPage('Section', 'Article')))
      expect(listed).toEqual(['Comprehensive guide', 'Topics covered', 'Who is this for?'])
    })

    it('CONTROL — a type that says neither keeps the guess from the type the file named', () => {
      expect(withMeta({}, () => texts(docsPage('DocSection', 'DocSection')))).toEqual(['Comprehensive guide', 'Topics covered', 'Who is this for?'])
      expect(withMeta({}, () => texts(docsPage('DocSection', 'Section')))).toEqual(['Topics covered', 'Who is this for?'])
    })
  })

  it('holds on core\'s own objects, with the parser\'s own fields', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Install' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Homebrew' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Run it.' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Windows' }] },
      ],
    }
    const website = new Website({
      content: {
        config: { name: 'T', defaultLanguage: 'en' },
        pages: [
          { route: '/plain', title: 'Plain', sections: [{ content: doc }] },
          { route: '/typed', title: 'Typed', sections: [{ type: 'Article', content: doc }] },
        ],
      },
      foundation: { default: {} },
    })
    const listed = (route) => headingsFromContent(website.pages.find((p) => p.route === route)).map((h) => h.text)

    expect(website.pages.find((p) => p.route === '/plain').getBodyBlocks()[0].parsedContent.subtitle).toBe('Homebrew')
    expect(listed('/plain')).toEqual(['Homebrew', 'Windows'])
    expect(listed('/typed')).toEqual(['Windows'])
  })

  it('handles a multi-line title, which the parser gives as an array', () => {
    const page = pageOf([
      {
        parsedContent: {
          title: ['Build the site.', 'Get the platform.'],
          sequence: [heading(2, 'Build the site.'), heading(2, 'Real heading')],
        },
      },
    ])

    expect(texts(page)).toEqual(['Real heading'])
  })

  it('stamps ids that match what the renderers produce', () => {
    const page = pageOf([{ parsedContent: { sequence: [heading(2, 'Using site.yml')] } }])

    expect(headingsFromContent(page)[0].id).toBe(headingId('Using site.yml'))
  })

  it('survives a page with no blocks', () => {
    expect(headingsFromContent(null)).toEqual([])
    expect(headingsFromContent(pageOf([]))).toEqual([])
  })
})

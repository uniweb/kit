/**
 * A contents rail scrolls to an id the renderer stamped, so every entry has to name one the page has.
 * This runs the real path on both sides: core's Block and the parser for the list, `<Render>` for the
 * page. It reads `<h2 id="…">` out of what `<Render>` draws, since an agreement asserted by calling
 * the same function twice proves nothing about what the page holds.
 */
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Website } from '@uniweb/core'
import { Render } from '../src/styled/Render/index.jsx'
import { headingsFromContent } from '../src/hooks/useHeadings.js'

const text = (value, marks) => ({ type: 'text', text: value, ...(marks ? { marks } : {}) })
const code = (value) => text(value, [{ type: 'code' }])
const heading = (...content) => ({ type: 'heading', attrs: { level: 2, id: null }, content })

const CASES = {
  'plain words': heading(text('Plain words')),
  'a literal <path>': heading(text('A file does not exist: <path>')),
  'a <path> in code': heading(text('The '), code('<path>'), text(' argument')),
  'an ampersand': heading(text('R&D and more')),
  'a typed entity, in code': heading(text('An '), code('&amp;'), text(' in code')),
  'a tag as typed': heading(text('Sites & <b>bold</b> typed')),
  emphasis: heading(text('With '), text('emphasis', [{ type: 'em' }]), text(' inside')),
  'a link': heading(text('With a '), text('link', [{ type: 'link', attrs: { href: 'https://example.com' } }]), text(' inside')),
  'an authored id': { type: 'heading', attrs: { level: 2, id: 'my-own-id' }, content: [text('Authored')] },
  'quotes and a dash': heading(text('Quote\'s "marks" and – dash')),
  'another alphabet': heading(text('Été 2026')),
  'a formula': heading(
    text('The case '),
    {
      type: 'math_inline',
      attrs: {
        latex: 'n=2',
        mathml:
          '<math xmlns="http://www.w3.org/1998/Math/MathML"><semantics><mrow><mi>n</mi><mo>=</mo><mn>2</mn></mrow><annotation encoding="application/x-tex">n=2</annotation></semantics></math>',
        display: false,
      },
    },
    text(' here'),
  ),
}

function setUp(nodes) {
  const website = new Website({
    content: {
      config: { name: 'T', defaultLanguage: 'en' },
      pages: [{ route: '/p', title: 'P', sections: [{ content: { type: 'doc', content: nodes } }] }],
    },
    foundation: { default: {} },
  })
  globalThis.uniweb = { activeWebsite: website }
  const page = website.pages.find((p) => p.route === '/p')
  const block = page.getBodyBlocks()[0]
  const stamped = [...renderToStaticMarkup(<Render content={block.parsedContent} block={block} />).matchAll(/<h2 id="([^"]*)"/g)].map((m) => m[1])
  return { page, stamped }
}

afterEach(() => {
  delete globalThis.uniweb
})

describe('every entry names an id the page has', () => {
  // A paragraph first, so the parser takes no heading as the section's title.
  const lead = { type: 'paragraph', content: [text('First.')] }

  for (const [name, node] of Object.entries(CASES)) {
    it(name, () => {
      const { page, stamped } = setUp([lead, node])
      const [entry] = headingsFromContent(page)
      expect(stamped).toHaveLength(1)
      expect(entry?.id).toBe(stamped[0])
    })
  }

  it('all of them on one page, in order', () => {
    const { page, stamped } = setUp([lead, ...Object.values(CASES)])
    expect(headingsFromContent(page).map((h) => h.id)).toEqual(stamped)
  })
})

describe('what an entry reads', () => {
  const lead = { type: 'paragraph', content: [text('First.')] }
  const entryOf = (node) => headingsFromContent(setUp([lead, node]).page)[0]

  it('the characters of a literal <path>, which are a word to the reader', () => {
    expect(entryOf(CASES['a literal <path>']).text).toBe('A file does not exist: <path>')
  })

  it('a formula once, and not its source too', () => {
    expect(entryOf(CASES['a formula']).text).toBe('The case n=2 here')
  })

  it('no markup', () => {
    expect(entryOf(CASES.emphasis).text).toBe('With emphasis inside')
  })
})

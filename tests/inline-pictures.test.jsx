/**
 * Inline pictures in prose — putting the picture back where the author wrote it.
 *
 * A picture beside text stays in its paragraph, and `@uniweb/semantic-parser`
 * renders a paragraph to an HTML string, so the picture rides as a positional
 * marker (`<uniweb-image data-index="N">`) and this engine swaps it for kit's
 * <Image>, by ordinal into the element's `image` children — the icon's contract.
 *
 * Until 2026-10-18 the parser left no marker and this engine drew nothing: the
 * paragraph kept a gap, and a paragraph holding only a picture rendered no
 * element at all.
 */
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Render } from '../src/styled/Render/index.jsx'

/** Install a minimal Uniweb singleton — what useWebsite() and getUniweb() read. */
function withWebsite(config, fn) {
  const prev = globalThis.uniweb
  globalThis.uniweb = {
    activeWebsite: { basePath: '', config, getRoutingComponents: () => ({}), localize: (v, d = '') => v ?? d },
    routingComponents: {},
  }
  try {
    return fn()
  } finally {
    globalThis.uniweb = prev
  }
}

const html = (content, config = {}) => withWebsite(config, () => renderToStaticMarkup(<Render content={content} />))
const doc = (...content) => ({ type: 'doc', content })
const text = (t) => ({ type: 'text', text: t })
const picture = (src, attrs = {}) => ({ type: 'image', attrs: { src, ...attrs } })
const icon = (name) => ({ type: 'image', attrs: { role: 'icon', library: 'lu', name } })
const paragraph = (...content) => ({ type: 'paragraph', content })

describe('a picture beside text, in a paragraph', () => {
  test('is drawn where the author placed it', () => {
    const out = html(doc(paragraph(text('As the figure '), picture('/cells.jpg', { alt: 'Cells' }), text(' shows.'))))
    expect(out).toMatch(/^<p><span>As the figure <\/span><img src="\/cells\.jpg" alt="Cells"[^>]*\/><span> shows\.<\/span><\/p>$/)
  })

  test("resolves through the host's asset pattern", () => {
    const out = html(
      doc(paragraph(text('See '), picture('/stored/a1b2.jpg', { assetId: 'a1b2', assetExt: 'jpg', alt: 'Cells' }))),
      { assets: { url: 'https://assets.example.test/{id}.{ext}' } },
    )
    expect(out).toContain('src="https://assets.example.test/a1b2.jpg"')
    expect(out).not.toContain('/stored/')
  })

  test("a paragraph holding only a picture draws it — such a paragraph's text was empty, and rendered no element", () => {
    const out = html(doc(paragraph(picture('/only.jpg', { alt: 'Only' }))))
    expect(out).toMatch(/^<p><img src="\/only\.jpg" alt="Only"[^>]*\/><\/p>$/)
  })

  test('each ordinal lands on its own picture, beside icons', () => {
    const out = html(doc(paragraph(picture('/a.jpg', { alt: 'A' }), text(' and '), icon('house'), text(' and '), picture('/b.jpg', { alt: 'B' }))))
    const a = out.indexOf('src="/a.jpg"')
    const glyph = out.indexOf('role="img"') // the icon's box; its SVG is fetched in the browser
    const b = out.indexOf('src="/b.jpg"')
    expect(a).toBeGreaterThan(-1)
    expect(glyph).toBeGreaterThan(a)
    expect(b).toBeGreaterThan(glyph)
  })

  test('in a heading too', () => {
    const out = html(doc({ type: 'heading', attrs: { level: 2 }, content: [picture('/logo.png', { alt: 'Logo' }), text(' Release notes')] }))
    expect(out).toMatch(/^<h2 id="release-notes"><img src="\/logo\.png" alt="Logo"[^>]*\/><span> Release notes<\/span><\/h2>$/)
  })
})

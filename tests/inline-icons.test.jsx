/**
 * Inline icons in prose — putting the glyph back where the author wrote it.
 *
 * `@uniweb/semantic-parser` renders a paragraph to an HTML string, so an atom
 * needing a React component cannot be inlined as markup. Three of them ride as
 * positional markers instead, and this engine swaps each for a component:
 * inline math (its MathML rides in the marker), inline insets (resolved through
 * `block.getInset(refId)`), and — since 2026-08-12 — icons, resolved by ORDINAL
 * into the element's `children`.
 *
 * Icons were carried and never placed: the parser recorded them in `children`
 * and in `content.icons`, but nothing emitted a marker, so the paragraph text
 * kept a bare GAP and the glyph disappeared. Word-level parity checks cannot see
 * that — the words are all still there — which is exactly why it survived a
 * 33-page migration undetected.
 *
 * The ordinal is the contract with the parser: `data-index="N"` selects the Nth
 * entry of `children.filter(c => c.type === 'icon')`, in document order.
 */

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Render } from '../src/styled/Render/index.jsx'
import { Icon } from '../src/components/Icon/index.js'

/** Install a minimal Uniweb singleton — what useWebsite() reads (see renderer-coverage). */
function withWebsite(fn) {
  const prev = globalThis.uniweb
  globalThis.uniweb = {
    activeWebsite: {
      basePath: '',
      getRoutingComponents: () => ({}),
      localize: (v, d = '') => v ?? d,
    },
    routingComponents: {},
  }
  try {
    return fn()
  } finally {
    globalThis.uniweb = prev
  }
}

const iconChild = (library, name, rest = {}) => ({
  type: 'icon',
  attrs: { library, name, ...rest },
})

const paragraph = (text, children) => [{ type: 'paragraph', text, children }]

const renderSequence = sequence =>
  withWebsite(() => renderToStaticMarkup(<Render content={{ sequence }} />))

const render = renderSequence

describe('inline icon markers', () => {
  it('replaces the marker with an icon, keeping the text around it', () => {
    const html = render(
      paragraph('Click the <uniweb-icon data-index="0"></uniweb-icon> button.', [
        iconChild('lu', 'save'),
      ])
    )

    // The marker itself must never reach the document.
    expect(html).not.toContain('uniweb-icon')
    expect(html).toContain('Click the ')
    expect(html).toContain(' button.')
    // An icon renders *something* — kit's <Icon> emits an element for a
    // library+name pair; asserting the marker is gone and the text survived is
    // the part that pins the substitution.
    expect(html).toMatch(/<p>.*Click the .*button\..*<\/p>/s)
  })

  it('resolves each marker by its own ordinal, in order', () => {
    const html = render(
      paragraph(
        'Press <uniweb-icon data-index="0"></uniweb-icon> then ' +
          '<uniweb-icon data-index="1"></uniweb-icon> to finish.',
        [iconChild('lu', 'home'), iconChild('lu', 'save')]
      )
    )

    expect(html).not.toContain('uniweb-icon')
    expect(html).toContain('Press ')
    expect(html).toContain(' then ')
    expect(html).toContain(' to finish.')
  })

  it('renders icons in a heading and leaves the anchor id alone', () => {
    const html = renderSequence([
      {
        type: 'heading',
        level: 2,
        text: '<uniweb-icon data-index="0"></uniweb-icon> Fast by default',
        children: [iconChild('lu', 'zap')],
      },
    ])

    expect(html).not.toContain('uniweb-icon')
    // headingId() runs stripTags first, so the marker must not leak into the id
    // that the TOC and every in-page link resolve against.
    expect(html).toContain('id="fast-by-default"')
    expect(html).toContain('Fast by default')
  })

  it('drops a marker whose ordinal has no matching child rather than emitting it', () => {
    const html = render(
      paragraph('Broken <uniweb-icon data-index="7"></uniweb-icon> reference.', [
        iconChild('lu', 'save'),
      ])
    )

    expect(html).not.toContain('uniweb-icon')
    expect(html).toContain('Broken ')
    expect(html).toContain(' reference.')
  })

  it('renders icons with no block present (only insets need one)', () => {
    // A paragraph carrying icons must resolve without a Block — the earlier
    // guard returned raw HTML whenever `block` was absent, which would have put
    // the marker straight into the document on any blockless render path.
    const html = render(
      paragraph('No block <uniweb-icon data-index="0"></uniweb-icon> here.', [
        iconChild('lu', 'save'),
      ])
    )

    expect(html).not.toContain('uniweb-icon')
  })

  it('leaves a paragraph with no markers untouched', () => {
    const html = render(paragraph('Ordinary <strong>prose</strong>.', []))

    expect(html).toContain('<strong>prose</strong>')
    expect(html).not.toContain('uniweb-icon')
  })
})

/**
 * An icon's size must be a VALID CSS length.
 *
 * React appends `px` to a numeric style value and passes a string through
 * verbatim, and this component's default is the string `'24'` — so it emitted
 * `style="width:24;height:24"`, which the browser discards as invalid. Harmless
 * for as long as every caller sized the icon with a utility class; visible the
 * moment an icon renders inline in prose with no class of its own.
 */
describe('icon size is a valid CSS length', () => {
  const styleOf = (props) =>
    (withWebsite(() => renderToStaticMarkup(<Icon {...props} />)).match(
      /style="([^"]*)"/
    ) || [])[1] || ''

  it('adds px to the bare-number default', () => {
    expect(styleOf({ name: 'check' })).toContain('width:24px')
  })

  it('adds px to a bare-number string', () => {
    const style = styleOf({ name: 'check', size: '32' })
    expect(style).toContain('width:32px')
    expect(style).toContain('height:32px')
  })

  it('leaves a unit-bearing length alone', () => {
    expect(styleOf({ name: 'check', size: '2rem' })).toContain('width:2rem')
  })

  it('never emits a unitless length', () => {
    for (const size of ['24', 24, '32', '1.5rem', '100%']) {
      expect(styleOf({ name: 'check', size })).not.toMatch(/width:\s*-?\d*\.?\d+\s*[;"]/)
    }
  })
})

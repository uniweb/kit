/**
 * Where a block sits in a flow — an author's `placement`, which <Render> writes
 * as `data-placement` on the block's box and `prose-tokens.css` lays out — and
 * what kit's media components are handed of a content element: what each reads,
 * never the element whole.
 */
import React from 'react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { renderToStaticMarkup } from 'react-dom/server'
import { PLACEMENTS } from '@uniweb/schemas/content'
import { Render } from '../src/styled/Render/index.jsx'
import { Visual } from '../src/styled/Visual/index.jsx'
import { Image } from '../src/components/Image/index.js'

/** Install a minimal Uniweb singleton — what useWebsite() reads. */
function withWebsite(fn) {
  const prev = globalThis.uniweb
  globalThis.uniweb = {
    activeWebsite: { basePath: '', getRoutingComponents: () => ({}), localize: (v, d = '') => v ?? d },
    routingComponents: {},
  }
  try {
    return fn()
  } finally {
    globalThis.uniweb = prev
  }
}

const html = (el) => withWebsite(() => renderToStaticMarkup(el))
const doc = (...content) => ({ type: 'doc', content })
const cell = (text, header = false) => ({
  type: 'tableCell',
  attrs: { colspan: 1, rowspan: 1, align: null, header },
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
})
const table = (attrs) => ({
  type: 'table',
  ...(attrs && { attrs }),
  content: [
    { type: 'tableRow', content: [cell('Plan', true), cell('Price', true)] },
    { type: 'tableRow', content: [cell('Basic'), cell('$10')] },
  ],
})

describe('Render — data-placement on the block in the flow', () => {
  test.each(PLACEMENTS)('an image placed %s', (placement) => {
    const out = html(<Render content={doc({ type: 'image', attrs: { src: '/h.jpg', alt: 'H', placement } })} />)
    expect(out).toContain(`<figure data-placement="${placement}">`)
  })

  test('an image placed nowhere has no attribute — the text column', () => {
    const out = html(<Render content={doc({ type: 'image', attrs: { src: '/h.jpg', alt: 'H' } })} />)
    expect(out).toContain('<figure>')
    expect(out).not.toContain('data-placement')
  })

  test('a value that is not one of the four words is not written', () => {
    const out = html(<Render content={doc({ type: 'image', attrs: { src: '/h.jpg', placement: 'middle' } })} />)
    expect(out).not.toContain('data-placement')
  })

  test("a table's scrolling box carries it, and the table its caption", () => {
    const out = html(<Render content={doc(table({ caption: 'Plans and prices', id: 'tbl-plans', placement: 'wide' }))} />)
    expect(out).toMatch(/^<div class="overflow-x-auto" data-placement="wide"><table id="tbl-plans"><caption>Plans and prices<\/caption><thead>/)
  })

  test('a table with no caption line renders as it did', () => {
    const out = html(<Render content={doc(table())} />)
    expect(out).toMatch(/^<div class="overflow-x-auto"><table><thead>/)
  })

  test('a video renders in a figure, with its placement and its caption', () => {
    const out = html(
      <Render content={doc({ type: 'image', attrs: { src: '/t.mp4', role: 'video', caption: 'The tour', placement: 'full', id: 'vid-tour', controls: true } })} />,
    )
    expect(out).toMatch(/^<figure id="vid-tour" data-kind="video" data-placement="full"><div class="relative overflow-hidden"/)
    expect(out).toContain('<figcaption>The tour</figcaption>')
    // The element's other words are not attributes of the player's box.
    for (const attr of ['role=', 'caption=', 'placement=', 'alt=']) expect(out).not.toContain(` ${attr}`)
  })
})

describe("Render — an image's author, its credit, in the caption line", () => {
  test('after the caption', () => {
    const out = html(<Render content={doc({ type: 'image', attrs: { src: '/h.jpg', caption: 'The harbour', author: 'Jane Doe' } })} />)
    expect(out).toContain('<figcaption>The harbour — <span data-role="author">Jane Doe</span></figcaption>')
  })

  test('alone, when there is no caption', () => {
    const out = html(<Render content={doc({ type: 'image', attrs: { src: '/h.jpg', author: 'Jane Doe' } })} />)
    expect(out).toContain('<figcaption><span data-role="author">Jane Doe</span></figcaption>')
  })
})

describe('Visual — hands <Image> and <Media> what each reads', () => {
  const element = {
    url: '/h.jpg',
    alt: 'H',
    role: 'image',
    placement: 'wide',
    author: 'Jane Doe',
    id: 'fig-h',
    size: 'lg', // what an image element once held: a layout size, read by <Image> as an avatar preset
    filter: { grayscale: 100 },
  }

  test("none of the element's other words reaches the page", () => {
    const out = html(<Visual image={element} />)
    expect(out).toContain('src="/h.jpg"')
    for (const attr of ['placement=', 'author=', 'role=', 'id=', 'size=', 'filter']) expect(out).not.toContain(attr)
  })

  test('an element key that is also an <Image> prop arrives as nothing — no 96px square', () => {
    expect(html(<Visual image={element} />)).not.toContain('w-24')
    expect(html(<Visual media={{ kind: 'image', ...element }} />)).not.toContain('w-24')
  })

  test('a video gets its address and playback flags, and nothing else', () => {
    const out = html(<Visual video={{ src: '/t.mp4', role: 'video', placement: 'full', caption: 'x', muted: true }} />)
    expect(out).toContain('/t.mp4')
    for (const attr of ['placement=', 'role=', 'caption=']) expect(out).not.toContain(attr)
  })
})

describe("Image's filter values are numbers", () => {
  test('a number, or a string that is one, is written', () => {
    const out = html(<Image src="/h.jpg" filter={{ grayscale: 100, blur: '2' }} />)
    expect(out).toContain('filter:blur(2px) grayscale(100%)')
  })

  test('anything else is left out', () => {
    const out = html(<Image src="/h.jpg" filter={{ blur: '1px) url(https://x.test/a.svg#f', sepia: 'x' }} />)
    expect(out).not.toContain('filter')
    expect(out).not.toContain('url(')
  })
})

describe('prose-tokens.css lays out each placement', () => {
  const css = readFileSync(fileURLToPath(new URL('../src/prose-tokens.css', import.meta.url)), 'utf8')
  test.each(PLACEMENTS)('%s has a rule', (placement) => {
    expect(css).toContain(`.prose [data-placement="${placement}"]`)
  })
})

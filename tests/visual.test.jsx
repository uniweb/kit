/**
 * Visual — one visual: a `content.media` item by its kind, or the first candidate.
 *
 * ⭐ A slot of one is the first item the author placed, whatever its kind. Handed
 * candidates instead, `<Visual>` picks by priority — inset, then video, then image —
 * whatever the author placed first; `content.media` is what keeps their order.
 */

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Visual } from '../src/styled/Visual/index.jsx'

/** The runtime's child renderer, reduced to something a test can read. */
function withChildRenderer(fn) {
  const prev = globalThis.uniweb
  globalThis.uniweb = { childBlockRenderer: ({ blocks }) => <span data-inset={blocks[0].type} /> }
  try {
    return fn()
  } finally {
    globalThis.uniweb = prev
  }
}

const render = (props) => withChildRenderer(() => renderToStaticMarkup(<Visual {...props} />))
const block = { getInset: (refId) => (refId === 'inset_0' ? { type: 'Chart' } : null) }

const photo = { kind: 'image', url: '/photo.jpg', alt: 'A photo' }
const clip = { kind: 'video', src: '/clip.mp4' }
const chart = { kind: 'inset', refId: 'inset_0' }

describe('Visual — a content.media item', () => {
  it('an image renders as an image', () => {
    const html = render({ media: photo })
    expect(html).toContain('<img')
    expect(html).toContain('/photo.jpg')
    // The kind is the item's tag, not an attribute of what renders.
    expect(html).not.toContain('kind=')
  })

  it('a video renders as a video', () => {
    const html = render({ media: clip })
    expect(html).toContain('/clip.mp4')
    expect(html).not.toContain('<img')
  })

  it('an embedded component renders through the section’s block', () => {
    expect(render({ media: chart, block })).toContain('data-inset="Chart"')
  })

  it('handed the list, it renders the first item — the author’s, not a priority’s', () => {
    // An image placed before a video: the candidates' priority would pick the video.
    const html = render({ media: [photo, clip] })
    expect(html).toContain('/photo.jpg')
    expect(html).not.toContain('/clip.mp4')
    expect(render({ image: photo, video: clip })).toContain('/clip.mp4')
  })

  it('the fallback when there is nothing it can render', () => {
    const fallback = <em>none</em>
    expect(render({ media: [], fallback })).toBe('<em>none</em>')
    expect(render({ media: chart, fallback })).toBe('<em>none</em>') // no block to resolve it
    expect(render({ media: { kind: 'inset', refId: 'gone' }, block, fallback })).toBe('<em>none</em>')
  })
})

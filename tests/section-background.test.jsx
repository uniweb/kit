/**
 * SectionBackground — the author's background, drawn by the runtime's own renderer, for a
 * component that places it itself (`background: 'self'` in its `meta.js`).
 */

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SectionBackground } from '../src/components/SectionBackground/index.js'

function withBackgroundRenderer(renderer, fn) {
  const prev = globalThis.uniweb
  globalThis.uniweb = { backgroundRenderer: renderer }
  try {
    return fn()
  } finally {
    globalThis.uniweb = prev
  }
}

/** The runtime's renderer, reduced to something a test can read. */
const Echo = ({ mode, color, className }) => <div data-mode={mode} data-color={color} className={className} />

describe('SectionBackground', () => {
  it('draws the block’s normalized background with the runtime’s renderer', () => {
    const html = withBackgroundRenderer(Echo, () =>
      renderToStaticMarkup(<SectionBackground block={{ background: { mode: 'color', color: 'red' } }} className="rounded" />)
    )
    expect(html).toBe('<div data-mode="color" data-color="red" class="rounded"></div>')
  })

  it('draws nothing for a section without a background', () => {
    const html = withBackgroundRenderer(Echo, () => renderToStaticMarkup(<SectionBackground block={{ background: null }} />))
    expect(html).toBe('')
  })

  it('draws nothing where no runtime has provided a renderer', () => {
    const html = withBackgroundRenderer(null, () =>
      renderToStaticMarkup(<SectionBackground block={{ background: { mode: 'color', color: 'red' } }} />)
    )
    expect(html).toBe('')
  })
})

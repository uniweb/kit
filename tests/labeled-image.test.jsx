/**
 * @vitest-environment jsdom
 *
 * LabeledImage: a picture with its words drawn over it, in the page's language, from a section's
 * `@std/overlay` block. Every place is in the prerendered page; what a label is (`role`) decides
 * how it is laid out, and `align` the side it keeps.
 *
 * The overlay is uniweb.io's architecture picture, 1550 × 1100, as its labeller placed it.
 */
import React from 'react'
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, cleanup, fireEvent, screen } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LabeledImage, labelStyle } from '../src/styled/LabeledImage/index.jsx'

const overlay = {
  baked: ['en'],
  sizes: { title: 4.3, label: 1 },
  labels: [
    { text: 'YOU', x: 20.9, y: 14.65, w: 8.8, h: 7.3, role: 'title' },
    { text: 'NAT Gateway', x: 87.5, y: 24.5, w: 8.6, h: 5 },
    { text: 'Entity models\nand records', x: 40, y: 60, w: 12, h: 6, role: 'text' },
    { text: 'HTTPS', x: 55, y: 30, w: 4, h: 2, role: 'note', align: 'right', size: 0.8 },
    { text: '', x: 10, y: 10 },
  ],
}

const picture = <img src="/stack.png" alt="The architecture" width="1550" height="1100" />

function inLanguage(code) {
  globalThis.uniweb = { activeWebsite: { getActiveLocale: () => code } }
}

/** The labels a page draws, as `[text, style]`, read from its markup. */
function labelsOf(html) {
  const host = document.createElement('div')
  host.innerHTML = html
  return [...host.querySelectorAll('.labeled-image__label')].map((el) => [el.textContent, el.getAttribute('style'), el.className])
}

afterEach(() => {
  delete globalThis.uniweb
  cleanup()
})

describe('in the prerendered page', () => {
  it('draws the labels over the picture, in a language its picture does not show', () => {
    inLanguage('fr')
    const html = renderToStaticMarkup(<LabeledImage overlay={overlay} width={1550} height={1100}>{picture}</LabeledImage>)
    expect(html).toContain('class="labeled-image labeled-image--covers"')
    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain('container-type:inline-size')
    expect(html).toContain('aspect-ratio:1550 / 1100')
    // A label with no words is left out.
    expect(labelsOf(html).map(([text]) => text)).toEqual(['YOU', 'NAT Gateway', 'Entity models\nand records', 'HTTPS'])
  })

  it('shows the picture as drawn in a language it shows itself', () => {
    inLanguage('en')
    const html = renderToStaticMarkup(<LabeledImage overlay={overlay} width={1550} height={1100}>{picture}</LabeledImage>)
    expect(html).not.toContain('labeled-image__label')
    expect(html).not.toContain('labeled-image--covers')
    expect(html).toContain('<img src="/stack.png"')
  })

  it('shows a picture made without words with its labels in every language, and no ground', () => {
    inLanguage('en')
    const { baked, ...textless } = overlay
    const html = renderToStaticMarkup(<LabeledImage overlay={textless} width={1550} height={1100}>{picture}</LabeledImage>)
    expect(labelsOf(html)).toHaveLength(4)
    expect(html).not.toContain('labeled-image--covers')
    expect(html).not.toContain('--label-ground')
  })

  it('gives each label the class of its role, and a role it does not know is a label', () => {
    inLanguage('fr')
    const odd = { labels: [{ text: 'A', x: 1, y: 1, role: 'heading' }, { text: 'B', x: 2, y: 2, role: 'note' }] }
    const html = renderToStaticMarkup(<LabeledImage overlay={odd} enlarge={false}>{picture}</LabeledImage>)
    expect(labelsOf(html).map(([, , className]) => className)).toEqual([
      'labeled-image__label labeled-image__label--label',
      'labeled-image__label labeled-image__label--note',
    ])
  })

  it('offers to open larger unless told not to', () => {
    inLanguage('fr')
    expect(renderToStaticMarkup(<LabeledImage overlay={overlay}>{picture}</LabeledImage>)).toContain('data-enlargeable')
    expect(renderToStaticMarkup(<LabeledImage overlay={overlay} enlarge={false}>{picture}</LabeledImage>)).not.toContain('data-enlargeable')
  })

  it('draws nothing over a picture with no overlay', () => {
    const html = renderToStaticMarkup(<LabeledImage enlarge={false}>{picture}</LabeledImage>)
    expect(html).not.toContain('labeled-image__labels')
  })
})

describe('where a label sits', () => {
  it('centers a one-line label on its point, at least its box, and as wide as its words', () => {
    const style = labelStyle({ text: 'NAT Gateway', x: 87.5, y: 24.5, w: 8.6, h: 5 }, {}, false)
    expect(style).toMatchObject({
      left: '87.5%', top: '24.5%', transform: 'translate(-50%, -50%)',
      width: 'max-content', minWidth: '8.6%', minHeight: '5%', whiteSpace: 'pre', textAlign: 'center',
    })
  })

  it('keeps its left side, or its right side, as a longer translation grows it', () => {
    expect(labelStyle({ text: 'A', x: 50, y: 30, w: 10, align: 'left' }, {}, false)).toMatchObject({
      left: '45%', transform: 'translate(0, -50%)', textAlign: 'left', justifyContent: 'flex-start',
    })
    expect(labelStyle({ text: 'A', x: 50, y: 30, w: 10, align: 'right' }, {}, false)).toMatchObject({
      left: '55%', transform: 'translate(-100%, -50%)', textAlign: 'right', justifyContent: 'flex-end',
    })
  })

  it('wraps text in its frame, centered in it, which keeps its top and is aligned left unless told', () => {
    const style = labelStyle({ text: 'Words', x: 40, y: 60, w: 12, h: 6, role: 'text' }, {}, false)
    expect(style).toMatchObject({
      left: '34%', top: '57%', transform: 'translate(0, 0)', width: '12%', minHeight: '6%', whiteSpace: 'pre-line', textAlign: 'left',
      display: 'flex', flexDirection: 'column', justifyContent: 'center',
    })
    expect(labelStyle({ text: 'Words', x: 40, y: 60, w: 12, h: 6, role: 'text', align: 'center' }, {}, false).textAlign).toBe('center')
  })

  it('sizes its words by its own size, else its role’s, in percent of the picture’s width', () => {
    expect(labelStyle({ text: 'YOU', x: 1, y: 1, role: 'title' }, { title: 4.3 }, false).fontSize).toBe('4.3cqw')
    expect(labelStyle({ text: 'YOU', x: 1, y: 1, role: 'title', size: 5 }, { title: 4.3 }, false).fontSize).toBe('5cqw')
    expect(labelStyle({ text: 'YOU', x: 1, y: 1, role: 'title' }, {}, false)).not.toHaveProperty('fontSize')
  })

  it('shows the part of the ground under its anchor when it covers the picture’s words', () => {
    const center = labelStyle({ text: 'YOU', x: 20, y: 10, w: 8, h: 6 }, {}, true)
    expect(center).toMatchObject({
      background: 'var(--label-ground, transparent)',
      backgroundSize: '100cqw calc(100cqw * var(--label-ratio, 1))',
      backgroundPositionX: 'calc(50% + 30 * 1cqw)',
      backgroundPositionY: 'calc(50% + 40 * var(--label-ratio, 1) * 1cqw)',
    })
    expect(labelStyle({ text: 'A', x: 50, y: 30, w: 10, align: 'left' }, {}, true).backgroundPositionX).toBe('calc(-45 * 1cqw)')
    expect(labelStyle({ text: 'A', x: 50, y: 30, w: 10, align: 'right' }, {}, true).backgroundPositionX).toBe('right calc(-45 * 1cqw)')
    expect(labelStyle({ text: 'A', x: 40, y: 60, w: 12, h: 6, role: 'text' }, {}, true).backgroundPositionY).toBe('calc(-57 * var(--label-ratio, 1) * 1cqw)')
    expect(labelStyle({ text: 'A', x: 40, y: 60 }, {}, false)).not.toHaveProperty('background')
  })
})

describe('opened larger', () => {
  const props = ['naturalWidth', 'naturalHeight']
  let rect

  beforeEach(() => {
    for (const name of props) {
      Object.defineProperty(HTMLImageElement.prototype, name, { configurable: true, get() { return Number(this.dataset[name]) || 0 } })
    }
    Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: 1280 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })
    rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
      return { top: 100, bottom: 586, left: 300, right: 988, width: 688, height: 486 }
    })
  })

  afterEach(() => {
    rect.mockRestore()
    for (const name of props) delete HTMLImageElement.prototype[name]
    document.body.style.overflow = ''
  })

  it('opens the picture with its words, in the section’s color context', () => {
    inLanguage('fr')
    render(
      <section className="context-dark">
        <LabeledImage overlay={overlay} width={1550} height={1100} minScale={0.44}>
          <img src="/stack.png" alt="The architecture" data-natural-width="1550" data-natural-height="1100" />
        </LabeledImage>
      </section>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'The architecture' }))
    const dialog = screen.getByRole('dialog', { name: 'The architecture' })
    expect(dialog.querySelector('img').getAttribute('src')).toBe('/stack.png')
    expect([...dialog.querySelectorAll('.labeled-image__label')].map((el) => el.textContent)).toContain('NAT Gateway')
    expect(dialog.firstElementChild.className).toContain('context-dark')
  })
})

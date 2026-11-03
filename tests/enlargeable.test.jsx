/**
 * @vitest-environment jsdom
 *
 * Enlargeable: a picture a reader can open larger. Offered only when that helps, nothing in the
 * prerender, and what opens is an `<img>`.
 *
 * The numbers are measured: the diagram in the public docs is 1550 × 419, shown 688 wide on a desktop
 * and 342 on a phone.
 */
import React from 'react'
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, cleanup, fireEvent, screen } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Enlargeable } from '../src/styled/Enlargeable/index.jsx'
import { EnlargeableImage } from '../src/styled/Enlargeable/image.jsx'
import { enlargedWidth } from '../src/styled/Enlargeable/size.js'
import { Render } from '../src/styled/Render/index.jsx'

describe('how wide a picture opens', () => {
  const desktop = { availableWidth: 1248, availableHeight: 768 }
  const phone = { availableWidth: 358, availableHeight: 768 }
  const diagram = { naturalWidth: 1550, naturalHeight: 419 }

  it('fits the window, when that shows it larger', () => {
    expect(enlargedWidth({ ...diagram, shownWidth: 688, ...desktop })).toBe(1248)
    expect(enlargedWidth({ naturalWidth: 5000, naturalHeight: 3000, shownWidth: 688, ...desktop })).toBe(1248)
  })

  it('takes the height into account', () => {
    expect(enlargedWidth({ naturalWidth: 1600, naturalHeight: 1600, shownWidth: 500, ...desktop })).toBe(768)
  })

  it('never goes past its own size', () => {
    expect(enlargedWidth({ naturalWidth: 1000, naturalHeight: 500, shownWidth: 688, ...desktop })).toBe(1000)
  })

  it('stops at minScale for a picture with words in it, and the reader scrolls', () => {
    expect(enlargedWidth({ ...diagram, shownWidth: 342, ...phone, minScale: 0.75 })).toBe(1163)
    // A very wide one on a desktop: fitting would leave its labels at 4px.
    expect(enlargedWidth({ naturalWidth: 5000, naturalHeight: 400, shownWidth: 688, ...desktop, minScale: 0.75 })).toBe(3750)
  })

  it('opens at its own size when fitting the window shows nothing new, as on a phone', () => {
    expect(enlargedWidth({ ...diagram, shownWidth: 342, ...phone })).toBe(1550)
  })

  it.each([
    ['at its own size', { naturalWidth: 688, naturalHeight: 400, shownWidth: 688, ...desktop }],
    ['nearly its own size', { naturalWidth: 800, naturalHeight: 400, shownWidth: 688, ...desktop }],
    ['not loaded yet', { naturalWidth: 0, naturalHeight: 0, shownWidth: 688, ...desktop }],
    ['with no box', { naturalWidth: 1600, naturalHeight: 900, shownWidth: 0, ...desktop }],
  ])('offers nothing for a picture %s', (_, sizes) => {
    expect(enlargedWidth(sizes)).toBeNull()
  })
})

describe('in the prerender', () => {
  it('is the picture and nothing else', () => {
    const html = renderToStaticMarkup(<Enlargeable><img src="/a.png" alt="A" loading="lazy" /></Enlargeable>)
    expect(html).toBe('<div data-enlargeable="" style="position:relative"><img src="/a.png" alt="A" loading="lazy"/></div>')
  })
})

describe('in a page body', () => {
  const content = {
    sequence: [
      { type: 'image', attrs: { src: '/a.png', alt: 'A', caption: 'The caption', author: 'Ada', width: 1600, height: 900 } },
    ],
  }

  it('is opt-in: the default draws no box around a picture', () => {
    const html = renderToStaticMarkup(<Render content={content} />)
    expect(html).not.toContain('data-enlargeable')
  })

  it('keeps the figure, the size, the caption and its credit', () => {
    const plain = renderToStaticMarkup(<Render content={content} />)
    const html = renderToStaticMarkup(<Render content={content} components={{ image: EnlargeableImage }} />)
    expect(html.replace('<div data-enlargeable="" style="position:relative">', '').replace('</div><figcaption>', '<figcaption>')).toBe(plain)
  })

  it('leaves an icon as an icon', () => {
    const icon = { sequence: [{ type: 'image', attrs: { role: 'icon', library: 'lu', name: 'house' } }] }
    const html = renderToStaticMarkup(<Render content={icon} components={{ image: EnlargeableImage }} />)
    expect(html).not.toContain('data-enlargeable')
  })
})

describe('in the browser', () => {
  const props = ['naturalWidth', 'naturalHeight']
  let rect

  beforeEach(() => {
    for (const name of props) {
      Object.defineProperty(HTMLImageElement.prototype, name, { configurable: true, get() { return Number(this.dataset[name]) || 0 } })
    }
    Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: 1280 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })
    rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
      return { top: 100, bottom: 286, left: 300, right: 988, width: 688, height: 186 }
    })
  })

  afterEach(() => {
    cleanup()
    rect.mockRestore()
    for (const name of props) delete HTMLImageElement.prototype[name]
    document.body.style.overflow = ''
    delete globalThis.uniweb
  })

  const picture = (natural = [1550, 419], extra = {}) => (
    <img src="data:image/svg+xml,x" alt="The diagram" data-natural-width={natural[0]} data-natural-height={natural[1]} {...extra} />
  )

  it('offers it when opening shows it larger', () => {
    render(<Enlargeable>{picture()}</Enlargeable>)
    expect(screen.getByRole('button', { name: 'Enlarge' })).toBeTruthy()
  })

  it('measures again when a lazy picture arrives', () => {
    const { container } = render(<Enlargeable>{picture([0, 0])}</Enlargeable>)
    expect(screen.queryByRole('button')).toBeNull()
    const img = container.querySelector('img')
    img.dataset.naturalWidth = '1550'
    img.dataset.naturalHeight = '419'
    fireEvent.load(img)
    expect(screen.getByRole('button', { name: 'Enlarge' })).toBeTruthy()
  })

  it.each([
    ['at about its own size', () => <Enlargeable>{picture([700, 300])}</Enlargeable>],
    ['in a link, which keeps its click', () => <a href="#x"><Enlargeable>{picture()}</Enlargeable></a>],
    ['hidden from readers', () => <Enlargeable>{picture(undefined, { 'aria-hidden': 'true' })}</Enlargeable>],
    ['when turned off', () => <Enlargeable disabled>{picture()}</Enlargeable>],
  ])('offers nothing for a picture %s', (_, ui) => {
    const { container } = render(ui())
    expect(screen.queryByRole('button')).toBeNull()
    fireEvent.click(container.querySelector('img'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens the same picture, as an image, from the button and from the picture', () => {
    const { container } = render(<Enlargeable>{picture()}</Enlargeable>)
    fireEvent.click(screen.getByRole('button', { name: 'Enlarge' }))
    const dialog = screen.getByRole('dialog', { name: 'The diagram' })
    const big = dialog.querySelector('img')
    expect(big.getAttribute('src')).toBe('data:image/svg+xml,x')
    expect(big.alt).toBe('The diagram')
    expect(big.style.width).toBe('1248px')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(container.querySelector('img'))
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('closes from its button, from the scrim, and from a picture that fits', () => {
    render(<Enlargeable>{picture()}</Enlargeable>)
    const button = screen.getByRole('button', { name: 'Enlarge' })

    fireEvent.click(button)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(button)
    fireEvent.click(screen.getByRole('dialog'))
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(button)
    fireEvent.click(screen.getByRole('dialog').querySelector('img'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('stays open on a click on a picture the reader is panning across', () => {
    Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: 390 })
    render(<Enlargeable minScale={0.75}>{picture()}</Enlargeable>)
    fireEvent.click(screen.getByRole('button', { name: 'Enlarge' }))
    const big = screen.getByRole('dialog').querySelector('img')
    expect(big.style.width).toBe('1163px')
    fireEvent.click(big)
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('moves focus in, and gives it back', () => {
    render(<Enlargeable>{picture()}</Enlargeable>)
    const button = screen.getByRole('button', { name: 'Enlarge' })
    button.focus()
    fireEvent.click(button)
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(document.activeElement).toBe(button)
  })

  it('takes the ground the picture sits on, which the portal leaves behind', () => {
    render(<Enlargeable style={{ '--section': 'rgb(1, 2, 3)' }}>{picture()}</Enlargeable>)
    fireEvent.click(screen.getByRole('button', { name: 'Enlarge' }))
    expect(screen.getByRole('dialog').firstElementChild.style.background).toBe('rgb(1, 2, 3)')
  })

  it("says its labels in the site's language, or as a foundation says them", () => {
    globalThis.uniweb = { activeWebsite: { localize: (value) => value.fr } }
    render(<Enlargeable>{picture()}</Enlargeable>)
    expect(screen.getByRole('button', { name: 'Agrandir' })).toBeTruthy()
    cleanup()
    render(<Enlargeable labels={{ enlarge: '拡大' }}>{picture()}</Enlargeable>)
    expect(screen.getByRole('button', { name: '拡大' })).toBeTruthy()
  })
})

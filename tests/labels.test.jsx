/**
 * @vitest-environment jsdom
 *
 * A component takes the word it would use, and has none of its own: where a word comes from is a
 * foundation's to say. Without one it uses what the author wrote, a role or a symbol [Diego, 2026-11-02].
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { DataPlaceholder } from '../src/components/DataPlaceholder.jsx'
import { Disclaimer } from '../src/styled/Disclaimer/Disclaimer.jsx'
import { Asset as PlainAsset } from '../src/components/Asset/Asset.jsx'
import { Asset } from '../src/styled/Asset/Asset.jsx'
import { Media } from '../src/styled/Media/Media.jsx'
import { Prose } from '../src/styled/Prose/index.jsx'

const attr = (html, name) => html.match(new RegExp(`${name}="([^"]*)"`))?.[1]

describe('with no word given, kit says none', () => {
  let was
  beforeEach(() => {
    was = globalThis.uniweb
    globalThis.uniweb = { activeWebsite: { basePath: '', makeHref: (href) => href, localize: (value) => value?.en ?? '' }, routingComponents: {} }
  })
  afterEach(() => {
    globalThis.uniweb = was
  })

  it('Media: the play button is the caption, the alt, or the symbol it shows', () => {
    const video = { src: 'https://youtube.com/watch?v=abc123', thumbnail: '/poster.jpg', facade: true }
    const named = (props) => attr(renderToStaticMarkup(<Media {...video} {...props} />).match(/<button[^>]*>/)[0], 'aria-label')
    expect(named({})).toBe('▶')
    expect(named({ alt: 'The tour' })).toBe('The tour')
    expect(named({ caption: 'A walk through', alt: 'The tour' })).toBe('A walk through')
    expect(named({ playLabel: 'Lire', caption: 'A walk through' })).toBe('Lire')
    const poster = renderToStaticMarkup(<Media {...video} />).match(/<img[^>]*>/)[0]
    expect(attr(poster, 'alt')).toBe('')
  })

  it('Asset: its download button is named by the file, or by the word it is given', () => {
    const button = (props) => renderToStaticMarkup(<Asset value="/files/report.pdf" {...props} />).match(/<a[^>]*aria-label[^>]*>|<button[^>]*aria-label[^>]*>/)?.[0]
    expect(attr(button({}), 'aria-label')).toBe('report.pdf')
    expect(attr(button({ downloadLabel: 'Télécharger' }), 'aria-label')).toBe('Télécharger')
  })

  it('the plain Asset: its tooltip is the file', () => {
    const html = renderToStaticMarkup(<PlainAsset value="/files/report.pdf" />)
    expect(attr(html, 'title')).toBe('report.pdf')
  })

  it("Prose: a footnote's link back says what it is by its role", () => {
    const sequence = [
      { type: 'paragraph', text: 'Claim.[^a]' },
      { type: 'paragraph', text: '[^a]: The note.' },
    ]
    const back = (props) => renderToStaticMarkup(<Prose content={{ sequence }} {...props} />).match(/<a[^>]*footnote-back[^>]*>/)[0]
    expect(attr(back({}), 'role')).toBe('doc-backlink')
    expect(attr(back({}), 'aria-label')).toBeUndefined()
    expect(attr(back({ footnoteBackLabel: 'Retour au texte' }), 'aria-label')).toBe('Retour au texte')
  })

  it('DataPlaceholder: says it is busy, and a word only when given one', () => {
    const html = renderToStaticMarkup(<DataPlaceholder />)
    expect(attr(html, 'role')).toBe('status')
    expect(attr(html, 'aria-busy')).toBe('true')
    expect(attr(html, 'aria-label')).toBeUndefined()
    expect(attr(renderToStaticMarkup(<DataPlaceholder label="Chargement" />), 'aria-label')).toBe('Chargement')
  })

  describe('Disclaimer', () => {
    afterEach(cleanup)

    const buttonsWhenOpen = (props) => {
      render(<Disclaimer title="The terms" content="What they are." {...props} />)
      fireEvent.click(screen.getByText('The terms'))
      return within(screen.getByRole('dialog')).getAllByRole('button')
    }

    it('closes by the × at its top, and has no button of words at its foot', () => {
      const buttons = buttonsWhenOpen({})
      expect(buttons.map((button) => button.getAttribute('aria-label') ?? button.textContent)).toEqual(['×'])
      fireEvent.click(buttons[0])
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    it('given the word, names the × by it and puts a button at its foot', () => {
      const buttons = buttonsWhenOpen({ closeLabel: 'Fermer' })
      expect(buttons.map((button) => button.getAttribute('aria-label') ?? button.textContent)).toEqual(['Fermer', 'Fermer'])
      fireEvent.click(buttons[1])
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })
})

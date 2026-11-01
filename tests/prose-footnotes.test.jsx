/**
 * Footnotes in `<Prose>`: the marks numbered and linked, the notes listed at the end.
 *
 * The reader keeps `[^1]` and `[^1]: the note` as text, so this is all there is to a footnote on a
 * website. Before it, a page printed both literally.
 */
import React from 'react'
import { beforeAll, describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Prose } from '../src/styled/Prose/index.jsx'
import { footnotesIn } from '../src/styled/Prose/footnotes.js'

beforeAll(() => {
  globalThis.uniweb = { activeWebsite: { basePath: '', makeHref: (href) => href } }
})

const p = (text) => ({ type: 'paragraph', text, children: [] })
const render = (sequence, block) => renderToStaticMarkup(<Prose content={{ sequence }} block={block} />)

describe('a footnote', () => {
  it('numbers its mark, in reading order, and links it to the note', () => {
    const html = render([p('First.[^b] Second.[^a]'), p('[^a]: Note A.'), p('[^b]: Note B.')])
    expect(html).toContain('<sup class="footnote-ref"><a href="#fn-1" id="fnref-1">1</a></sup>')
    expect(html).toContain('<sup class="footnote-ref"><a href="#fn-2" id="fnref-2">2</a></sup>')
    expect(html.indexOf('Note B.')).toBeLessThan(html.indexOf('Note A.'))
  })

  it('takes the note paragraphs out of the text and lists them last', () => {
    const html = render([p('Claim.[^a]'), p('[^a]: The note.'), p('More text.')])
    expect(html).not.toContain('[^a]')
    expect(html.indexOf('More text.')).toBeLessThan(html.indexOf('The note.'))
    expect(html).toMatch(/<ol class="footnotes"><li id="fn-1">.*The note\..*href="#fnref-1".*<\/li><\/ol>/s)
  })

  it('keeps the markup a note holds', () => {
    const html = render([p('Claim.[^a]'), p('[^a]: Two <em>words</em>.')])
    expect(html).toContain('Two <em>words</em>.')
  })

  it('gives a mark used twice one number, and one anchor', () => {
    const { sequence } = footnotesIn([p('One.[^a] Two.[^a]'), p('[^a]: Note.')])
    expect(sequence[0].text.match(/id="fnref-1"/g)).toHaveLength(1)
    expect(sequence[0].text.match(/>1<\/a>/g)).toHaveLength(2)
  })

  it('reaches a mark in a list, a quote and a table', () => {
    const { sequence } = footnotesIn([
      { type: 'list', children: [[p('In a list.[^a]')]] },
      { type: 'blockquote', children: [p('In a quote.[^a]')] },
      { type: 'table', rows: [{ cells: [{ children: [p('In a cell.[^a]')] }] }] },
      p('[^a]: Note.'),
    ])
    expect(JSON.stringify(sequence)).not.toContain('[^a]')
  })

  it('leaves code alone', () => {
    const { sequence } = footnotesIn([
      p('Write <code>[^a]</code> like this.[^a]'),
      { type: 'codeBlock', text: 'x[^a]' },
      p('[^a]: Note.'),
    ])
    expect(sequence[0].text).toContain('<code>[^a]</code>')
    expect(sequence[1].text).toBe('x[^a]')
  })

  it('tells two sections on one page apart', () => {
    const html = render([p('Claim.[^a]'), p('[^a]: Note.')], { stableId: 'intro', parsedContent: {} })
    expect(html).toContain('href="#fn-intro-1"')
    expect(html).toContain('id="fn-intro-1"')
  })
})

describe('what stays as written', () => {
  it('a mark with no note', () => {
    const html = render([p('Claim.[^nope]'), p('[^a]: Used elsewhere.[^a]')])
    expect(html).toContain('[^nope]')
  })

  it('a note with no mark', () => {
    const html = render([p('Claim.[^a]'), p('[^a]: Used.'), p('[^b]: Never used.')])
    expect(html).toContain('[^b]: Never used.')
  })

  it('a section with no footnotes, untouched', () => {
    const sequence = [p('Just text, with [brackets] and ^carets.')]
    expect(footnotesIn(sequence).sequence).toBe(sequence)
    expect(footnotesIn(null)).toEqual({ sequence: null, notes: [] })
  })
})

describe('children', () => {
  it('still wraps them, and looks for no footnotes', () => {
    expect(renderToStaticMarkup(<Prose><p>[^a]</p></Prose>)).toContain('<p>[^a]</p>')
  })
})

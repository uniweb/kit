/**
 * What the content states reaches the page — a list's tightness and its start,
 * a link's role, a struck run.
 *
 * Each was lost between the document and the markup until 2026-10-19:
 *
 *   - `<Render>` drew every list item's paragraph as a `<p>`, so a typography
 *     layer spaced every list as a loose one (items 1.25em apart, not 0.5em)
 *     though the author wrote it tight — the markdown default;
 *   - an ordered list counted from 1 whatever number it started at;
 *   - a button (`[Go](/x){button}`, a link whose role is `button`) drew as a
 *     plain link, so no stylesheet could tell the two apart;
 *   - struck text (`~~gone~~`) drew as ordinary text (semantic-parser).
 */

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Render } from '../src/styled/Render/index.jsx'

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

const pm = (nodes) => ({ type: 'doc', content: nodes })
const text = (t, ...marks) => (marks.length ? { type: 'text', text: t, marks } : { type: 'text', text: t })
const para = (...content) => ({ type: 'paragraph', content })
const item = (...blocks) => ({ type: 'listItem', content: blocks })
const bullets = (attrs, ...items) => ({ type: 'bulletList', ...(attrs ? { attrs } : {}), content: items })

describe('a tight list draws its items bare', () => {
  it('as markdown does — no paragraph in an item', () => {
    const out = html(<Render content={pm([bullets(null, item(para(text('One'))), item(para(text('Two'))))])} />)
    expect(out).toBe('<ul><li><span>One</span></li><li><span>Two</span></li></ul>')
  })

  it('CONTROL — a loose list keeps a paragraph per item', () => {
    const out = html(<Render content={pm([bullets({ loose: true }, item(para(text('One'))), item(para(text('Two'))))])} />)
    expect(out).toBe('<ul><li><p><span>One</span></p></li><li><p><span>Two</span></p></li></ul>')
  })

  it('an item with a nested list keeps the list, its own text bare', () => {
    const nested = bullets(null, item(para(text('Inner'))))
    const out = html(<Render content={pm([bullets(null, item(para(text('Outer')), nested))])} />)
    expect(out).toBe('<ul><li><span>Outer</span><ul><li><span>Inner</span></li></ul></li></ul>')
  })

  it('an item holding two paragraphs is drawn as written — joined, they would read as one', () => {
    const out = html(<Render content={pm([bullets(null, item(para(text('One')), para(text('Two'))))])} />)
    expect(out).toBe('<ul><li><p><span>One</span></p><p><span>Two</span></p></li></ul>')
  })

  it('an item that is only a link draws the link, with no paragraph around it', () => {
    const link = { type: 'link', attrs: { href: '/a' } }
    const out = html(<Render content={pm([bullets(null, item(para(text('Docs', link))))])} />)
    expect(out).toMatch(/^<ul><li><a [^>]*href="\/a"[^>]*>Docs<\/a><\/li><\/ul>$/)
  })

  it("an element the foundation renders its own way stays the foundation's", () => {
    const Para = ({ element }) => <p className="mine">{element.text}</p>
    const out = html(
      <Render content={pm([bullets(null, item(para(text('One'))))])} components={{ paragraph: Para }} />
    )
    expect(out).toBe('<ul><li><p class="mine">One</p></li></ul>')
  })
})

describe('an ordered list starts where the author started it', () => {
  const ordered = (start) => ({
    type: 'orderedList',
    attrs: { start },
    content: [item(para(text('Three'))), item(para(text('Four')))],
  })

  it('at 3', () => {
    expect(html(<Render content={pm([ordered(3)])} />)).toMatch(/^<ol start="3">/)
  })

  it('CONTROL — at 1, with no attribute', () => {
    expect(html(<Render content={pm([ordered(1)])} />)).toMatch(/^<ol>/)
  })
})

describe("a link's role reaches its anchor", () => {
  const button = (href) => ({ type: 'button', attrs: { href } })

  it('a button on its own line is a link that says it is a button', () => {
    const out = html(<Render content={pm([para(text('Get started', button('/signup')))])} />)
    expect(out).toMatch(/^<p><a [^>]*data-role="button"[^>]*>Get started<\/a><\/p>$/)
  })

  it('a button inside a sentence says so too', () => {
    const out = html(<Render content={pm([para(text('Then '), text('sign up', button('/join')), text('.'))])} />)
    expect(out).toContain('<a href="/join" target="_self" data-role="button">sign up</a>')
  })

  it('a button alone in a table cell keeps its role', () => {
    const cell = (...blocks) => ({ type: 'tableCell', content: blocks })
    const table = { type: 'table', content: [{ type: 'tableRow', content: [cell(para(text('Buy', button('/buy'))))] }] }
    expect(html(<Render content={pm([table])} />)).toMatch(/<td><a [^>]*data-role="button"[^>]*>Buy<\/a><\/td>/)
  })

  it('a button labelled in two styles is one button', () => {
    // `[**Go** now](/go){button}` — the parser used to make each run a link of its own.
    const out = html(<Render content={pm([para(text('Go', button('/go'), { type: 'bold' }), text(' now', button('/go')))])} />)
    expect(out.match(/<a /g)).toHaveLength(1)
    expect(out).toMatch(/<a [^>]*data-role="button"[^>]*>Go now<\/a>/)
  })

  it('CONTROL — a plain link has no data-role', () => {
    const out = html(<Render content={pm([para(text('Docs', { type: 'link', attrs: { href: '/d' } }))])} />)
    expect(out).not.toContain('data-role')
  })
})

describe("a divider's space is the stylesheet's", () => {
  // A utility on it outranks the prose layer, so a class here decides the space.
  it('a plain one is a bare <hr>', () => {
    expect(html(<Render content={pm([{ type: 'divider' }])} />)).toBe('<hr/>')
  })

  it('CONTROL — a typed one is a different divider, drawn by <Divider>', () => {
    expect(html(<Render content={pm([{ type: 'divider', attrs: { type: 'dots' } }])} />)).toMatch(/^<div[^>]*role="separator"/)
  })
})

describe('struck text reaches the page', () => {
  it('as an <s>', () => {
    const out = html(<Render content={pm([para(text('was '), text('gone', { type: 'strike' }), text(' now'))])} />)
    expect(out).toBe('<p><span>was <s>gone</s> now</span></p>')
  })
})

describe('a code block shows its code', () => {
  // ⛔ Until 2026-10-19 the parser escaped a code block's text for HTML and this
  // escaped it again, so `<p>` showed as `&lt;p&gt;` on the page.
  const code = (t) => pm([{ type: 'codeBlock', attrs: { language: 'html' }, content: [text(t)] }])

  it('escaped once, as any text is — the reader sees the characters as written', () => {
    const out = html(<Render content={code('<p>Hi & bye</p>')} />)
    expect(out).toContain('&lt;p&gt;Hi &amp; bye&lt;/p&gt;')
    expect(out).not.toContain('&amp;lt;')
  })
})

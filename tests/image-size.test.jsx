/**
 * A size on an image reaches the `<img>`, on every path that draws one.
 *
 * `{width=780 height=1170}` holds an image's place on the page while its file loads. `<Visual>` passed
 * it on, and `<Render>` (so `<Prose>` and `<Article>`) read only the address and the alt text, so the
 * same markdown held its place in a slot and not in a page's body. A build stamps a file's own size on
 * the same attributes, so this is also what carries that one.
 */
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Render } from '../src/styled/Render/index.jsx'
import { Visual } from '../src/styled/Visual/index.jsx'

function withWebsite(fn) {
  const prev = globalThis.uniweb
  globalThis.uniweb = {
    activeWebsite: { basePath: '', config: {}, getRoutingComponents: () => ({}), localize: (v, d = '') => v ?? d },
    routingComponents: {},
  }
  try {
    return fn()
  } finally {
    globalThis.uniweb = prev
  }
}

const html = (element) => withWebsite(() => renderToStaticMarkup(element))
const doc = (...content) => ({ type: 'doc', content })
const picture = (attrs) => ({ type: 'image', attrs: { src: '/a.webp', alt: 'A', ...attrs } })
const beside = (node) => doc({ type: 'paragraph', content: [{ type: 'text', text: 'See ' }, node] })

const SIZE = { width: 780, height: 1170 }
const paths = [
  ['a picture alone in the body', (attrs) => <Render content={doc(picture(attrs))} />],
  ['a picture beside text', (attrs) => <Render content={beside(picture(attrs))} />],
  ['a slot', (attrs) => <Visual media={{ kind: 'image', url: '/a.webp', alt: 'A', ...attrs }} />],
]

describe.each(paths)('%s', (_name, draw) => {
  test('sends the size it was given', () => {
    const out = html(draw(SIZE))
    expect(out).toContain('width="780"')
    expect(out).toContain('height="1170"')
  })

  test('sends none when it was given none', () => {
    const out = html(draw({}))
    expect(out).toMatch(/<img /)
    expect(out).not.toMatch(/\b(width|height)="/)
  })

  test('takes the loading the author wrote, and is lazy by default', () => {
    expect(html(draw({ loading: 'eager' }))).toContain('loading="eager"')
    expect(html(draw({}))).toContain('loading="lazy"')
  })
})

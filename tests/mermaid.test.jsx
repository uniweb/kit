/**
 * A diagram is a foundation's choice, its source holds the page until the picture
 * arrives, and the engine can't reach the page.
 *
 * What a unit test can hold is below. The drawing itself needs a browser, since
 * Mermaid measures text, so it is checked in one and not here.
 *
 * @vitest-environment jsdom
 */

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { act, cleanup, render, waitFor } from '@testing-library/react'

const draws = vi.hoisted(() => ({ next: null, calls: [] }))

vi.mock('../src/styled/Mermaid/sandbox.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    realDrawDiagram: actual.drawDiagram,
    drawDiagram: (source, theme, width) => {
      draws.calls.push({ source, theme, width })
      return Promise.resolve(draws.next ? draws.next(source) : null)
    },
  }
})

import { Mermaid, themeAt } from '../src/styled/Mermaid/index.jsx'
import * as sandbox from '../src/styled/Mermaid/sandbox.js'
import { Code } from '../src/styled/Section/renderers/Code.jsx'
import { Render } from '../src/styled/Render/index.jsx'
import { Section } from '../src/styled/Section/Section.jsx'

const SOURCE = 'flowchart LR\n  A --> B'
const PICTURE = { src: 'data:image/svg+xml;charset=utf-8,x', width: 400, height: 100, label: '' }

/** The prerender and the browser's first render: no effects have run. */
const prerender = (element) => renderToStaticMarkup(element)

/** What the browser's IntersectionObserver would say, on demand. */
let observers = []
function scrollIntoView() {
  for (const { callback, node } of observers) {
    act(() => callback([{ isIntersecting: true, target: node }]))
  }
}

beforeEach(() => {
  draws.next = null
  draws.calls = []
  observers = []
  globalThis.IntersectionObserver = class {
    constructor(callback, options) {
      this.callback = callback
      this.options = options
    }
    observe(node) {
      this.node = node
      observers.push(this)
    }
    disconnect() {}
  }
  // A canvas that answers what it was told, as hex. jsdom has none.
  HTMLCanvasElement.prototype.getContext = () => {
    let fill = '#000000'
    return {
      get fillStyle() {
        return fill
      },
      set fillStyle(value) {
        if (/^#[0-9a-f]{6}$/i.test(value)) fill = value.toLowerCase()
      },
      fillRect() {},
      getImageData: () => ({
        data: [1, 3, 5].map((i) => parseInt(fill.slice(i, i + 2), 16)),
      }),
    }
  }
})

afterEach(() => {
  cleanup()
  delete globalThis.IntersectionObserver
  document.querySelectorAll('iframe').forEach((frame) => frame.remove())
})

describe('the page holds the source until the picture arrives', () => {
  it('the prerender is the code block kit draws for any code, in a figure', () => {
    const html = prerender(<Mermaid source={SOURCE} />)
    const code = prerender(<Code content={SOURCE} language="mermaid" />)
    expect(html).toContain('<figure data-kind="diagram">')
    expect(html).toContain(code)
    expect(html).not.toContain('<img')
  })

  it('the block is drawn plain, so no highlighter loads for what is about to be replaced', () => {
    const html = prerender(<Code content={SOURCE} language="mermaid" highlight={false} />)
    expect(html).toBe(prerender(<Code content={SOURCE} language="mermaid" />))
    expect(html).not.toContain('highlight')
  })

  it('nothing is drawn until it comes near the view', () => {
    render(<Mermaid source={SOURCE} />)
    expect(draws.calls).toEqual([])
    expect(observers[0].options.rootMargin).toBe('400px')
  })

  it('the picture replaces the code, at the size it was drawn', async () => {
    draws.next = () => PICTURE
    const { container } = render(<Mermaid source={SOURCE} />)
    scrollIntoView()
    await waitFor(() => expect(container.querySelector('img')).not.toBeNull())
    const img = container.querySelector('img')
    expect(img.getAttribute('src')).toBe(PICTURE.src)
    expect(img.getAttribute('width')).toBe('400')
    expect(img.getAttribute('height')).toBe('100')
    expect(img.style.maxWidth).toBe('100%')
    expect(container.querySelector('pre')).toBeNull()
  })

  it('⛔ a diagram the engine cannot draw stays code', async () => {
    draws.next = () => null
    const { container } = render(<Mermaid source="flowchart LR\n  A[unclosed --> B" />)
    scrollIntoView()
    await waitFor(() => expect(draws.calls.length).toBe(1))
    await act(async () => {})
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('pre').textContent).toContain('unclosed')
  })

  it('an empty source asks the engine for nothing', async () => {
    render(<Mermaid source={'  \n'} />)
    scrollIntoView()
    await act(async () => {})
    expect(draws.calls).toEqual([])
  })

  it('⛔ a picture made for other text is not drawn: the block shows its source until its own arrives', async () => {
    draws.next = () => PICTURE
    const { container, rerender } = render(<Mermaid source={SOURCE} />)
    scrollIntoView()
    await waitFor(() => expect(container.querySelector('img')).not.toBeNull())

    let release
    draws.next = () => new Promise((resolve) => (release = () => resolve({ ...PICTURE, src: 'data:second' })))
    rerender(<Mermaid source="flowchart LR\n  C --> D" />)
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('pre').textContent).toContain('C --> D')

    await act(async () => release())
    expect(container.querySelector('img').getAttribute('src')).toBe('data:second')
  })

  it('coming back to a diagram already drawn shows it at once', async () => {
    const source = 'flowchart LR\n  E --> F'
    draws.next = () => PICTURE
    const first = render(<Mermaid source={source} />)
    scrollIntoView()
    await waitFor(() => expect(first.container.querySelector('img')).not.toBeNull())
    first.unmount()

    const second = render(<Mermaid source={source} />)
    expect(second.container.querySelector('img')).not.toBeNull()
  })
})

describe('what the picture says, for someone who cannot see it', () => {
  async function drawnAlt(props, label) {
    draws.next = () => ({ ...PICTURE, label })
    const { container } = render(<Mermaid source={SOURCE} {...props} />)
    scrollIntoView()
    await waitFor(() => expect(container.querySelector('img')).not.toBeNull())
    return container.querySelector('img').getAttribute('alt')
  }

  it('the diagram’s own title and description', async () => {
    expect(await drawnAlt({}, 'Two steps: A goes to B')).toBe('Two steps: A goes to B')
  })

  it('the foundation’s words win', async () => {
    expect(await drawnAlt({ alt: 'The flow' }, 'Two steps')).toBe('The flow')
  })

  it('with neither, its source: the only text it has', async () => {
    expect(await drawnAlt({}, '')).toBe(SOURCE)
  })
})

describe('colours come from where the diagram sits', () => {
  function tokens(values) {
    const element = document.createElement('figure')
    for (const [name, value] of Object.entries(values)) element.style.setProperty(name, value)
    document.body.append(element)
    return element
  }

  it('each variable from the section’s tokens, as hex', () => {
    const theme = themeAt(
      tokens({ '--section': '#ffffff', '--body': '#111111', '--heading': '#000000', '--subtle': '#555555', '--border': '#dddddd', '--card': '#f5f5f5' })
    )
    expect(theme).toMatchObject({
      darkMode: false,
      background: '#ffffff',
      primaryColor: '#f5f5f5',
      primaryTextColor: '#111111',
      primaryBorderColor: '#dddddd',
      lineColor: '#555555',
      textColor: '#111111',
      titleColor: '#000000',
    })
    // What Mermaid's base theme can read: its engine parses hex and nothing else here.
    for (const [name, value] of Object.entries(theme)) {
      if (name !== 'darkMode') expect(value, name).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it('a dark section says so, since Mermaid derives its shades from that', () => {
    expect(themeAt(tokens({ '--section': '#111827', '--body': '#eeeeee' })).darkMode).toBe(true)
  })

  it('a chart’s slices are the site’s palette, in steps the section’s text reads on', () => {
    const palette = { '--primary-200': '#aaaaaa', '--primary-400': '#bbbbbb', '--primary-800': '#111111', '--primary-600': '#222222' }
    const light = themeAt(tokens({ '--section': '#ffffff', '--body': '#111111', ...palette }))
    expect([light.pie1, light.pie2]).toEqual(['#aaaaaa', '#bbbbbb'])
    const dark = themeAt(tokens({ '--section': '#000000', '--body': '#eeeeee', ...palette }))
    expect([dark.pie1, dark.pie2]).toEqual(['#111111', '#222222'])
  })

  it('with no palette, a chart is left to Mermaid rather than told nothing', () => {
    const theme = themeAt(tokens({ '--section': '#ffffff', '--body': '#111111' }))
    expect(Object.keys(theme).filter((name) => name.startsWith('pie'))).toEqual([])
  })

  it('a token the canvas cannot read falls back rather than drawing black on black', () => {
    const theme = themeAt(tokens({ '--section': '#ffffff', '--body': '#111111', '--border': 'not-a-colour' }))
    expect(theme.primaryBorderColor).toBe(theme.lineColor)
  })
})

describe('the frame has no way to the page', () => {
  it('⛔ it may run scripts and nothing else', () => {
    sandbox.realDrawDiagram(SOURCE, {})
    const frame = document.querySelector('iframe')
    expect(frame.getAttribute('sandbox')).toBe('allow-scripts')
    expect(frame.getAttribute('aria-hidden')).toBe('true')
    expect(frame.tabIndex).toBe(-1)
    expect(frame.srcdoc).toContain(sandbox.mermaidUrl())
    // It measures what it draws, so it has a layout, and it takes no room in the page's.
    expect(frame.style.position).toBe('fixed')
    expect(frame.style.display).not.toBe('none')
  })

  it('an address can’t close the frame’s script', () => {
    const html = sandbox.frameDocument('https://x.test/</script><script>alert(1)</script>')
    expect(html.match(/<\/script>/g)).toHaveLength(1)
    expect(html.match(/<script/g)).toHaveLength(1)
  })

  it('the page is told only strings and numbers, and strict stays on in the frame', () => {
    const html = sandbox.frameDocument(sandbox.mermaidUrl())
    expect(html).toContain("securityLevel: 'strict'")
    expect(html).not.toContain('allow-same-origin')
  })
})

describe('where the engine comes from', () => {
  afterEach(() => {
    delete globalThis.uniweb
  })

  it('one exact version: a new release reaches no page until it is chosen', () => {
    expect(sandbox.MERMAID_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
    expect(sandbox.mermaidUrl()).toBe(
      `https://cdn.jsdelivr.net/npm/mermaid@${sandbox.MERMAID_VERSION}/dist/mermaid.esm.min.mjs`
    )
  })

  it('the base a host names for the corpus', () => {
    globalThis.uniweb = { activeWebsite: { config: { syntax: { cdnUrl: 'https://mirror.test/npm/' } } } }
    expect(sandbox.mermaidUrl()).toBe(
      `https://mirror.test/npm/mermaid@${sandbox.MERMAID_VERSION}/dist/mermaid.esm.min.mjs`
    )
  })
})

describe('a foundation’s seam: `components`, one entry per element type', () => {
  const nodes = [
    { type: 'codeBlock', attrs: { language: 'mermaid' }, content: [{ type: 'text', text: SOURCE }] },
    { type: 'dataBlock', attrs: { tag: 'quiz', language: 'json', data: { q: 'Why?' } } },
    { type: 'codeBlock', attrs: { language: 'js' }, content: [{ type: 'text', text: 'const a = 1' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'After.' }] },
  ]

  function CodeBlock({ element: { text, attrs } }) {
    return attrs?.language === 'mermaid' ? <Mermaid source={text} /> : <Code content={text} language={attrs?.language} />
  }

  // What kit's text and links read of the site: a prerendered page has no router either.
  beforeEach(() => {
    globalThis.uniweb = {
      activeWebsite: { basePath: '', getRoutingComponents: () => ({}), localize: (v, d = '') => v ?? d },
      routingComponents: {},
    }
  })
  afterEach(() => {
    delete globalThis.uniweb
  })

  it('a fence by its language, and everything else stays kit’s', () => {
    const html = prerender(<Render content={nodes} components={{ codeBlock: CodeBlock }} />)
    expect(html).toContain('data-kind="diagram"')
    expect(html).toContain('const a = 1')
    expect(html.match(/data-kind="diagram"/g)).toHaveLength(1)
    expect(html).toContain('<p>')
  })

  it('a data block is drawn where the author put it', () => {
    const Quiz = ({ element }) => <aside data-quiz={element.tag}>{element.data.q}</aside>
    const html = prerender(<Render content={nodes} components={{ dataBlock: Quiz }} />)
    expect(html).toContain('<aside data-quiz="quiz">Why?</aside>')
    expect(html.indexOf('data-quiz')).toBeLessThan(html.indexOf('const a = 1'))
  })

  it('with no entry a data block draws nothing, and a mermaid fence stays code', () => {
    const html = prerender(<Render content={nodes} />)
    expect(html).not.toContain('Why?')
    expect(html).not.toContain('data-kind="diagram"')
    expect(html).toContain('language-mermaid')
  })

  it('⛔ <Section> hands it on, and doesn’t write it on its element', () => {
    const html = prerender(<Section content={nodes} components={{ codeBlock: CodeBlock }} />)
    expect(html).toContain('data-kind="diagram"')
    expect(html).not.toContain('components=')
  })
})

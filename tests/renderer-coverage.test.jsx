/**
 * One content engine, and what it is not allowed to decide.
 *
 * kit used to have TWO node walkers — `Render` over raw ProseMirror and
 * `Prose` over the parsed sequence — for one job. This file used to document
 * the divergence between them as deliberate, including "only the document
 * renderer handles tables", which was a bug frozen into an assertion.
 *
 * They rotted the way a second implementation does, and the damage was
 * measured on 2026-07-30 before the merge:
 *
 *   Render : <p><span>Hello world and docs</span></p>          ← marks GONE
 *   Prose  : <p><span>Hello <strong>world</strong> and
 *                <a href="/d">docs</a></span></p>
 *   Render : (empty)                                           ← math GONE
 *
 * `Article` was built on `Render`, so the component documented for "blog posts,
 * news articles, documentation pages" rendered them with no bold, no links and
 * no math. Every suite passed throughout.
 *
 * So the tests below are about the two things that keep that from recurring:
 * there is one walk, and it does not make design decisions.
 */

import React from 'react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { renderToStaticMarkup } from 'react-dom/server'
import { Render, SequenceElement, NOT_RENDERED } from '../src/styled/Render/index.jsx'
import { Prose } from '../src/styled/Prose/index.jsx'
import { Article } from '../src/styled/Article/index.jsx'

const read = rel => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

/** Install a minimal Uniweb singleton — what useWebsite() reads. */
function withWebsite(fn) {
  const prev = globalThis.uniweb
  globalThis.uniweb = { activeWebsite: { basePath: '' }, routingComponents: {} }
  try {
    return fn()
  } finally {
    globalThis.uniweb = prev
  }
}

const html = el => withWebsite(() => renderToStaticMarkup(el))

// Raw ProseMirror, as content-reader emits it. Passing THIS rather than a
// pre-parsed sequence is the point: the engine runs it through the parser, and
// that is what makes marks work.
const pm = nodes => ({ type: 'doc', content: nodes })

const para = (...content) => ({ type: 'paragraph', content })
const text = (t, ...marks) => (marks.length ? { type: 'text', text: t, marks } : { type: 'text', text: t })

describe('inline marks survive — the defect that motivated the merge', () => {
  const doc = pm([
    para(
      text('Hello '),
      text('world', { type: 'bold' }),
      text(' and '),
      text('docs', { type: 'link', attrs: { href: '/d' } })
    ),
  ])

  it.each([
    ['Render', <Render content={doc} />],
    ['Prose', <Prose content={doc} />],
    ['Article', <Article content={doc} />],
  ])('%s keeps bold and links', (_name, el) => {
    const out = html(el)
    expect(out).toContain('<strong>world</strong>')
    expect(out).toContain('href="/d"')
    // The old failure mode exactly: flattened to plain text.
    expect(out).not.toContain('Hello world and docs')
  })
})

describe('math renders — it used to vanish from every Article', () => {
  const doc = pm([
    { type: 'math_display', attrs: { latex: 'x^2', mathml: '<math><mi>x</mi></math>' } },
  ])

  it.each([
    ['Render', <Render content={doc} />],
    ['Prose', <Prose content={doc} />],
    ['Article', <Article content={doc} />],
  ])('%s emits the pre-compiled MathML', (_name, el) => {
    expect(html(el)).toContain('<math><mi>x</mi></math>')
  })
})

describe('tables render — they used to be destroyed at the parser', () => {
  const cell = (t, attrs = {}) => ({
    type: 'tableCell',
    attrs: { header: false, align: null, colspan: 1, rowspan: 1, ...attrs },
    content: [para(typeof t === 'string' ? text(t) : t)],
  })

  const doc = pm([
    {
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [cell('Name', { header: true }), cell('Qty', { header: true, align: 'right' })],
        },
        {
          type: 'tableRow',
          content: [cell(text('Bolt', { type: 'bold' })), cell('12', { colspan: 2 })],
        },
      ],
    },
  ])

  it('scrolls when it overflows — the one class, and it is behaviour', () => {
    // Not decoration: a table wider than its column pushes the page sideways
    // without it. A real docs site has no table CSS of its own and relied on
    // kit for exactly this.
    expect(html(<Render content={doc} />)).toContain('overflow-x-auto')
  })

  it('emits a real table, with a head', () => {
    const out = html(<Render content={doc} />)
    expect(out).toContain('<thead>')
    expect(out).toContain('<th')
    expect(out).toContain('<tbody>')
  })

  it('carries alignment and spans', () => {
    const out = html(<Render content={doc} />)
    expect(out).toMatch(/text-align:\s*right/)
    // Case-insensitive: React 19 emits the prop verbatim (`colSpan="2"`), and
    // HTML attribute names are case-insensitive, so the browser reads it fine.
    expect(out).toMatch(/colspan="2"/i)
  })

  it('a cell keeps its marks — it renders a nested sequence, not a text scrape', () => {
    // The old Table renderer read `cell.content[0].content[0].text`, so a cell
    // was truncated to its first text run with marks discarded.
    expect(html(<Render content={doc} />)).toContain('<strong>Bolt</strong>')
  })

  it('reaches Prose too, which had no table at all', () => {
    expect(html(<Prose content={doc} />)).toContain('<th')
  })
})

describe('the engine does not decide design', () => {
  it('Render returns a FRAGMENT — no wrapper, no classes', () => {
    // What makes it usable as an engine. It used to emit
    // `<div class="space-y-4">`, which fought any container it was placed in.
    const out = html(<Render content={pm([para(text('Hi'))])} />)
    expect(out).toBe('<p><span>Hi</span></p>')
  })

  it('emits semantic markup with no utility classes', () => {
    // The previous walker carried 23 hardcoded utility strings, `italic
    // text-subtle` on blockquote among them — kit deciding a foundation's
    // design, unreachable without forking the walk.
    const doc = pm([
      { type: 'blockquote', content: [para(text('Quoted'))] },
      { type: 'bulletList', content: [{ type: 'listItem', content: [para(text('One'))] }] },
    ])
    const out = html(<Render content={doc} />)
    expect(out).toContain('<blockquote>')
    expect(out).toContain('<ul>')
    expect(out).not.toMatch(/class="[^"]*(italic|border-l-4|pl-6|my-4)/)
    // `overflow-x-auto` on a table wrapper is the one survivor, and it is
    // structural — see the table block above.
  })

  it('answers for no name — not a component, not a concept tag', () => {
    // Source-level, because the dispatch it forbids would be three lines inside
    // a case and invisible to every behavioural test here. A foundation
    // shipping its own Alert must not be shadowed by kit's, and kit rendering
    // its own accordion for `faq` is the same shadowing one layer over.
    const source = read('../src/styled/Render/index.jsx')
    expect(source).not.toMatch(/===\s*'(Details|Alert|Warning)'/)
    expect(source).not.toMatch(/===\s*'(faq|details|alert|warning|note|tip|steps)'/)
  })

  it('keeps a container visible rather than dropping its body', () => {
    const doc = pm([
      { type: 'concept_block', attrs: { tag: 'zzz-unknown' }, content: [para(text('Body text'))] },
    ])
    const out = html(<Render content={doc} />)
    expect(out).toContain('data-concept="zzz-unknown"')
    expect(out).toContain('Body text')
  })
})

describe('components — the seam that replaces hardcoded styling', () => {
  const doc = pm([
    { type: 'concept_block', attrs: { tag: 'faq' }, content: [para(text('A question'))] },
  ])

  it('an override replaces the default entirely', () => {
    const Faq = ({ element }) => <section data-mine={element.tag} />
    expect(html(<Render content={doc} components={{ concept_block: Faq }} />)).toBe(
      '<section data-mine="faq"></section>'
    )
  })

  it('a container override receives rendered children — no need to re-walk', () => {
    const Faq = ({ children }) => <section className="mine">{children}</section>
    const out = html(<Render content={doc} components={{ concept_block: Faq }} />)
    expect(out).toContain('class="mine"')
    expect(out).toContain('A question')
  })

  it('a leaf override receives the element', () => {
    const Quote = ({ element }) => <aside>{element.children?.length} block(s)</aside>
    const quoteDoc = pm([{ type: 'blockquote', content: [para(text('x'))] }])
    expect(html(<Render content={quoteDoc} components={{ blockquote: Quote }} />)).toBe(
      '<aside>1 block(s)</aside>'
    )
  })

  it('flows through Prose and Article', () => {
    const Faq = () => <section data-mine="yes" />
    expect(html(<Prose content={doc} components={{ concept_block: Faq }} />)).toContain('data-mine')
    expect(html(<Article content={doc} components={{ concept_block: Faq }} />)).toContain('data-mine')
  })
})

describe('what is deliberately not rendered', () => {
  it('each omission carries a stated reason', () => {
    // A drop nobody wrote down is indistinguishable from a drop nobody noticed
    // — which is how math went missing. Every entry has to say why.
    expect(Object.keys(NOT_RENDERED).length).toBeGreaterThan(0)
    for (const [type, reason] of Object.entries(NOT_RENDERED)) {
      expect(typeof reason, `${type} needs a reason`).toBe('string')
      expect(reason.length).toBeGreaterThan(20)
    }
  })

  it('a data block renders nothing — it is read from content.data', () => {
    const doc = pm([{ type: 'dataBlock', attrs: { tag: 'nav', language: 'yaml', data: [{ label: 'Home' }] } }])
    expect(html(<Render content={doc} />)).toBe('')
    expect(NOT_RENDERED.dataBlock).toBeTruthy()
  })
})

describe('the wrappers are wrappers', () => {
  const doc = pm([para(text('Body'))])

  it('Prose supplies the typography container', () => {
    const out = html(<Prose content={doc} />)
    expect(out).toMatch(/^<div class="prose prose-lg max-w-none">/)
  })

  it('Article supplies the element — that is its whole job', () => {
    expect(html(<Article content={doc} />)).toMatch(/^<article class="prose/)
  })

  it('neither adds a palette modifier', () => {
    // prose-tokens.css: a modifier "re-declares every variable below", which
    // defeats the bridge that makes prose answer to the site's theme.yml.
    // `Section` shipped `prose-gray` for exactly this reason until 2026-07-30.
    for (const source of ['../src/styled/Prose/index.jsx', '../src/styled/Article/index.jsx', '../src/styled/Section/Section.jsx']) {
      expect(read(source)).not.toMatch(/["'\s]prose-(gray|slate|zinc|neutral|stone)\b/)
    }
  })

  it('Prose still works as a pure typography wrapper', () => {
    expect(html(<Prose size="base"><h2>Title</h2></Prose>)).toBe(
      '<div class="prose prose-base max-w-none"><h2>Title</h2></div>'
    )
  })
})

describe('there is ONE walk', () => {
  it('only the engine dispatches on element type', () => {
    // The regression this whole file exists for: a second node table, added
    // for a good local reason, that then drifts. If a wrapper grows a switch
    // over element types, it has started being a renderer again.
    for (const source of ['../src/styled/Prose/index.jsx', '../src/styled/Article/index.jsx']) {
      expect(read(source)).not.toMatch(/case\s+['"]paragraph['"]/)
    }
    expect(read('../src/styled/Render/index.jsx')).toMatch(/case\s+['"]paragraph['"]/)
  })

  it('SequenceElement is exported, so an override can recurse if it must', () => {
    expect(typeof SequenceElement).toBe('function')
  })
})

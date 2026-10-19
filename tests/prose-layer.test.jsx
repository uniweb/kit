/**
 * Kit's prose layer — `prose-tokens.css`, kit's own rules since 2026-10-19, in
 * place of Tailwind Typography.
 *
 * What these pin:
 *   - one import is the whole setup: no plugin, no dependency;
 *   - no color variable is declared — colors are the section's theme tokens,
 *     read where they are used, so a nested container changes nothing;
 *   - every rule sits in `@layer components`, beneath every utility (kit's own
 *     rules used to be unlayered, and beat every utility whatever its
 *     specificity);
 *   - the class names a developer writes keep working: the five steps, as
 *     utilities so `lg:prose-xl` works, and the 33 element variants;
 *   - every element `<Render>` emits for the vocabulary has a rule, or is named
 *     below as needing none — so a new element type fails here instead of
 *     reaching a page unstyled;
 *   - it compiles, with Tailwind, to less than Tailwind Typography's one size.
 */

import React from 'react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { gzipSync } from 'node:zlib'
import { renderToStaticMarkup } from 'react-dom/server'
import { compile } from 'tailwindcss'
import { Render } from '../src/styled/Render/index.jsx'

const at = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
const css = at('../src/prose-tokens.css')
const code = css.replace(/\/\*[\s\S]*?\*\//g, '')
const pkg = JSON.parse(at('../package.json'))

/** Each rule's selector, outside comments. */
const selectors = [...code.matchAll(/([^{};]+)\{/g)].map((m) => m[1].trim()).filter((s) => !s.startsWith('@'))

describe('one import is the whole setup', () => {
  it('brings no plugin, so it needs no dependency', () => {
    expect(code).not.toMatch(/@plugin\b/)
    expect(pkg.dependencies).not.toHaveProperty('@tailwindcss/typography')
  })

  it('is the entry point it always was', () => {
    expect(pkg.exports['./prose-tokens.css']).toBe('./src/prose-tokens.css')
  })
})

describe('the colors are the section’s', () => {
  it('declares no variable but its own private step values', () => {
    // Tailwind Typography declared 18 color variables on every `prose` element,
    // so a nested container reset them, and a palette modifier re-declared them
    // with fixed greys. Nothing here can.
    const declared = [...code.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1])
    expect(declared.length).toBeGreaterThan(0)
    for (const name of declared) expect(name, `declares ${name}`).toMatch(/^--_prose-/)
  })

  it('writes no color as a literal — every one is a theme token', () => {
    expect(code).not.toMatch(/#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\(/i)
  })
})

describe('beneath every utility', () => {
  it('holds every rule in @layer components — beside only the variants and the steps', () => {
    const top = []
    let depth = 0
    let start = 0
    for (let i = 0; i < code.length; i++) {
      const ch = code[i]
      if (ch === '{') {
        if (depth === 0) top.push(code.slice(start, i).trim())
        depth++
      } else if (ch === '}') {
        depth--
        if (depth === 0) start = i + 1
      } else if (ch === ';' && depth === 0) {
        top.push(code.slice(start, i).trim())
        start = i + 1
      }
    }
    expect(top.filter((head) => !/^(@custom-variant prose-|@utility prose-|@layer components$)/.test(head))).toEqual([])
  })
})

describe('the class names a developer writes keep working', () => {
  it('the five steps are utilities, so a responsive one works', () => {
    for (const step of ['sm', 'base', 'lg', 'xl', '2xl']) expect(code).toMatch(new RegExp(`@utility prose-${step} \\{`))
  })

  const VARIANTS = [
    'headings', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'a', 'blockquote', 'figure', 'figcaption', 'strong',
    'em', 'kbd', 'code', 'pre', 'ol', 'ul', 'li', 'dl', 'dt', 'dd', 'table', 'thead', 'tr', 'th', 'td', 'img',
    'picture', 'video', 'hr', 'lead',
  ]

  it('the 33 element variants, each outside not-prose', () => {
    expect(VARIANTS).toHaveLength(33)
    for (const name of VARIANTS) {
      expect(code, `prose-${name}:`).toMatch(new RegExp(`@custom-variant prose-${name} \\(& :where\\([^)]*\\):not\\(:where\\(\\.not-prose, \\.not-prose \\*\\)\\)\\);`))
    }
  })
})

describe('every element <Render> emits has a rule', () => {
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

  const text = (t, ...marks) => (marks.length ? { type: 'text', text: t, marks } : { type: 'text', text: t })
  const para = (...content) => ({ type: 'paragraph', content })
  const heading = (level, t, attrs = {}) => ({ type: 'heading', attrs: { level, ...attrs }, content: [text(t)] })
  const item = (...blocks) => ({ type: 'listItem', content: blocks })
  const cell = (t, header = false) => ({ type: 'tableCell', attrs: { header }, content: [para(text(t))] })

  // The vocabulary's nodes and marks, each in the shape a section carries it.
  const doc = {
    type: 'doc',
    content: [
      heading(2, 'Kicker', { role: 'pretitle' }),
      ...[1, 2, 3, 4, 5, 6].map((level) => heading(level, `Heading ${level}`)),
      para(
        text('bold', { type: 'bold' }), text(' italic', { type: 'italic' }), text(' code', { type: 'code' }),
        text(' gone', { type: 'strike' }), text(' accent', { type: 'span', attrs: { accent: true } }),
        text(' link', { type: 'link', attrs: { href: '/a' } }), { type: 'hardBreak' },
        text('join', { type: 'button', attrs: { href: '/join' } })
      ),
      para(text('Go', { type: 'button', attrs: { href: '/go' } })),
      { type: 'bulletList', content: [item(para(text('one')), { type: 'bulletList', content: [item(para(text('inner')))] })] },
      { type: 'orderedList', attrs: { start: 3, loose: true }, content: [item(para(text('three')))] },
      { type: 'blockquote', content: [para(text('quoted'))] },
      { type: 'codeBlock', attrs: { language: 'js' }, content: [text('let x = 1')] },
      { type: 'math_display', attrs: { latex: 'x', mathml: '<math><mi>x</mi></math>' } },
      { type: 'table', content: [{ type: 'tableRow', content: [cell('Name', true)] }, { type: 'tableRow', content: [cell('Bolt')] }] },
      { type: 'image', attrs: { src: '/a.png', caption: 'A picture', author: 'Ada', placement: 'wide' } },
      { type: 'image', attrs: { src: '/r.pdf', role: 'pdf', alt: 'Report', author: 'Ada' } },
      { type: 'divider' },
      { type: 'concept_block', attrs: { tag: 'note' }, content: [para(text('noted'))] },
      { type: 'inset_block', attrs: { component: 'Alert' }, content: [para(text('inside'))] },
    ],
  }

  const html = withWebsite(() => renderToStaticMarkup(<Render content={doc} />))

  // What needs no rule of this layer's, and why.
  const NEEDS_NO_RULE = {
    span: 'an inline wrapper the text sits in — a styled span is the theme’s `inline` styles',
    em: 'the browser draws it in italic, and nothing resets that (Tailwind Typography had no rule for it either)',
    div: 'a box: a table’s or a code block’s scrolling box, display maths (`.math-display`), a callout or an inset block — each matched by its class or attribute where it needs one',
    tbody: 'its rows and cells carry the rules',
    br: 'a line break',
    svg: 'an icon or a file badge, sized by its component',
    path: 'inside an svg',
    math: 'MathML, laid out by math-tokens.css',
    mi: 'MathML, laid out by math-tokens.css',
  }
  const STYLED_ELSEWHERE = {
    'data-concept': 'a callout — callout-tokens.css draws it',
  }

  const isStyled = (token) =>
    selectors.some((s) => new RegExp(`(^|[\\s(,>+~])${token}(?=$|[\\s),.:\\[>+~])`).test(s))

  it('every tag', () => {
    const tags = [...new Set([...html.matchAll(/<([a-z][a-z0-9]*)/g)].map((m) => m[1]))]
    expect(tags.length).toBeGreaterThan(15)
    const missing = tags.filter((tag) => !NEEDS_NO_RULE[tag] && !isStyled(tag))
    expect(missing, `emitted by <Render> with no rule:\n${html}`).toEqual([])
  })

  it('every hook it marks an element with', () => {
    const hooks = [...new Set([...html.matchAll(/(data-(?:role|kind)="[^"]*"|data-(?:placement|inset-block|concept))/g)].map((m) => m[1]))]
    expect(hooks).toEqual(expect.arrayContaining(['data-role="pretitle"', 'data-role="button"', 'data-role="author"', 'data-kind="document"', 'data-placement', 'data-inset-block']))
    const missing = hooks.filter((hook) => !STYLED_ELSEWHERE[hook] && !code.includes(hook.includes('=') ? hook : `[${hook}`))
    expect(missing).toEqual([])
  })
})

describe('compiled with Tailwind', () => {
  const require = createRequire(import.meta.url)
  const files = {
    tailwindcss: require.resolve('tailwindcss/index.css'),
    theme: fileURLToPath(new URL('../src/theme-tokens.css', import.meta.url)),
    prose: fileURLToPath(new URL('../src/prose-tokens.css', import.meta.url)),
  }

  async function build(candidates, { prose = true } = {}) {
    const input = `@import "tailwindcss";\n@import "${files.theme}";\n${prose ? `@import "${files.prose}";` : ''}`
    const compiler = await compile(input, {
      base: process.cwd(),
      loadStylesheet: async (id) => {
        const path = id === 'tailwindcss' ? files.tailwindcss : id
        return { path, base: process.cwd(), content: readFileSync(path, 'utf8') }
      },
    })
    return compiler.build(candidates)
  }

  it('the variants and a responsive step compile, over the right elements', async () => {
    const out = await build(['prose', 'prose-headings:underline', 'prose-a:text-heading', 'lg:prose-xl'])
    expect(out).toMatch(/\.prose-headings\\:underline :where\(h1, h2, h3, h4, h5, h6, th\)/)
    expect(out).toMatch(/\.prose-a\\:text-heading :where\(a\)/)
    expect(out).toMatch(/\.lg\\:prose-xl \{\s*--_prose-step: 1\.25;/)
  })

  it('what it no longer has emits nothing — a palette modifier or prose-invert left in a class list is inert', async () => {
    const out = await build(['prose', 'prose-slate', 'prose-gray', 'prose-invert'])
    expect(out).not.toMatch(/\.prose-(slate|gray|invert)\b/)
  })

  it('weighs less than Tailwind Typography’s one size did', async () => {
    // Measured 2026-10-19 (kb/framework/plans/kit-prose-layer.md §2.3): Typography
    // added 2.5 KB gzip for one size and 4.1 KB for the five kit names. This is
    // all five, unminified.
    const steps = ['prose', 'prose-sm', 'prose-base', 'prose-lg', 'prose-xl', 'prose-2xl', 'max-w-none']
    const [withProse, without] = await Promise.all([build(steps), build(steps, { prose: false })])
    const added = gzipSync(withProse).length - gzipSync(without).length
    expect(added).toBeLessThan(2.5 * 1024)
  })
})

/**
 * Kit's prose layer — `prose-tokens.css`, kit's own rules since 2026-10-19, in
 * place of Tailwind Typography.
 *
 * What these pin:
 *   - one import is the whole setup: no plugin, no dependency;
 *   - no color variable is declared — colors are the section's theme tokens,
 *     read where they are used, so a nested container re-points none;
 *   - every rule sits in `@layer components`, beneath every utility (kit's own
 *     rules used to be unlayered, and beat every utility whatever its
 *     specificity), whichever import comes first;
 *   - each step carries Tailwind Typography's values for its size, every one,
 *     and where the cascade decides, it decides as Typography's did;
 *   - the class names a developer writes keep working: the five steps, as
 *     utilities so `lg:prose-xl` works, and the 33 element variants;
 *   - every element `<Render>` emits for the vocabulary has a rule, or is named
 *     below as needing none — so a new element type fails here instead of
 *     reaching a page unstyled;
 *   - it compiles, with Tailwind, to less than Tailwind Typography did.
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
    expect(top.filter((head) => !/^(@layer theme, base, components, utilities$|@custom-variant prose-|@utility prose-|@layer components$)/.test(head))).toEqual([])
  })

  it('states the layer order before any rule, so it holds whichever import comes first', () => {
    expect(code.trimStart()).toMatch(/^@layer theme, base, components, utilities;/)
  })
})

describe("Tailwind Typography's values, at every step", () => {
  // Typography 0.5.20's own numbers, each size modifier's, as its src/styles.js
  // writes them (fixtures/typography-0.5.20-steps.json). Each variable a step sets
  // stands for the Typography values named here — one number at every step, or
  // the test says where they part. ⛔ Until 2026-10-19 a step set seven, rounded to
  // three places, and every other value was the base step's in em: 1–5px off at
  // `prose-lg`, up to 24px at `prose-2xl`.
  const typography = JSON.parse(at('./fixtures/typography-0.5.20-steps.json'))
  const STANDS_FOR = {
    step: [':root :: fontSize'],
    leading: [':root :: lineHeight'],
    flow: ['p :: marginTop', 'p :: marginBottom', 'ol :: marginTop', 'ol :: marginBottom', 'ul :: marginTop', 'ul :: marginBottom', 'dl :: marginTop', 'dl :: marginBottom', 'dt :: marginTop', '> ul > li > p:first-child :: marginTop', '> ul > li > p:last-child :: marginBottom', '> ol > li > p:first-child :: marginTop', '> ol > li > p:last-child :: marginBottom'],
    item: ['li :: marginTop', 'li :: marginBottom', 'dd :: marginTop'],
    h1: ['h1 :: fontSize'],
    h2: ['h2 :: fontSize'],
    h3: ['h3 :: fontSize'],
    small: ['kbd :: fontSize', 'pre :: fontSize', 'table :: fontSize', 'figcaption :: fontSize'],
    lead: ['[class~="lead"] :: fontSize'],
    'lead-leading': ['[class~="lead"] :: lineHeight'],
    'lead-flow': ['[class~="lead"] :: marginTop', '[class~="lead"] :: marginBottom'],
    'quote-flow': ['blockquote :: marginTop', 'blockquote :: marginBottom'],
    'quote-pad': ['blockquote :: paddingInlineStart'],
    'h1-leading': ['h1 :: lineHeight'],
    'h1-after': ['h1 :: marginBottom'],
    'h2-leading': ['h2 :: lineHeight'],
    'h2-before': ['h2 :: marginTop'],
    'h2-after': ['h2 :: marginBottom'],
    'h3-leading': ['h3 :: lineHeight'],
    'h3-before': ['h3 :: marginTop'],
    'h3-after': ['h3 :: marginBottom'],
    'h4-leading': ['h4 :: lineHeight'],
    'h4-before': ['h4 :: marginTop'],
    'h4-after': ['h4 :: marginBottom'],
    media: ['img :: marginTop', 'img :: marginBottom', 'picture :: marginTop', 'picture :: marginBottom', 'video :: marginTop', 'video :: marginBottom', 'figure :: marginTop', 'figure :: marginBottom'],
    'kbd-radius': ['kbd :: borderRadius'],
    'kbd-y': ['kbd :: paddingTop', 'kbd :: paddingBottom'],
    'kbd-x': ['kbd :: paddingInlineStart', 'kbd :: paddingInlineEnd'],
    'pre-leading': ['pre :: lineHeight'],
    'pre-flow': ['pre :: marginTop', 'pre :: marginBottom'],
    'pre-radius': ['pre :: borderRadius'],
    'pre-y': ['pre :: paddingTop', 'pre :: paddingBottom'],
    'pre-x': ['pre :: paddingInlineStart', 'pre :: paddingInlineEnd'],
    indent: ['ol :: paddingInlineStart', 'ul :: paddingInlineStart', 'dd :: paddingInlineStart'],
    'li-pad': ['ol > li :: paddingInlineStart', 'ul > li :: paddingInlineStart'],
    'li-p': ['> ul > li p :: marginTop', '> ul > li p :: marginBottom'],
    nested: ['ul ul, ul ol, ol ul, ol ol :: marginTop', 'ul ul, ul ol, ol ul, ol ol :: marginBottom'],
    hr: ['hr :: marginTop', 'hr :: marginBottom'],
    'table-leading': ['table :: lineHeight'],
    'cell-x': ['thead th :: paddingInlineStart', 'thead th :: paddingInlineEnd', 'tbody td, tfoot td :: paddingInlineStart', 'tbody td, tfoot td :: paddingInlineEnd'],
    'cell-y': ['thead th :: paddingBottom', 'tbody td, tfoot td :: paddingTop', 'tbody td, tfoot td :: paddingBottom'],
    'caption-leading': ['figcaption :: lineHeight'],
    'caption-gap': ['figcaption :: marginTop'],
  }
  // What kit draws its own way: inline code is a chip at 0.875em of its text at
  // every step, in a heading too, as kit drew it over Typography before.
  const KIT_OWN = ['code :: fontSize', 'h2 code :: fontSize', 'h3 code :: fontSize']
  const declared = (body) => Object.fromEntries([...body.matchAll(/--_prose-([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]))
  const stepBody = (step) => code.match(new RegExp(`@utility prose-${step} \\{([^}]*)\\}`))[1]

  it('every value Typography sets by step is one a step carries, or kit’s own', () => {
    const carried = new Set(Object.values(STANDS_FOR).flat())
    const zero = (values) => values.every((v) => v === '0')
    const left = Object.entries(typography.values).filter(([key, values]) => !carried.has(key) && !KIT_OWN.includes(key) && !zero(values))
    expect(left.map(([key]) => key)).toEqual([])
  })

  typography.steps.forEach((step, i) => {
    it(`prose-${step}`, () => {
      const values = declared(stepBody(step))
      expect(Object.keys(values).sort()).toEqual(Object.keys(STANDS_FOR).sort())
      for (const [name, keys] of Object.entries(STANDS_FOR)) {
        for (const key of keys) {
          const want = typography.values[key][i]
          expect(values[name], `--_prose-${name} at prose-${step}, for ${key}`).toBe(name === 'step' ? want.replace(/rem$/, '') : want)
        }
      }
    })
  })

  it('the container starts at the base step', () => {
    const container = code.match(/\n {2}\.prose \{([^}]*)\}/)[1]
    expect(declared(container)).toEqual(declared(stepBody('base')))
  })

  it('every variable a step sets is one a rule reads', () => {
    const read = new Set([...code.matchAll(/var\(--_prose-([\w-]+)/g)].map((m) => m[1]))
    expect(Object.keys(STANDS_FOR).filter((name) => !read.has(name))).toEqual([])
  })
})

describe('where the cascade decides, it decides as Typography did', () => {
  const index = (selector) => {
    const at = selectors.findIndex((s) => s.startsWith(`.prose :where(${selector}`))
    expect(at, selector).toBeGreaterThan(-1)
    return at
  }

  it('a figure keeps its space below a heading — its rule after the edges, before the first child', () => {
    expect(index('figure)')).toBeGreaterThan(index('hr + *, h2 + *'))
    expect(index('figure)')).toBeLessThan(index('.prose > :first-child'))
  })

  it('a picture or a video inside a figure holds no space of its own', () => {
    expect(index('figure img, figure picture, figure video)')).toBeGreaterThan(index('img, picture, video)'))
  })

  it('typed lists — the case-sensitive rules after both case-insensitive ones', () => {
    expect(index('ol[type="A" s])')).toBeGreaterThan(index('ol[type="a"])'))
    expect(index('ol[type="I" s])')).toBeGreaterThan(index('ol[type="i"])'))
  })

  it('code in any heading takes the heading’s color', () => {
    const rule = selectors.find((s) => s.includes('h1 code, h2 code'))
    for (const tag of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']) expect(rule, tag).toContain(`${tag} code`)
  })

  it('a key keeps the text’s font', () => {
    expect(code).toMatch(/\.prose :where\(kbd\)[^{]*\{[^}]*font-family: inherit;/)
  })
})

describe('the variables a foundation declares are the ones the rules read', () => {
  it('each name, and each default the fallback the rule falls back to', async () => {
    const { proseVars } = await import('../src/prose-vars.js')
    for (const [name, { default: value }] of Object.entries(proseVars)) {
      // A declared default is written on :root, so it must be the rule's own
      // fallback; one that differed would override every step without a word.
      const read = value === undefined ? `var(--${name}, var(--_${name}))` : `var(--${name}, ${value})`
      expect(code, name).toContain(read)
    }
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
      expect(code, `prose-${name}:`).toMatch(new RegExp(`@custom-variant prose-${name} \\(& :where\\((?:[^()]|\\([^()]*\\))*\\):not\\(:where\\(\\.not-prose, \\.not-prose \\*\\)\\)\\);`))
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
    expect(out).toMatch(/\.prose-a\\:text-heading :where\(a:not\(\[data-role="button"\]\)\)/)
    expect(out).toMatch(/\.lg\\:prose-xl \{\s*--_prose-step: 1\.25;/)
  })

  it('imported before Tailwind, the rules still sit above the reset', async () => {
    const compiler = await compile(`@import "${files.prose}";\n@import "tailwindcss";`, {
      base: process.cwd(),
      loadStylesheet: async (id) => {
        const path = id === 'tailwindcss' ? files.tailwindcss : id
        return { path, base: process.cwd(), content: readFileSync(path, 'utf8') }
      },
    })
    const out = compiler.build(['prose'])
    // The first layer the output names — in a statement or a block — fixes the
    // order. Without the statement it was this file's `@layer components {`.
    expect(out.match(/@layer [^;{]+[;{]/)[0]).toBe('@layer theme, base, components, utilities;')
  })

  it('what it no longer has emits nothing — a palette modifier or prose-invert left in a class list is inert', async () => {
    const out = await build(['prose', 'prose-slate', 'prose-gray', 'prose-invert'])
    expect(out).not.toMatch(/\.prose-(slate|gray|invert)\b/)
  })

  it('weighs less than Tailwind Typography did — its five sizes, and its one', async () => {
    // Measured 2026-10-19, gzip: Typography added 4.1 KB for the five steps kit names
    // and 2.5 KB for one. Unminified here. Every per-step value raised this from
    // 2.1 to 2.9 KB for the five, and to 2.4 KB for `prose` and one step.
    const added = async (classes) => {
      const [withProse, without] = await Promise.all([build(classes), build(classes, { prose: false })])
      return gzipSync(withProse).length - gzipSync(without).length
    }
    expect(await added(['prose', 'prose-sm', 'prose-base', 'prose-lg', 'prose-xl', 'prose-2xl', 'max-w-none'])).toBeLessThan(4.1 * 1024)
    expect(await added(['prose', 'prose-lg', 'max-w-none'])).toBeLessThan(2.5 * 1024)
  })
})

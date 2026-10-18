/**
 * A document a component hands to <Render> — a record's body, passed to
 * <Article> or <Prose> — resolves an uploaded picture through the host's asset
 * pattern, as a section's own content does.
 *
 * A section's content is parsed by @uniweb/core when it builds the Block, with
 * `Block.parseOptions()`: the host's `config.assets.url`, which turns an image's
 * `assetId`/`assetExt` into the address the host serves it at. A record reaches
 * a component as stored, and the component renders its body through this
 * walker, which parsed it with no options until 2026-10-18 — so the picture fell
 * back to its stored `src`, a path on the backend that stored it, and a page
 * served from any other origin asked its own origin for it.
 */
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Block } from '@uniweb/core'
import { Render } from '../src/styled/Render/index.jsx'
import { Article } from '../src/styled/Article/index.jsx'

const PATTERN = 'https://assets.example.test/{id}.{ext}'

/** Install a minimal Uniweb singleton — what useWebsite() and getUniweb() read. */
function withWebsite(config, fn) {
  const prev = globalThis.uniweb
  globalThis.uniweb = {
    activeWebsite: { basePath: '', config, getRoutingComponents: () => ({}), localize: (v, d = '') => v ?? d },
    routingComponents: {},
  }
  try {
    return fn(globalThis.uniweb.activeWebsite)
  } finally {
    globalThis.uniweb = prev
  }
}

const doc = (...content) => ({ type: 'doc', content })
const uploaded = (extra = {}) => ({
  type: 'image',
  attrs: { src: '/stored/a1b2/base.jpg', assetId: 'a1b2', assetExt: 'jpg', alt: 'Cells', ...extra },
})
const body = doc({ type: 'paragraph', content: [{ type: 'text', text: 'Before.' }] }, uploaded())

describe('a document handed to Render resolves its uploaded pictures', () => {
  test("through the host's pattern, in a record's body rendered by <Article>", () => {
    const out = withWebsite({ assets: { url: PATTERN } }, () => renderToStaticMarkup(<Article content={body} />))
    expect(out).toContain('src="https://assets.example.test/a1b2.jpg"')
    expect(out).not.toContain('/stored/')
  })

  test('as an array of nodes, and through the website of a Block passed beside it', () => {
    withWebsite({ assets: { url: PATTERN } }, (website) => {
      expect(renderToStaticMarkup(<Render content={body.content} />)).toContain(
        'src="https://assets.example.test/a1b2.jpg"',
      )
      // A record's body rendered inside a section, with the section's Block for its insets.
      const block = { website, getInset: () => null }
      expect(renderToStaticMarkup(<Render content={body} block={block} />)).toContain(
        'src="https://assets.example.test/a1b2.jpg"',
      )
    })
  })

  test("a video's poster resolves the same way", () => {
    const video = doc(
      uploaded({
        role: 'video', src: '/stored/v9/base.mp4', assetId: 'v9', assetExt: 'mp4',
        poster: '/stored/p7/base.png', posterAssetId: 'p7', posterAssetExt: 'png',
      }),
    )
    const out = withWebsite({ assets: { url: PATTERN } }, () => renderToStaticMarkup(<Render content={video} />))
    expect(out).toContain('https://assets.example.test/v9.mp4')
    expect(out).toContain('https://assets.example.test/p7.png')
    expect(out).not.toContain('/stored/')
  })

  test('with no pattern declared, the stored address renders, as before', () => {
    const out = withWebsite({}, () => renderToStaticMarkup(<Render content={body} />))
    expect(out).toContain('src="/stored/a1b2/base.jpg"')
  })

  test("the same address a section's own content resolves to — one rule in both lanes", () => {
    withWebsite({ assets: { url: PATTERN } }, (website) => {
      const section = new Block({ type: 'Section', content: body }, 's1', { website })
      const fromBlock = section.parsedContent.sequence.find((e) => e.type === 'image')?.attrs?.url
      expect(fromBlock).toBe('https://assets.example.test/a1b2.jpg')
      expect(renderToStaticMarkup(<Render content={body} />)).toContain(`src="${fromBlock}"`)
    })
  })
})

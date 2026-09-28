/**
 * ChildGrid — a section's child sections in the columns its `grid:` chose.
 *
 * The value is the section's reserved `grid:` key, carried on `block.grid`; the
 * template comes from `@uniweb/schemas/grid`, the same function an editor draws with,
 * so what the editor shows is what renders.
 */

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ChildGrid } from '../src/styled/ChildGrid/index.jsx'

/** The runtime's child renderer, reduced to something a test can read. */
function withChildRenderer(fn) {
  const prev = globalThis.uniweb
  globalThis.uniweb = {
    childBlockRenderer: ({ blocks, wrapAs }) => <span data-child={blocks[0].type} data-wrap={wrapAs || 'bare'} />,
  }
  try {
    return fn()
  } finally {
    globalThis.uniweb = prev
  }
}

const child = (type) => ({ id: type, type })
const section = (grid, types = ['A', 'B', 'C']) => ({ grid, childBlocks: types.map(child) })
const render = (props) => withChildRenderer(() => renderToStaticMarkup(<ChildGrid {...props} />))

describe('ChildGrid', () => {
  it('renders each child as a section, so its own theme and background apply', () => {
    const html = render({ from: section(2, ['A', 'B']) })
    expect(html.match(/data-wrap="div"/g)).toHaveLength(2)
    expect(html).not.toContain('data-wrap="bare"')
  })

  it('lays the children out in the chosen layout', () => {
    const html = render({ from: section('40/60', ['A', 'B']) })
    expect(html).toContain('--uniweb-grid-cols:minmax(0, 40fr) minmax(0, 60fr)')
    expect(html).toContain('data-grid="40/60"')
    expect(html.match(/data-child=/g)).toHaveLength(2)
  })

  it('a count is that many equal columns; wider than two shows two from md', () => {
    const html = render({ from: section(3) })
    expect(html).toContain('--uniweb-grid-cols:repeat(3, minmax(0, 1fr))')
    expect(html).toContain('--uniweb-grid-cols-md:repeat(2, minmax(0, 1fr))')
  })

  it('uses the fallback when the section chose none, or chose something that is not a layout', () => {
    expect(render({ from: section(null), fallback: 2 })).toContain('data-grid="2"')
    expect(render({ from: section('40/'), fallback: 2 })).toContain('data-grid="2"')
  })

  it('with no layout at all, stacks the children in one column', () => {
    const html = render({ from: section(null) })
    expect(html).not.toContain('--uniweb-grid-cols')
    expect(html).toContain('grid-cols-1')
    expect(html.match(/data-child=/g)).toHaveLength(3)
  })

  it('a header row spans every column', () => {
    const html = render({ from: section(2), headerRow: true })
    expect(html.indexOf('md:col-span-full')).toBeLessThan(html.indexOf('data-child="A"'))
    expect(html.match(/md:col-span-full/g)).toHaveLength(1)
  })

  it('a className can replace the default gap', () => {
    const html = render({ from: section(2), className: 'gap-4' })
    expect(html).toContain('gap-4')
    expect(html).not.toContain('gap-8')
  })

  it('renders nothing for a section with no children', () => {
    expect(render({ from: section(2, []) })).toBe('')
  })
})

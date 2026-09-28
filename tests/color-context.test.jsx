/**
 * @vitest-environment jsdom
 *
 * useColorContext — the color context a section renders in. A pinned section's own; a section
 * that follows the site, the site's current scheme [2026-09-28].
 */

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { useColorContext } from '../src/hooks/useThemeData.js'

function Probe({ block }) {
  return <i data-context={useColorContext(block)} />
}
const contextOf = (block) => renderToStaticMarkup(<Probe block={block} />).match(/data-context="(\w+)"/)[1]

afterEach(() => {
  document.documentElement.classList.remove('scheme-dark', 'scheme-light')
})

describe('useColorContext', () => {
  it('a pinned section renders in its own context, whatever the scheme', () => {
    document.documentElement.classList.add('scheme-dark')
    expect(contextOf({ themeName: 'light' })).toBe('light')
    expect(contextOf({ themeName: 'medium' })).toBe('medium')
  })

  it('a section that follows the site renders in the site’s scheme', () => {
    expect(contextOf({ themeName: '' })).toBe('light')
    document.documentElement.classList.add('scheme-dark')
    expect(contextOf({ themeName: '' })).toBe('dark')
  })

  it('a context that is not one of the three follows the site', () => {
    document.documentElement.classList.add('scheme-dark')
    expect(contextOf({ themeName: 'gray' })).toBe('dark')
  })
})

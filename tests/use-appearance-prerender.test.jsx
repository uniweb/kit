/**
 * In the prerender there is no document, so `useAppearance` gives the scheme the runtime applies on a
 * first visit: the site's `default` when it is dark, else light. ⛔ Until 2026-11-11 it was always
 * light, so a dark site with a switch prerendered "Switch to dark mode" and the browser's first
 * render said "Switch to light mode", on every page (`scripts/framework/page-parity.mjs`).
 */
import { afterEach, describe, expect, it } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { useAppearance, useColorContext } from '../src/hooks/useThemeData.js'

const h = React.createElement

function prerender(appearance) {
  globalThis.uniweb = { activeWebsite: { themeData: { appearance } } }
  const Probe = () => {
    const { scheme } = useAppearance()
    const context = useColorContext({ themeName: null })
    return h('p', null, `${scheme}/${context}`)
  }
  return renderToString(h(Probe))
}

afterEach(() => {
  delete globalThis.uniweb
})

describe('useAppearance with no document', () => {
  it('a dark site prerenders dark, switch or none', () => {
    expect(prerender({ default: 'dark', allowToggle: true })).toContain('dark/dark')
    expect(prerender({ default: 'dark', allowToggle: false })).toContain('dark/dark')
  })

  it('a light site, and one that follows the system, prerender light', () => {
    expect(prerender({ default: 'light', allowToggle: true })).toContain('light/light')
    expect(prerender({ default: 'system', allowToggle: true })).toContain('light/light')
  })
})

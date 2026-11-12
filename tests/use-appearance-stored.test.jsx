/**
 * `useAppearance` follows the visitor's system as it changes, unless the visitor chose with the
 * site's switch. ⭐ On a site with no switch a stored value is another site's (the key is the
 * origin's), and the runtime's boot ignores it too (`applyBootScheme`). ⛔ Until 2026-11-11 it
 * stopped the hook from following the system on such a site.
 *
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from 'vitest'
import React from 'react'
import { act, cleanup, render } from '@testing-library/react'
import { useAppearance } from '../src/hooks/useThemeData.js'

const h = React.createElement

/** A system whose scheme the test changes, telling each listener as a browser does. */
function system(prefersDark) {
  const listeners = new Set()
  const query = { matches: prefersDark, addEventListener: (_, f) => listeners.add(f), removeEventListener: (_, f) => listeners.delete(f) }
  window.matchMedia = () => query
  return (dark) => {
    query.matches = dark
    for (const f of listeners) f({ matches: dark })
  }
}

function site(appearance) {
  globalThis.uniweb = { activeWebsite: { themeData: { appearance } } }
  let shown = null
  const Probe = () => {
    shown = useAppearance().scheme
    return null
  }
  render(h(Probe))
  return () => shown
}

afterEach(() => {
  cleanup()
  delete globalThis.uniweb
  localStorage.clear()
  document.documentElement.className = ''
})

describe('useAppearance and a stored choice', () => {
  it('on a site with no switch, follows the system whatever another site stored', () => {
    localStorage.setItem('uniweb-appearance', 'light')
    const turn = system(false)
    const scheme = site({ default: 'system', allowToggle: false, respectSystemPreference: true })
    act(() => turn(true))
    expect(scheme()).toBe('dark')
    expect(document.documentElement.classList.contains('scheme-dark')).toBe(true)
  })

  it('CONTROL — on a site with a switch, the visitor\'s choice holds', () => {
    localStorage.setItem('uniweb-appearance', 'light')
    document.documentElement.classList.add('scheme-light')
    const turn = system(false)
    const scheme = site({ default: 'system', allowToggle: true, respectSystemPreference: true })
    act(() => turn(true))
    expect(scheme()).toBe('light')
  })
})

// ⭐ A site set to dark stays dark when the system turns light, as the runtime's boot keeps it
// (`applyBootScheme`: a system only ever chooses dark over a dark default). ⛔ Until 2026-11-11
// the hook took it to light mid-visit, and the next load brought dark back.
describe('useAppearance and the system turning light', () => {
  for (const [label, appearance] of [
    ['with a switch and no choice made', { default: 'dark', allowToggle: true, respectSystemPreference: true }],
    ['with no switch', { default: 'dark', allowToggle: false, respectSystemPreference: true }]
  ]) {
    it(`a site set to dark stays dark, ${label}`, () => {
      document.documentElement.classList.add('scheme-dark') // as the runtime applied it at boot
      const turn = system(true)
      const scheme = site(appearance)
      act(() => turn(false))
      expect(scheme()).toBe('dark')
      expect(document.documentElement.classList.contains('scheme-dark')).toBe(true)
      expect(document.documentElement.classList.contains('scheme-light')).toBe(false)
    })
  }

  it('CONTROL — a site that follows the system turns light with it', () => {
    document.documentElement.classList.add('scheme-dark')
    const turn = system(true)
    const scheme = site({ default: 'system', allowToggle: false, respectSystemPreference: true })
    act(() => turn(false))
    expect(scheme()).toBe('light')
    expect(document.documentElement.classList.contains('scheme-light')).toBe(true)
  })
})

/**
 * Keyboard shortcut mechanism — parsing, matching, and platform labelling.
 *
 * These are the rules a foundation should never have to re-derive, and each
 * one below exists because hand-rolled listeners get it wrong:
 *
 *   - `mod` accepted as meta OR ctrl on every platform, so a binding cannot
 *     silently fail to fire on somebody's machine;
 *   - the key compared case-insensitively, so CapsLock doesn't break it;
 *   - shift enforced for letters but not punctuation, so `mod+k` doesn't also
 *     fire on `mod+shift+k` while `?` stays bindable at all;
 *   - the label resolved from the platform, which is the bug five shipped
 *     templates carry today: a hardcoded ⌘ shown to a Ctrl user.
 *
 * The hooks are thin wrappers over these functions, so covering the functions
 * covers the behaviour. Kit's test environment is node with no DOM, which is
 * exactly why the rules live in pure functions taking event-LIKE objects.
 */

import { describe, it, expect } from 'vitest'
import {
  parseShortcut,
  matchesShortcut,
  formatShortcut,
} from '../src/hooks/useShortcut.js'

/** Build an event-like object; defaults are "no modifiers held". */
const ev = (key, mods = {}) => ({
  key,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...mods,
})

describe('parseShortcut', () => {
  it('parses a modifier combo', () => {
    expect(parseShortcut('mod+k')).toMatchObject({ mod: true, key: 'k' })
  })

  it('is case- and whitespace-insensitive', () => {
    expect(parseShortcut('  MOD + Shift + P ')).toMatchObject({
      mod: true, shift: true, key: 'p',
    })
  })

  it('accepts platform-flavoured modifier aliases', () => {
    expect(parseShortcut('cmd+k')).toMatchObject({ meta: true, key: 'k' })
    expect(parseShortcut('option+k')).toMatchObject({ alt: true, key: 'k' })
    expect(parseShortcut('control+k')).toMatchObject({ ctrl: true, key: 'k' })
  })

  it('resolves named keys to their event.key spelling', () => {
    expect(parseShortcut('esc').key).toBe('escape')
    expect(parseShortcut('space').key).toBe(' ')
    expect(parseShortcut('down').key).toBe('arrowdown')
  })

  it('handles a literal + as the key', () => {
    expect(parseShortcut('mod++')).toMatchObject({ mod: true, key: '+' })
  })

  it('rejects a binding with no key', () => {
    expect(parseShortcut('mod+shift')).toBeNull()
    expect(parseShortcut('')).toBeNull()
    expect(parseShortcut(null)).toBeNull()
  })
})

describe('matchesShortcut — mod is permissive by design', () => {
  const modK = parseShortcut('mod+k')

  it('fires on Cmd (Apple)', () => {
    expect(matchesShortcut(ev('k', { metaKey: true }), modK)).toBe(true)
  })

  it('fires on Ctrl (Windows / Linux)', () => {
    expect(matchesShortcut(ev('k', { ctrlKey: true }), modK)).toBe(true)
  })

  it('does not fire with no modifier', () => {
    expect(matchesShortcut(ev('k'), modK)).toBe(false)
  })

  it('does not fire on the wrong key', () => {
    expect(matchesShortcut(ev('j', { metaKey: true }), modK)).toBe(false)
  })
})

describe('matchesShortcut — case and CapsLock', () => {
  it('matches an uppercase event key', () => {
    // CapsLock on: event.key is 'K'. A case-sensitive compare would silently
    // stop matching, which is the classic hand-rolled-listener bug.
    expect(matchesShortcut(ev('K', { metaKey: true }), parseShortcut('mod+k'))).toBe(true)
  })
})

describe('matchesShortcut — shift', () => {
  it('does not let mod+shift+k trigger a mod+k binding', () => {
    const event = ev('k', { metaKey: true, shiftKey: true })
    expect(matchesShortcut(event, parseShortcut('mod+k'))).toBe(false)
  })

  it('fires a mod+shift+p binding only when shift is held', () => {
    const binding = parseShortcut('mod+shift+p')
    expect(matchesShortcut(ev('p', { metaKey: true, shiftKey: true }), binding)).toBe(true)
    expect(matchesShortcut(ev('p', { metaKey: true }), binding)).toBe(false)
  })

  it('matches a punctuation key that shift produced', () => {
    // '?' IS shift+'/' — event.key is already the produced character, so
    // demanding shift be up would make '?' unbindable.
    expect(matchesShortcut(ev('?', { shiftKey: true }), parseShortcut('?'))).toBe(true)
  })
})

describe('matchesShortcut — bare and named keys', () => {
  it('matches a bare key with nothing held', () => {
    expect(matchesShortcut(ev('/'), parseShortcut('/'))).toBe(true)
  })

  it('does not match a bare key when a modifier is held', () => {
    // Otherwise a browser/OS combo would trip a site shortcut.
    expect(matchesShortcut(ev('/', { metaKey: true }), parseShortcut('/'))).toBe(false)
  })

  it('matches Escape through its alias', () => {
    expect(matchesShortcut(ev('Escape'), parseShortcut('esc'))).toBe(true)
  })

  it('requires alt when declared, and rejects it when not', () => {
    expect(matchesShortcut(ev('k', { altKey: true }), parseShortcut('alt+k'))).toBe(true)
    expect(matchesShortcut(ev('k', { altKey: true }), parseShortcut('k'))).toBe(false)
  })

  it('tolerates a malformed event or descriptor', () => {
    expect(matchesShortcut(null, parseShortcut('mod+k'))).toBe(false)
    expect(matchesShortcut(ev('k'), null)).toBe(false)
    expect(matchesShortcut({ key: undefined }, parseShortcut('k'))).toBe(false)
  })
})

describe('formatShortcut — the ⌘-on-Windows bug', () => {
  it('renders Apple glyphs with no separator', () => {
    expect(formatShortcut('mod+k', { apple: true })).toBe('⌘K')
    expect(formatShortcut('mod+shift+p', { apple: true })).toBe('⇧⌘P')
  })

  it('renders the Ctrl spelling elsewhere', () => {
    expect(formatShortcut('mod+k', { apple: false })).toBe('Ctrl+K')
    expect(formatShortcut('mod+shift+p', { apple: false })).toBe('Ctrl+Shift+P')
  })

  it('orders Apple modifiers ⌃⌥⇧⌘', () => {
    expect(formatShortcut('ctrl+alt+shift+cmd+k', { apple: true })).toBe('⌃⌥⇧⌘K')
  })

  it('labels named keys per platform', () => {
    expect(formatShortcut('esc', { apple: true })).toBe('esc')
    expect(formatShortcut('esc', { apple: false })).toBe('Esc')
    expect(formatShortcut('mod+enter', { apple: false })).toBe('Ctrl+Enter')
  })

  it('leaves punctuation as authored', () => {
    expect(formatShortcut('/', { apple: true })).toBe('/')
    expect(formatShortcut('?', { apple: false })).toBe('?')
  })

  it('returns empty string for an unparseable binding', () => {
    expect(formatShortcut('mod+shift', { apple: true })).toBe('')
    expect(formatShortcut('', { apple: false })).toBe('')
  })

  it('accepts a pre-parsed descriptor', () => {
    expect(formatShortcut(parseShortcut('mod+k'), { apple: true })).toBe('⌘K')
  })
})

describe('barrel wiring', () => {
  // A name missing from src/hooks/index.js fails only in a consumer's build,
  // which is a long way from here.
  it('re-exports the shortcut API from the hooks barrel', async () => {
    const barrel = await import('../src/hooks/index.js')
    for (const name of [
      'useShortcut', 'useShortcuts', 'useShortcutLabel',
      'parseShortcut', 'matchesShortcut', 'formatShortcut', 'isApplePlatform',
    ]) {
      expect(typeof barrel[name], `${name} missing from hooks barrel`).toBe('function')
    }
  })
})

describe('kit binds no keys of its own', () => {
  it('ships no default binding constant', async () => {
    // The kernel is a mechanism. If a default binding ever appears here, the
    // framework has started deciding what a key MEANS — the thing this module
    // exists not to do.
    const mod = await import('../src/hooks/useShortcut.js')
    const exported = Object.keys(mod)
    expect(exported).not.toContain('DEFAULT_SHORTCUT')
    expect(exported).not.toContain('SEARCH_SHORTCUT')
  })
})

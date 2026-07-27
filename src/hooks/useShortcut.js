/**
 * Keyboard shortcuts — the mechanism, not the meaning.
 *
 * This module owns exactly one thing: making a key binding CORRECT. It has no
 * idea what any key does, ships no default binding, and names no action. A
 * foundation decides that a combo opens its palette or its search or anything
 * else; kit only guarantees that the combo fires when it should, doesn't when
 * it shouldn't, renders right on the user's platform, and is cleaned up.
 *
 * That split is deliberate. Blessing a default (`mod+k` means search) would be
 * the same category error as shipping a default brand colour: a convention some
 * foundations follow, dressed up as a framework fact.
 *
 * The pure functions do the work and the hooks are thin wrappers over them, so
 * every rule below is testable without a DOM.
 *
 * @example
 * function Header() {
 *   const [open, setOpen] = useState(false)
 *   useShortcut('mod+k', () => setOpen(true))
 *   return <button>Open <kbd>{useShortcutLabel('mod+k')}</kbd></button>
 * }
 */

import { useEffect, useMemo, useRef, useState } from 'react'

/** Modifier tokens accepted in a binding string, normalized to canonical form. */
const MODIFIER_ALIASES = {
  mod: 'mod',
  ctrl: 'ctrl',
  control: 'ctrl',
  alt: 'alt',
  option: 'alt',
  opt: 'alt',
  shift: 'shift',
  meta: 'meta',
  cmd: 'meta',
  command: 'meta',
  super: 'meta',
  win: 'meta',
}

/** Key-name aliases → the lowercased `KeyboardEvent.key` they stand for. */
const KEY_ALIASES = {
  esc: 'escape',
  escape: 'escape',
  enter: 'enter',
  return: 'enter',
  space: ' ',
  spacebar: ' ',
  tab: 'tab',
  up: 'arrowup',
  down: 'arrowdown',
  left: 'arrowleft',
  right: 'arrowright',
  arrowup: 'arrowup',
  arrowdown: 'arrowdown',
  arrowleft: 'arrowleft',
  arrowright: 'arrowright',
  del: 'delete',
  delete: 'delete',
  backspace: 'backspace',
  plus: '+',
}

/** How a named key renders, per platform family. */
const KEY_LABELS = {
  escape: { apple: 'esc', other: 'Esc' },
  enter: { apple: '↩', other: 'Enter' },
  ' ': { apple: 'Space', other: 'Space' },
  tab: { apple: '⇥', other: 'Tab' },
  arrowup: { apple: '↑', other: '↑' },
  arrowdown: { apple: '↓', other: '↓' },
  arrowleft: { apple: '←', other: '←' },
  arrowright: { apple: '→', other: '→' },
  backspace: { apple: '⌫', other: 'Backspace' },
  delete: { apple: '⌦', other: 'Del' },
}

/**
 * Parse a binding string into a descriptor.
 *
 * Accepts `mod+k`, `Shift+/`, `escape`, `mod+shift+p`. Case-insensitive; `+`
 * separates parts, and a literal `+` key is written `plus` (or as the final
 * part, e.g. `mod++`).
 *
 * @param {string} binding
 * @returns {{ mod: boolean, ctrl: boolean, alt: boolean, shift: boolean, meta: boolean, key: string, id: string }|null}
 *   null when the binding is unparseable (no key, or modifiers only).
 */
export function parseShortcut(binding) {
  if (typeof binding !== 'string') return null
  const raw = binding.trim()
  if (!raw) return null

  // Split on '+' but keep a trailing literal '+' as the key ("mod++").
  const parts = raw.endsWith('+') && raw.length > 1
    ? [...raw.slice(0, -1).split('+'), '+']
    : raw.split('+')

  const descriptor = { mod: false, ctrl: false, alt: false, shift: false, meta: false, key: '' }

  for (const part of parts) {
    const token = part.trim().toLowerCase()
    if (!token) continue
    const modifier = MODIFIER_ALIASES[token]
    if (modifier) {
      descriptor[modifier] = true
      continue
    }
    // Last non-modifier token wins as the key.
    descriptor.key = KEY_ALIASES[token] || token
  }

  if (!descriptor.key) return null
  descriptor.id = shortcutId(descriptor)
  return descriptor
}

/** Stable identity for a descriptor — the collision-registry key. */
function shortcutId(d) {
  const mods = [
    d.mod && 'mod', d.ctrl && 'ctrl', d.meta && 'meta', d.alt && 'alt', d.shift && 'shift',
  ].filter(Boolean)
  return [...mods, d.key].join('+')
}

/** True for a single alphanumeric character. */
function isAlnumKey(key) {
  return key.length === 1 && /[a-z0-9]/i.test(key)
}

/**
 * Does this keyboard event satisfy the descriptor?
 *
 * Takes an event-LIKE object (`{ key, metaKey, ctrlKey, altKey, shiftKey }`),
 * so the whole matching rule is unit-testable with plain objects.
 *
 * Three rules that are easy to get wrong, and why they are what they are:
 *
 * 1. **`mod` matches meta OR ctrl on every platform** — it is not resolved to
 *    one of them by sniffing the OS. Binding is the side where a wrong guess
 *    costs you a shortcut that silently never fires, so it stays permissive;
 *    the platform question is answered only where it is cosmetic, in
 *    formatShortcut(). Bind permissively, label precisely.
 *
 * 2. **The key compares case-insensitively** against `event.key`. Otherwise
 *    CapsLock yields 'K' and the binding quietly stops working.
 *
 * 3. **Shift is enforced for alphanumeric keys, ignored for punctuation.**
 *    `event.key` is the PRODUCED character, so `?` already implies shift was
 *    held — demanding `shift: false` there would make `'?'` unmatchable, while
 *    demanding it for letters is what keeps `mod+k` from also firing on
 *    `mod+shift+k`.
 *
 * @param {{key?: string, metaKey?: boolean, ctrlKey?: boolean, altKey?: boolean, shiftKey?: boolean}} event
 * @param {object} descriptor - From parseShortcut.
 * @returns {boolean}
 */
export function matchesShortcut(event, descriptor) {
  if (!event || !descriptor || typeof event.key !== 'string') return false

  if (event.key.toLowerCase() !== descriptor.key.toLowerCase()) return false

  const meta = !!event.metaKey
  const ctrl = !!event.ctrlKey

  if (descriptor.mod) {
    if (!meta && !ctrl) return false
  } else {
    if (descriptor.meta !== meta) return false
    if (descriptor.ctrl !== ctrl) return false
  }

  if (descriptor.alt !== !!event.altKey) return false

  // Rule 3 — only alphanumeric keys carry a meaningful "shift must be up".
  if (descriptor.shift) {
    if (!event.shiftKey) return false
  } else if (isAlnumKey(descriptor.key) && event.shiftKey) {
    return false
  }

  return true
}

/**
 * Is this platform in the Apple family (⌘ conventions)?
 *
 * Only ever consulted for DISPLAY — see rule 1 in matchesShortcut.
 * `userAgentData.platform` is the modern signal; `navigator.platform` is
 * deprecated but still the most widely accurate fallback.
 *
 * **A `navigator` check alone is not enough, and the failure is nasty.**
 * Node 21+ defines `globalThis.navigator`, and on macOS its `platform` reads
 * `'MacIntel'` — so during prerender this returned true and baked ⌘ into
 * static HTML based on the machine that ran the BUILD. Every visitor then got
 * the build box's platform, and the same source produced different output on a
 * Mac laptop and a Linux CI runner.
 *
 * `document` is the discriminator: Node defines a navigator but never a DOM.
 * Prerender therefore emits the non-Apple spelling, and the client corrects it
 * on mount — which is safe here because the runtime always createRoots and
 * never hydrates, so there is no mismatch to reconcile.
 *
 * @returns {boolean} false anywhere that is not a real browser.
 */
export function isApplePlatform() {
  if (typeof document === 'undefined' || typeof navigator === 'undefined') return false
  const modern = navigator.userAgentData?.platform
  if (typeof modern === 'string' && modern) return /mac|ios|iphone|ipad/i.test(modern)
  return /mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent || '')
}

/**
 * Render a binding the way the platform writes it.
 *
 * This is the function that fixes the bug foundations keep shipping: a
 * hardcoded `⌘` shown to a Ctrl user. Apple order is ⌃⌥⇧⌘ then the key, with
 * no separator; elsewhere it is `Ctrl+Alt+Shift+Key`.
 *
 * @param {string|object} binding - Binding string, or a parsed descriptor.
 * @param {object} [options]
 * @param {boolean} [options.apple] - Override platform detection (testing, or
 *   a foundation that wants both spellings side by side).
 * @returns {string} '' when the binding is unparseable.
 */
export function formatShortcut(binding, { apple = isApplePlatform() } = {}) {
  const d = typeof binding === 'string' ? parseShortcut(binding) : binding
  if (!d || !d.key) return ''

  const parts = []
  if (apple) {
    if (d.ctrl) parts.push('⌃')
    if (d.alt) parts.push('⌥')
    if (d.shift) parts.push('⇧')
    if (d.mod || d.meta) parts.push('⌘')
  } else {
    // `mod` reads as Ctrl off Apple platforms — the same key the matcher accepts.
    if (d.mod || d.ctrl) parts.push('Ctrl')
    if (d.meta && !d.mod) parts.push('Meta')
    if (d.alt) parts.push('Alt')
    if (d.shift) parts.push('Shift')
  }

  const labelled = KEY_LABELS[d.key]
  const key = labelled
    ? (apple ? labelled.apple : labelled.other)
    : (d.key.length === 1 ? d.key.toUpperCase() : d.key.charAt(0).toUpperCase() + d.key.slice(1))

  parts.push(key)
  return apple ? parts.join('') : parts.join('+')
}

/**
 * Is the event coming from somewhere the user is typing?
 *
 * @param {EventTarget} target
 * @returns {boolean}
 */
function isTypingTarget(target) {
  if (!target || typeof target !== 'object') return false
  if (target.isContentEditable) return true
  const tag = typeof target.tagName === 'string' ? target.tagName.toUpperCase() : ''
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

/**
 * Dev-only duplicate-binding registry.
 *
 * Two window-level listeners on one combo both fire and both preventDefault,
 * and nothing surfaces it: no error, no visible symptom, just two handlers
 * running. Counting mounts per binding turns that silence into one dev warning.
 *
 * Guarded rather than read directly: `import.meta.env` is a Vite construct and
 * is undefined when kit runs under plain Node (SSR, prerender, unipress).
 */
const activeBindings = new Map()

function isDevEnvironment() {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) return !!import.meta.env.DEV
  } catch { /* not a Vite graph */ }
  return typeof process !== 'undefined' && process.env?.NODE_ENV === 'development'
}

function registerBinding(id) {
  if (!isDevEnvironment()) return () => {}
  const next = (activeBindings.get(id) || 0) + 1
  activeBindings.set(id, next)
  if (next > 1) {
    console.warn(
      `[useShortcut] "${id}" is bound ${next} times at once. Every handler will fire and ` +
      `each will preventDefault — bind it in one place, or give one of them a different key.`
    )
  }
  return () => {
    const count = (activeBindings.get(id) || 1) - 1
    if (count > 0) activeBindings.set(id, count)
    else activeBindings.delete(id)
  }
}

/**
 * Bind a keyboard shortcut for as long as the component is mounted.
 *
 * SSR-safe: everything touching `window` runs inside the effect, so this is
 * inert during prerender rather than needing a `typeof document` guard.
 *
 * **`whileTyping` defaults to the right thing instead of a fixed value.** A
 * bare key (`/`, `?`) must not hijack someone's typing; a modifier combo
 * (`mod+k`) is normally still wanted while a field has focus — including when
 * the focused field is the very input the shortcut opens. So the default is
 * derived from the binding: combos fire while typing, bare keys don't. Pass
 * the option to override either way (`escape` usually wants `true`).
 *
 * @param {string} binding - e.g. 'mod+k', 'shift+/', 'escape'.
 * @param {Function} handler - Called with the KeyboardEvent.
 * @param {object} [options]
 * @param {boolean} [options.enabled=true] - Bind only while true.
 * @param {boolean} [options.whileTyping] - Fire while an input/textarea/
 *   contenteditable has focus. Defaults to true for modifier combos, false
 *   for bare keys.
 * @param {boolean} [options.preventDefault=true] - Call preventDefault when it fires.
 * @param {EventTarget} [options.target] - Listen somewhere other than window.
 */
export function useShortcut(binding, handler, options = {}) {
  const { enabled = true, whileTyping, preventDefault = true, target } = options
  const descriptor = useMemo(() => parseShortcut(binding), [binding])

  // The handler is read through a ref, not closed over by the effect.
  // `useShortcut('mod+k', () => setOpen(true))` is the call style this hook
  // exists to support, and an inline arrow has a new identity every render —
  // as an effect dependency it would tear down and re-add the listener on
  // every render, for no behavioural gain. The ref keeps one listener for the
  // life of the binding while still calling the latest closure.
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    if (!enabled || !descriptor) return
    if (typeof window === 'undefined') return

    const node = target || window
    if (!node?.addEventListener) return

    const hasModifier = descriptor.mod || descriptor.ctrl || descriptor.meta || descriptor.alt
    const allowWhileTyping = whileTyping === undefined ? hasModifier : whileTyping

    const onKeyDown = (event) => {
      if (typeof handlerRef.current !== 'function') return
      if (!matchesShortcut(event, descriptor)) return
      if (!allowWhileTyping && isTypingTarget(event.target)) return
      if (preventDefault) event.preventDefault()
      handlerRef.current(event)
    }

    const unregister = registerBinding(descriptor.id)
    node.addEventListener('keydown', onKeyDown)
    return () => {
      node.removeEventListener('keydown', onKeyDown)
      unregister()
    }
  }, [descriptor, enabled, whileTyping, preventDefault, target])
}

/**
 * The platform-correct label for a binding, e.g. '⌘K' or 'Ctrl+K'.
 *
 * Resolved in a lazy initializer rather than an effect: the runtime always
 * `createRoot`s and never hydrates, so a client-side value computed on first
 * render cannot cause a hydration mismatch. Prerendered HTML carries the
 * non-Apple spelling and the client corrects it on mount.
 *
 * @param {string} binding
 * @returns {string}
 */
export function useShortcutLabel(binding) {
  const [apple] = useState(() => isApplePlatform())
  return useMemo(() => formatShortcut(binding, { apple }), [binding, apple])
}

/**
 * Bind several shortcuts from one map: `{ 'mod+k': open, escape: close }`.
 *
 * Sugar over useShortcut for components with a handful of bindings. Options
 * apply to every entry; reach for individual useShortcut calls when they need
 * to differ.
 *
 * @param {Object<string, Function>} bindings
 * @param {object} [options] - As useShortcut.
 */
export function useShortcuts(bindings, options = {}) {
  const { enabled = true, whileTyping, preventDefault = true, target } = options

  // Same ref discipline as useShortcut, and it matters more here: the natural
  // call is an object literal (`useShortcuts({ 'mod+k': open })`), which is a
  // fresh object every render. Keying the effect on the SET of bindings rather
  // than the object's identity is what keeps one listener alive across
  // renders; the handlers themselves are read fresh from the ref.
  const bindingsRef = useRef(bindings)
  bindingsRef.current = bindings

  const keys = Object.keys(bindings || {})
  const bindingKey = keys.join(' ')

  const descriptors = useMemo(
    () => keys.map(b => [b, parseShortcut(b)]).filter(([, d]) => d),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bindingKey]
  )

  useEffect(() => {
    if (!enabled || descriptors.length === 0) return
    if (typeof window === 'undefined') return
    const node = target || window
    if (!node?.addEventListener) return

    const onKeyDown = (event) => {
      for (const [binding, descriptor] of descriptors) {
        if (!matchesShortcut(event, descriptor)) continue
        const handler = bindingsRef.current?.[binding]
        if (typeof handler !== 'function') continue
        const hasModifier = descriptor.mod || descriptor.ctrl || descriptor.meta || descriptor.alt
        const allowWhileTyping = whileTyping === undefined ? hasModifier : whileTyping
        if (!allowWhileTyping && isTypingTarget(event.target)) continue
        if (preventDefault) event.preventDefault()
        handler(event)
        return
      }
    }

    const unregisters = descriptors.map(([, d]) => registerBinding(d.id))
    node.addEventListener('keydown', onKeyDown)
    return () => {
      node.removeEventListener('keydown', onKeyDown)
      unregisters.forEach(fn => fn())
    }
  }, [descriptors, enabled, whileTyping, preventDefault, target])
}

export default useShortcut

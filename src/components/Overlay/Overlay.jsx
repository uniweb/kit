/**
 * Overlay — render above the page, from anywhere in the tree.
 *
 * ## Why this exists (it is not "a portal wrapper")
 *
 * The runtime gives every layout area its own `view-transition-name` so the
 * browser can animate header, sidebars and body independently instead of
 * crossfading the whole page. That is on by default.
 *
 * A `view-transition-name` makes the element **a stacking context** and **a
 * containing block for fixed-position descendants**. Both consequences bite
 * the most ordinary thing a foundation builds: a modal opened from the header.
 *
 *   div[view-transition-name: uw-header]     ← area wrapper, z-index: auto
 *     └ div.fixed.inset-0.z-[100]            ← your modal
 *   div[view-transition-name: uw-body]       ← sibling area, z-index: auto
 *
 * The modal's `z-index: 100` is scoped *inside* `uw-header`. Both wrappers sit
 * at `auto` in the root stacking context, so they paint in DOM order — and the
 * body comes second. No z-index a foundation can write will lift the modal
 * above the page content, because the two are not competing in the same
 * stacking context. Raising the number looks like it should work and never
 * does, which is what makes this worth a component rather than a doc note.
 *
 * Rendering into `document.body` leaves every area wrapper behind, so the
 * overlay competes in the root stacking context where its z-index means what
 * the author expects.
 *
 * ## What it owns
 *
 * The undifferentiated half of every overlay: the portal, the scrim, Escape, a
 * click outside, the page-scroll lock, **focus containment**, and the stacking
 * of one overlay over another. How the thing looks — its box, its placement,
 * its animation — is the foundation's design, the same way kit ships no layout.
 *
 * Focus containment is not optional decoration. `aria-modal="true"` tells
 * assistive technology that everything outside the dialog is unreachable; if
 * focus can Tab out, that is simply false, and a keyboard user lands on
 * controls a screen-reader user has been told do not exist. So a modal overlay
 * traps focus, moves focus in on open, marks the rest of the page `inert`, and
 * restores focus to whatever opened it — by default, without being asked.
 *
 * ## Modal and non-modal
 *
 * `modal` (default `true`) is the master switch, because the cluster it
 * governs only makes sense together: scrim, focus trap, scroll lock, inert
 * background. A dialog, command palette, drawer or lightbox wants all of it.
 *
 * `modal={false}` is the other real case — a toast, a notification, a
 * non-blocking hint. It portals out of the stacking context and does nothing
 * else: no scrim, no trap, no scroll lock, and pointer events pass through the
 * layer so the page underneath stays usable. Individual props still override.
 *
 * @example
 * // Dialog. The scrim colour is the foundation's to choose — this component
 * // renders no colour of its own.
 * // kit-palette-ok: illustrative caller code, and a scrim is the case the
 * // rule names as legitimately non-thematic
 * {isOpen && (
 *   <Overlay onClose={close} className="bg-black/50 items-center">
 *     <div role="dialog" aria-modal="true" aria-labelledby="t">…</div>
 *   </Overlay>
 * )}
 *
 * @example
 * // Toast — above the page, but the page keeps working
 * <Overlay modal={false} className="items-end justify-end p-6">
 *   <div className="pointer-events-auto rounded bg-card p-4">Saved</div>
 * </Overlay>
 */

import { useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../utils/index.js'

/**
 * What counts as focusable. `:not([inert])` matters because this component
 * marks background content inert — without it, a trap could hand focus to an
 * element it has just declared unreachable.
 */
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]:not([contenteditable="false"])',
].map((s) => `${s}:not([inert]):not([aria-hidden="true"])`).join(',')

/**
 * The open modal overlays, outermost first.
 *
 * Nesting is ordinary — a confirm dialog over a settings dialog, a lightbox
 * over a palette — and the pieces that must not fight are Escape (only the
 * top one closes), the scroll lock (the inner one closing must not unlock the
 * page while the outer is still open) and the inert background (likewise).
 * A stack is the smallest thing that gets all three right.
 */
const modalStack = []

function isTopmost(node) {
  return modalStack.length > 0 && modalStack[modalStack.length - 1] === node
}

function focusableWithin(root) {
  if (!root) return []
  return Array.from(root.querySelectorAll(FOCUSABLE)).filter(isVisible)
}

/**
 * Skip elements that are present but not actually reachable.
 *
 * `checkVisibility()` is the browser's own answer and accounts for
 * `display: none`, `content-visibility` and a `hidden` ancestor. Where it does
 * not exist the element is INCLUDED rather than excluded: a trap that wrongly
 * drops a control leaves focus with nowhere to go, which is worse than one
 * that wrongly keeps a hidden control in the cycle.
 *
 * An earlier version tested `offsetParent !== null`, which is a layout
 * property — always `null` under jsdom, and null in a browser for anything
 * inside a `display: none` subtree *or* positioned in ways that have nothing
 * to do with visibility. It emptied the focusable list outright.
 */
function isVisible(el) {
  if (el.hidden) return false
  return typeof el.checkVisibility === 'function' ? el.checkVisibility() : true
}

/** Resolve `initialFocus` — a ref, a selector, or nothing. */
function resolveInitialFocus(initialFocus, root) {
  if (initialFocus === false) return null
  if (initialFocus && typeof initialFocus === 'object' && 'current' in initialFocus) {
    return initialFocus.current || null
  }
  if (typeof initialFocus === 'string') return root?.querySelector(initialFocus) || null
  return focusableWithin(root)[0] || root || null
}

/**
 * Mark everything except this overlay unreachable while a modal is open.
 *
 * This is what makes `aria-modal` true rather than merely asserted: the focus
 * trap stops Tab, and `inert` stops the rest — screen-reader virtual cursors,
 * clicks, find-in-page. Applied to body children rather than a single wrapper
 * because other portals (including a lower overlay) are body children too.
 *
 * Returns an undo function; only the outermost modal applies it, so unwinding
 * an inner overlay never un-inerts the page underneath an outer one.
 */
function inertBackground(exceptNode) {
  const changed = []
  for (const child of Array.from(document.body.children)) {
    // Set the ATTRIBUTE, not the IDL property. Both work in a browser, but the
    // attribute is also observable where the property is not implemented, and
    // it is what an author sees when inspecting the page.
    if (child === exceptNode || child.hasAttribute('inert')) continue
    child.setAttribute('inert', '')
    changed.push(child)
  }
  return () => changed.forEach((el) => el.removeAttribute('inert'))
}

/**
 * @param {object} props
 * @param {React.ReactNode} props.children - The overlay content.
 * @param {Function} [props.onClose] - Called on Escape and on a scrim click.
 *   Omit for an overlay that dismisses some other way.
 * @param {boolean} [props.modal=true] - Blocks the page: scrim, focus trap,
 *   scroll lock, inert background. `false` for a toast or other non-blocking
 *   layer that only needs to escape the stacking context.
 * @param {string} [props.className] - Classes for the scrim / positioning
 *   layer. It is a flex container, so `items-center`, `items-end` and friends
 *   place the content; the box itself is yours.
 * @param {number|string} [props.zIndex=100]
 * @param {boolean} [props.closeOnEscape=true]
 * @param {boolean} [props.closeOnScrimClick=true]
 * @param {boolean} [props.lockScroll] - Defaults to `modal`.
 * @param {boolean} [props.trapFocus] - Defaults to `modal`. Turning it off on
 *   a modal overlay makes `aria-modal` a false claim; prefer `modal={false}`.
 * @param {React.RefObject|string|false} [props.initialFocus] - What to focus
 *   on open: a ref, a selector, or `false` to leave focus alone. Defaults to
 *   the first focusable element, falling back to the layer itself.
 * @param {boolean} [props.returnFocus=true] - Restore focus to whatever was
 *   focused before opening — usually the control that opened it.
 */
export function Overlay({
  children,
  onClose,
  modal = true,
  className,
  zIndex = 100,
  closeOnEscape = true,
  closeOnScrimClick = true,
  lockScroll,
  trapFocus,
  initialFocus,
  returnFocus = true,
  ...rest
}) {
  const layerRef = useRef(null)
  const shouldLockScroll = lockScroll ?? modal
  const shouldTrapFocus = trapFocus ?? modal

  // Read through a ref so an inline `onClose={() => setOpen(false)}` — the
  // natural call — does not tear the listener down and re-add it every render.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // ── Stack membership ──────────────────────────────────────────────
  useEffect(() => {
    if (!modal) return
    const node = layerRef.current
    modalStack.push(node)
    return () => {
      const i = modalStack.indexOf(node)
      if (i !== -1) modalStack.splice(i, 1)
    }
  }, [modal])

  // ── Escape ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!closeOnEscape) return
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return
      // Only the topmost overlay closes: Escape inside a confirm dialog must
      // not also dismiss the dialog behind it.
      if (modal && !isTopmost(layerRef.current)) return
      if (typeof onCloseRef.current !== 'function') return
      event.preventDefault()
      onCloseRef.current(event)
    }
    // Capture phase: an input inside the overlay may stop propagation on
    // keydown, and Escape still has to close the thing it is typed into.
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [closeOnEscape, modal])

  // ── Scroll lock ───────────────────────────────────────────────────
  useEffect(() => {
    if (!shouldLockScroll) return
    // Restore the previous value rather than clearing, so an inner overlay
    // closing does not unlock the page while an outer one is still open.
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [shouldLockScroll])

  // ── Focus: move in, contain, restore ──────────────────────────────
  useEffect(() => {
    if (!shouldTrapFocus) return
    const layer = layerRef.current
    if (!layer) return

    const previouslyFocused = document.activeElement
    const undoInert = modalStack.length <= 1 ? inertBackground(layer) : null

    const target = resolveInitialFocus(initialFocus, layer)
    target?.focus?.({ preventScroll: true })

    const onKeyDown = (event) => {
      if (event.key !== 'Tab') return
      if (!isTopmost(layer)) return

      const items = focusableWithin(layer)
      if (items.length === 0) {
        // Nothing to move to, but focus must not leave either.
        event.preventDefault()
        layer.focus?.({ preventScroll: true })
        return
      }

      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement

      // Wrap at both ends, and pull focus back if it has escaped the overlay
      // entirely (a click on the page behind, a programmatic focus call).
      if (event.shiftKey && (active === first || !layer.contains(active))) {
        event.preventDefault()
        last.focus({ preventScroll: true })
      } else if (!event.shiftKey && (active === last || !layer.contains(active))) {
        event.preventDefault()
        first.focus({ preventScroll: true })
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      undoInert?.()
      // Back to whatever opened it — usually the trigger, which is where a
      // keyboard user expects to be when the dialog goes away.
      if (returnFocus && previouslyFocused?.focus) {
        previouslyFocused.focus({ preventScroll: true })
      }
    }
    // `initialFocus` is read once on open by design: re-running this would
    // yank focus out from under the user mid-interaction.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldTrapFocus, returnFocus])

  // No DOM: prerender, and any Node render. An overlay is interactive by
  // definition, so there is nothing meaningful to emit into static HTML — and
  // emitting it would put a scrim over the prerendered page.
  if (typeof document === 'undefined') return null

  const handleScrimClick =
    modal && closeOnScrimClick && onClose
      ? (event) => {
          // Only a click on the scrim itself. One that bubbled out of the
          // content would close on every stray click inside, and would fire
          // when a text selection happens to end outside the box.
          if (event.target === event.currentTarget) onClose(event)
        }
      : undefined

  return createPortal(
    <div
      ref={layerRef}
      tabIndex={-1}
      className={cn(
        'fixed inset-0 flex justify-center',
        // A non-modal layer must not swallow clicks meant for the page; its
        // content opts back in with `pointer-events-auto`.
        modal ? 'items-start' : 'items-start pointer-events-none',
        className
      )}
      style={{ zIndex }}
      onClick={handleScrimClick}
      {...rest}
    >
      {children}
    </div>,
    document.body
  )
}

export default Overlay

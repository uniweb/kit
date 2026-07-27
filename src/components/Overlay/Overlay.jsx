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
 * ## Usage
 *
 *   {isOpen && (
 *     <Overlay onClose={close}>
 *       <div role="dialog" aria-modal="true">…</div>
 *     </Overlay>
 *   )}
 *
 * Owns only what every overlay needs and nothing about how it looks: the
 * portal, the scrim, Escape, a click outside, and the page-scroll lock. The
 * dialog itself — its shape, its focus handling, its content — is the
 * foundation's design, the same way kit ships no layout.
 */

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../utils/index.js'

/**
 * @param {object} props
 * @param {React.ReactNode} props.children - The overlay content (your dialog).
 * @param {Function} [props.onClose] - Called on Escape and on a scrim click.
 *   Omit for a non-dismissible overlay.
 * @param {boolean} [props.lockScroll=true] - Prevent the page behind from
 *   scrolling while open.
 * @param {boolean} [props.closeOnEscape=true]
 * @param {boolean} [props.closeOnScrimClick=true]
 * @param {string} [props.className] - Classes for the scrim/positioning layer.
 *   Defaults place the content centred near the top, the usual command-palette
 *   position; pass your own to change it.
 * @param {number|string} [props.zIndex=100]
 */
export function Overlay({
  children,
  onClose,
  lockScroll = true,
  closeOnEscape = true,
  closeOnScrimClick = true,
  className,
  zIndex = 100,
  ...rest
}) {
  useEffect(() => {
    if (!closeOnEscape || !onClose) return
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose(event)
      }
    }
    // Capture phase: a dialog's own input may stop propagation on keydown,
    // and Escape still has to close the thing it is typed into.
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [closeOnEscape, onClose])

  useEffect(() => {
    if (!lockScroll) return
    // Restore the previous value rather than clearing: two stacked overlays
    // would otherwise have the inner one unlock the page on close.
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [lockScroll])

  // No DOM: prerender and any Node render. An overlay is by definition
  // interactive, so there is nothing meaningful to emit into static HTML —
  // and emitting it would put a scrim over the prerendered page.
  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className={cn('fixed inset-0 flex items-start justify-center', className)}
      style={{ zIndex }}
      onClick={closeOnScrimClick && onClose ? (e) => {
        // Only a click on the scrim itself, never one that bubbled out of the
        // dialog — otherwise selecting text and releasing outside closes it.
        if (e.target === e.currentTarget) onClose(e)
      } : undefined}
      {...rest}
    >
      {children}
    </div>,
    document.body
  )
}

export default Overlay

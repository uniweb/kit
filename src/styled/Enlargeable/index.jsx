/**
 * Enlargeable — a picture a reader can open larger, on demand.
 *
 * A column shows a wide picture much smaller than it was made: a 1550px diagram at 44% of its
 * size on a desktop and 22% on a phone, where its labels come to about 3.5px. This puts the same
 * picture over the page, at a size that can be read, when the reader asks.
 *
 * Optional, and a foundation's choice. `<Mermaid>` uses it on its own. An image in a page's body
 * takes `EnlargeableImage` through `components`, beside whatever else a foundation draws its own way:
 *
 *   <Render block={block} components={{ image: EnlargeableImage }} />
 *
 * ⭐ **It is offered only when it helps.** After the picture has loaded, and only when opening it
 * would show it noticeably larger (`size.js`). An icon, a photo that is already at its size, or a
 * picture inside a link gets nothing, and neither does a picture a reader can't get any more of.
 *
 * ⭐ **The prerendered page doesn't change.** The button comes after the browser has measured, so
 * a crawler, a reader with no script and the first paint all see the picture and nothing else.
 *
 * ⛔ **What opens is always an `<img>`, never the file as a page.** A diagram's SVG comes from a
 * sandboxed frame because its source is content, and an image runs no script (`Mermaid/sandbox.js`).
 * The same bytes opened as a document, in a new tab or from a `blob:` address, would run whatever is
 * in them as this site. That rules out the simplest version of this feature.
 *
 * Overlay owns Escape, a click on the scrim, the scroll lock and focus. Its portal leaves the
 * section behind, and with it the tokens the picture was drawn for, so the ground comes along.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { getUniweb } from '@uniweb/core'
import { Overlay } from '../../components/Overlay/index.js'
import { enlargedWidth } from './size.js'

/** The room left around the picture, and Overlay's `p-4`. */
const GUTTER = 16

const LABELS = {
  enlarge: { en: 'Enlarge', fr: 'Agrandir' },
  enlarged: { en: 'Enlarged picture', fr: 'Image agrandie' },
  close: { en: 'Close', fr: 'Fermer' },
}

function windowRoom() {
  return {
    availableWidth: document.documentElement.clientWidth - 2 * GUTTER,
    availableHeight: window.innerHeight - 2 * GUTTER,
  }
}

/**
 * @param {Object} props
 * @param {React.ReactNode} props.children - the picture: anything that draws one `<img>`
 * @param {number} [props.minScale] - the smallest it opens at, against its own size, for a picture
 *   with words in it. Past that the reader scrolls. Without it, a picture fits the window
 * @param {boolean} [props.disabled] - draw the picture and offer nothing
 * @param {{enlarge?: string, enlarged?: string, close?: string}} [props.labels] - what the button, the
 *   open picture and its close button are called, for a language kit doesn't say them in
 * @param {string} [props.className]
 * @param {Object} [props.style]
 */
export function Enlargeable({ children, minScale, disabled, labels, className, style, ...props }) {
  const box = useRef(null)
  const [offer, setOffer] = useState(null)
  const [opened, setOpened] = useState(null)

  const say = (name) => labels?.[name] || getUniweb()?.activeWebsite?.localize?.(LABELS[name], LABELS[name].en) || LABELS[name].en

  const measure = useCallback(() => {
    const img = box.current?.querySelector('img')
    if (disabled || !img || img.closest('a') || img.getAttribute('aria-hidden') === 'true') {
      setOffer(null)
      return
    }
    const shown = img.getBoundingClientRect()
    const width = enlargedWidth({
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      shownWidth: shown.width,
      minScale,
      ...windowRoom(),
    })
    if (!width) {
      setOffer(null)
      return
    }
    // A picture narrower than its box, set by a `width`, keeps the button on its own corner.
    const outer = box.current.getBoundingClientRect()
    const top = Math.round(shown.top - outer.top)
    const right = Math.round(outer.right - shown.right)
    setOffer((was) => (was?.width === width && was.top === top && was.right === right ? was : { width, top, right }))
  }, [disabled, minScale])

  useEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    const watcher = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    if (box.current) watcher?.observe(box.current)
    return () => {
      window.removeEventListener('resize', measure)
      watcher?.disconnect()
    }
  }, [measure])

  const open = () => {
    const img = box.current?.querySelector('img')
    if (!img) return
    setOpened({
      src: img.currentSrc || img.src,
      alt: img.alt,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      ground: getComputedStyle(box.current).getPropertyValue('--section').trim() || 'Canvas',
    })
  }
  const close = () => setOpened(null)

  const openWidth = opened ? offer?.width ?? opened.naturalWidth : 0
  const room = opened ? windowRoom() : null
  const fits = opened
    && openWidth <= room.availableWidth
    && (openWidth * opened.naturalHeight) / opened.naturalWidth <= room.availableHeight

  return (
    <>
      <div
        ref={box}
        data-enlargeable=""
        className={className}
        style={{ position: 'relative', cursor: offer ? 'zoom-in' : undefined, ...style }}
        // The picture stays the bigger target for a pointer; the button is what a keyboard, a
        // screen reader and a phone with no hover get.
        onClick={(event) => {
          if (offer && event.target.tagName === 'IMG') open()
        }}
        // `load` doesn't bubble: a lazy picture, or a diagram redrawn, measures when it arrives.
        onLoadCapture={measure}
        {...props}
      >
        {children}
        {offer && (
          <button
            type="button"
            onClick={open}
            aria-label={say('enlarge')}
            title={say('enlarge')}
            className="absolute flex size-7 cursor-pointer items-center justify-center rounded-md border border-border bg-section text-body opacity-80 transition-opacity hover:opacity-100 focus-visible:opacity-100 print:hidden"
            style={{ top: offer.top + 8, right: offer.right + 8 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
            </svg>
          </button>
        )}
      </div>
      {/* Beside the box and not in it: a portal's clicks bubble through the React tree. */}
      {opened && (
        <Overlay data-enlarged="" onClose={close} className="items-center p-4" role="dialog" aria-modal="true" aria-label={say('enlarged')}>
          {/* Focusable, and first, so the arrow keys pan a picture too big for the window. */}
          <div
            tabIndex={0}
            className="max-h-full max-w-full min-w-0 overflow-auto overscroll-contain rounded-lg focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ background: opened.ground }}
          >
            <img
              src={opened.src}
              alt={opened.alt}
              onClick={fits ? close : undefined}
              style={{ display: 'block', width: openWidth, height: 'auto', maxWidth: 'none', cursor: fits ? 'zoom-out' : undefined }}
            />
          </div>
          <button
            type="button"
            onClick={close}
            aria-label={say('close')}
            title={say('close')}
            className="absolute top-3 right-3 flex size-9 cursor-pointer items-center justify-center rounded-full border border-border bg-section text-body"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </Overlay>
      )}
    </>
  )
}

export default Enlargeable

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
 * ⭐ **It says nothing of its own.** The button and the open picture are named by what the author
 * wrote, in the page's language: the picture's alt text, or the heading above it when that alt is a
 * diagram's source (`nameOf`). `aria-haspopup` tells a screen reader what the button does, in its
 * reader's language. The close button is a `×`. With no alt and no heading there is nothing to name
 * the button by, so it stays a target for a pointer and out of the way of everything else.
 *
 * Overlay owns Escape, a click on the scrim, the scroll lock and focus. Its portal leaves the
 * section behind, and with it the tokens the picture was drawn for, so the ground comes along.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Overlay } from '../../components/Overlay/index.js'
import { enlargedWidth } from './size.js'

/** The room left around the picture, and Overlay's `p-4`. */
const GUTTER = 16

/** An alt longer than this, or on several lines, is a diagram's source and not a name. */
const LONGEST_NAME = 150

/**
 * What to call a picture, from what its author wrote.
 *
 * @param {HTMLImageElement} img
 * @returns {string} its alt, or the heading above it when the alt won't do, or nothing
 */
function nameOf(img) {
  const alt = img.alt.trim()
  if (alt && alt.length <= LONGEST_NAME && !alt.includes('\n')) return alt
  let above = null
  for (const heading of document.querySelectorAll('h1, h2, h3, h4, h5, h6')) {
    if (!(heading.compareDocumentPosition(img) & Node.DOCUMENT_POSITION_FOLLOWING)) break
    above = heading
  }
  return above?.textContent.trim() || alt
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
 * @param {string} [props.className]
 * @param {Object} [props.style]
 */
export function Enlargeable({ children, minScale, disabled, className, style, ...props }) {
  const box = useRef(null)
  const [offer, setOffer] = useState(null)
  const [opened, setOpened] = useState(null)

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
    const name = nameOf(img)
    setOffer((was) => (was?.width === width && was.top === top && was.right === right && was.name === name ? was : { width, top, right, name }))
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
      name: nameOf(img),
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      // kit-words-ok: a CSS system colour
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
            aria-haspopup="dialog"
            {...(offer.name ? { 'aria-label': offer.name } : { 'aria-hidden': true, tabIndex: -1 })}
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
        <Overlay data-enlarged="" onClose={close} className="items-center p-4" role="dialog" aria-modal="true" aria-label={opened.name || undefined}>
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
            aria-keyshortcuts="Escape"
            className="absolute top-3 right-3 flex size-9 cursor-pointer items-center justify-center rounded-full border border-border bg-section text-xl leading-none text-body"
          >
            ×
          </button>
        </Overlay>
      )}
    </>
  )
}

export default Enlargeable

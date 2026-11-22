/**
 * LabeledImage — a picture with its words drawn over it as text, so it reads in the page's language.
 *
 * A diagram, a screenshot or a map often holds words, and a version of it per language is a lot to
 * keep. Drawn over it as text instead, the words are content: a section gives them in a data block
 * its type declares as one record, `data: { overlay: { schema: '@std/overlay', single: true } }`, `uniweb i18n` translates each label's
 * `text` like the page's other words, and a page in another language shows them in its own.
 *
 *     ```yaml:overlay
 *     baked: [en]
 *     sizes: { title: 4.3, label: 1 }
 *     labels:
 *       - { text: "YOU", x: 20.9, y: 14.65, w: 8.8, h: 7.3, role: title }
 *       - { text: "NAT Gateway", x: 87.5, y: 24.5, w: 8.6, h: 5 }
 *     ```
 *
 *     <LabeledImage overlay={content.data.overlay} width={image.width} height={image.height}>
 *       <Image value={image} />
 *     </LabeledImage>
 *
 * Where a label sits is data beside its words: `x` and `y` are the center of its box, in percent of
 * the picture's width and height, and `w` and `h` its size, so it keeps its place at any width. The
 * picture is a size container, and a size is a percent of its width (`cqw`), so the words keep their
 * proportion to the picture too. All of it is in the prerendered page, with no script.
 *
 * ⭐ What a label is comes from a short list (`@std/overlay`), and each implies how it is laid out:
 * a `title`, a `label` (the default) and a `note` hold one line, and a longer translation grows the
 * box; `text` is words in a frame, which wrap within `w`, centered in it as the picture's own were,
 * and a longer translation grows it downward, since it keeps its top. `align` names the
 * side a label keeps while it grows, `center` unless given (`left` for `text`), a side of the
 * picture, which doesn't mirror in a language written right to left.
 *
 * ⭐ `baked` lists the languages whose picture shows its words itself. On a page in one of them the
 * labels are left out and the picture's own words show. On a page in any other language each label
 * covers the picture's words, on a ground (`--label-ground`) that is a color, or a field for the whole
 * picture: a gradient laid at the picture's size, of which each label shows the part under it. A
 * picture made without words has no `baked`, and its labels show in every language, with no ground.
 *
 * It brings no looks of its own and no words. A label is placed, and a foundation styles it by its
 * role (`labeled-image__label--<role>`): its font and weight, its colors (`--label-ink`,
 * `--label-ground`), and its size when the overlay gives none. The labels are hidden from assistive
 * technology, since the picture's alt text says what it shows, in the page's language.
 *
 * It opens larger with its words (`Enlargeable`'s `whole`), offered only when that shows it larger.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { getUniweb } from '@uniweb/core'
import { cn } from '../../utils/index.js'
import { Enlargeable } from '../Enlargeable/index.jsx'

/** The roles of `@std/overlay`; a role it doesn't know is laid out as a `label`. */
const ROLES = new Set(['title', 'label', 'text', 'note'])

/** The sides a label keeps. */
const ALIGNS = new Set(['left', 'center', 'right'])

const number = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null)

/**
 * A label's box, as inline style: placed by its point and the side it keeps, sized by the overlay,
 * and, when it covers the picture's words, with the part of the ground under it.
 *
 * @param {Object} label - one of the overlay's labels
 * @param {Object} sizes - the overlay's size for each role
 * @param {boolean} covers - whether it hides the picture's own words
 */
export function labelStyle(label, sizes, covers) {
  const role = ROLES.has(label.role) ? label.role : 'label'
  const frame = role === 'text' && number(label.w) != null
  const align = ALIGNS.has(label.align) ? label.align : frame ? 'left' : 'center'
  const x = number(label.x) ?? 50
  const y = number(label.y) ?? 50
  const w = number(label.w)
  const h = number(label.h)
  const size = number(label.size) ?? number(sizes?.[role])

  // Across: a centered label on its point; a left one keeps its box's left side, a right one its
  // right side. A frame stays where its box is, and its lines align.
  const left = frame || (align === 'left' && w != null) ? x - w / 2 : align === 'right' && w != null ? x + w / 2 : x
  const shiftX = frame || align === 'left' ? '0' : align === 'right' ? '-100%' : '-50%'
  // Down: on its point, or a frame with a height keeps its top.
  const top = frame && h != null ? y - h / 2 : y
  const shiftY = frame && h != null ? '0' : '-50%'

  const style = {
    position: 'absolute',
    left: `${left}%`,
    top: `${top}%`,
    transform: `translate(${shiftX}, ${shiftY})`,
    boxSizing: 'border-box',
    color: 'var(--label-ink, inherit)',
    textAlign: align,
    ...(size != null && { fontSize: `${size}cqw` }),
    ...(frame
      ? {
          width: `${w}%`,
          whiteSpace: 'pre-line',
          // Its words centered in it, where the picture's own were, until they need more room.
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          ...(h != null && { minHeight: `${h}%` }),
        }
      : {
          width: 'max-content',
          whiteSpace: 'pre',
          display: 'flex',
          alignItems: 'center',
          justifyContent: align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center',
          ...(w != null && { minWidth: `${w}%` }),
          ...(h != null && { minHeight: `${h}%` }),
        }),
  }

  if (covers) {
    // The ground is laid at the picture's size, and placed so the point under the label's own
    // anchor shows there: its center, its left or right side, or a frame's top. 1cqw is 1% of the
    // picture's width; 1% of its height is `--label-ratio` of that.
    // `left` is the anchor across: the box's left side, its right side, or its point.
    const across =
      frame || align === 'left'
        ? `calc(${-left} * 1cqw)`
        : align === 'right'
          ? `right calc(${left - 100} * 1cqw)`
          : `calc(50% + ${50 - x} * 1cqw)`
    const down = frame && h != null ? `calc(${-top} * var(--label-ratio, 1) * 1cqw)` : `calc(50% + ${50 - y} * var(--label-ratio, 1) * 1cqw)`
    Object.assign(style, {
      background: 'var(--label-ground, transparent)',
      backgroundSize: '100cqw calc(100cqw * var(--label-ratio, 1))',
      backgroundPositionX: across,
      backgroundPositionY: down,
    })
  }
  return style
}

/** The picture and its labels, measured on its own: drawn on the page, and again when opened. */
function Drawn({ width, height, labels, sizes, covers, className, children }) {
  const box = useRef(null)
  const given = width && height ? height / width : null
  const [measured, setMeasured] = useState(null)
  // Its proportions, which place a ground field: given, or read from the version shown once loaded.
  const read = useCallback(() => {
    if (given) return
    const shown = [...(box.current?.querySelectorAll('img') ?? [])].find(
      (img) => img.naturalWidth > 0 && img.getClientRects().length > 0,
    )
    if (shown) setMeasured(shown.naturalHeight / shown.naturalWidth)
  }, [given])
  useEffect(read, [read])
  const ratio = given ?? measured

  return (
    <div
      ref={box}
      // `load` doesn't bubble: a picture that loads after the page has its proportions read then.
      onLoadCapture={read}
      className={cn('labeled-image', covers && labels.length > 0 && 'labeled-image--covers', className)}
      style={{
        position: 'relative',
        containerType: 'inline-size',
        ...(ratio && { aspectRatio: given ? `${width} / ${height}` : `1 / ${ratio}`, '--label-ratio': ratio }),
      }}
    >
      {children}
      {labels.length > 0 && (
        <div className="labeled-image__labels" aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {labels.map((label, index) => (
            <span
              key={index}
              className={cn('labeled-image__label', `labeled-image__label--${ROLES.has(label.role) ? label.role : 'label'}`)}
              style={labelStyle(label, sizes, covers)}
            >
              {label.text}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * @param {Object} props
 * @param {Object} [props.overlay] - the section's `@std/overlay` block: `labels`, `sizes`, `baked`
 * @param {number} [props.width] - the picture's width, for its proportions; without it and
 *   `height`, the proportions of the version shown, once it has loaded
 * @param {number} [props.height] - its height
 * @param {boolean} [props.enlarge=true] - offer to open it larger, with its words, when the page
 *   shows it smaller than it was made
 * @param {number} [props.minScale] - the smallest it opens at, against its own size; past that the
 *   reader scrolls (`Enlargeable`)
 * @param {string} [props.className]
 * @param {React.ReactNode} props.children - the picture, or its versions for each color scheme
 */
export function LabeledImage({ overlay, width, height, enlarge = true, minScale, className, children }) {
  const website = getUniweb()?.activeWebsite
  const locale = website?.getActiveLocale?.() ?? website?.activeLocale
  const all = (Array.isArray(overlay?.labels) ? overlay.labels : []).filter((label) => label?.text)
  const baked = Array.isArray(overlay?.baked) ? overlay.baked : []
  const covers = baked.length > 0
  // A page in a language its picture shows on its own shows the picture as drawn.
  const labels = covers && baked.includes(locale) ? [] : all

  const drawn = (
    <Drawn width={width} height={height} labels={labels} sizes={overlay?.sizes} covers={covers} className={className}>
      {children}
    </Drawn>
  )
  if (!enlarge) return drawn
  return (
    <Enlargeable whole minScale={minScale}>
      {drawn}
    </Enlargeable>
  )
}

export default LabeledImage

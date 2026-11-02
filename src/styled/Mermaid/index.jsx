/**
 * Mermaid — a diagram drawn from its source text.
 *
 * Optional, and a foundation's choice: nothing in kit draws one on its own, so a
 * site whose content shows Mermaid as code keeps showing it. A foundation turns it
 * on where it wants it, for a fence in the flow through `components`:
 *
 *   function CodeBlock({ element: { text, attrs } }) {
 *     return attrs?.language === 'mermaid'
 *       ? <Mermaid source={text} />
 *       : <Code content={text} language={attrs?.language} />
 *   }
 *   <Prose content={content} block={block} components={{ codeBlock: CodeBlock }} />
 *
 * ## What a reader meets
 *
 * Mermaid draws by measuring text in a browser, so neither a static build nor a
 * host's prerender can run it. The prerendered page and the browser's first render
 * therefore hold the source, as a code block, and the two agree; that is also what
 * a reader without JavaScript and a crawler read, and it is readable. When the
 * block comes within 400px of the view the engine loads, once for the page, and
 * the picture replaces the code when it is ready. The page does move at that
 * moment, by the difference in height (a layout shift of 0.04 for a diagram near
 * the top of a `docs` page, measured), mostly out of sight, since the margin lets
 * a block further down be drawn before it is reached.
 *
 * A diagram the engine can't draw stays code, with a note in the console, which
 * also covers a syntax error mid-edit and a CDN that can't be reached.
 *
 * ## Colours
 *
 * Read from the section's tokens where the diagram sits, so it follows `theme.yml`,
 * the section's context and the visitor's scheme, and is drawn again when the
 * scheme changes. An image can't inherit CSS variables, and Mermaid's theme reads
 * only hex, which is why they are resolved here. A diagram's own `%%{init}%%` still
 * wins, as an author asking for it would expect.
 *
 * The labels use the system's font: a picture can't reach a site's web fonts, and
 * the engine must measure the font that will show. See `./sandbox.js` for why the
 * picture is a picture at all.
 *
 * @module @uniweb/kit/styled/Mermaid
 */

import React, { useEffect, useState } from 'react'
import { useInView } from '../../hooks/useInView.js'
import { Code } from '../Section/renderers/Code.jsx'
import { drawDiagram } from './sandbox.js'

let probe = null

/**
 * A CSS colour as hex, flattened over `ground` — any colour a token may hold,
 * `oklch()` and `color-mix()` included. A canvas answers in sRGB bytes, and a value
 * it can't read leaves the fill it started with, which is how that is noticed.
 *
 * @param {string} value
 * @param {string} ground - hex, what a translucent value sits on
 * @param {string} [fallback] - hex, for a value that isn't a colour
 * @returns {string}
 */
function toHex(value, ground, fallback = ground) {
  if (!value) return fallback
  probe ||= document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  const reads = (start) => {
    probe.fillStyle = start
    probe.fillStyle = value
    return probe.fillStyle !== start
  }
  // Two starts, since a value can be the colour either one started with.
  if (!reads('#000000') && !reads('#ffffff')) return fallback
  const fill = probe.fillStyle
  probe.fillStyle = ground
  probe.fillRect(0, 0, 1, 1)
  probe.fillStyle = fill
  probe.fillRect(0, 0, 1, 1)
  const [r, g, b] = probe.getImageData(0, 0, 1, 1).data
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`
}

/** Is this hex colour closer to black? Mermaid derives its shades by whether the ground is dark. */
function isDark(hex) {
  const n = parseInt(hex.slice(1), 16)
  return 0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255) < 128
}

/**
 * Mermaid's `themeVariables`, from the tokens where the diagram sits. Only the ones
 * its `base` theme derives the rest from, plus the few it derives badly on a
 * neutral ground. No colour of kit's own: a page with no tokens takes its text colour
 * and a white ground.
 *
 * @param {Element} element
 * @returns {Object}
 */
export function themeAt(element) {
  const css = getComputedStyle(element)
  const token = (name) => css.getPropertyValue(name).trim()

  const section = toHex(token('--section') || css.backgroundColor, '#ffffff')
  const body = toHex(token('--body') || css.color, section, '#000000')
  const heading = toHex(token('--heading'), section, body)
  const subtle = toHex(token('--subtle'), section, body)
  const border = toHex(token('--border'), section, subtle)
  const card = toHex(token('--card'), section, section)
  const darkMode = isDark(section)

  const theme = {
    darkMode,
    background: section,
    // Nodes are cards on the section, and the base theme derives its other shapes from them.
    primaryColor: card,
    primaryTextColor: body,
    primaryBorderColor: border,
    // Subgraphs and labels stay on the section.
    secondaryColor: section,
    secondaryBorderColor: border,
    secondaryTextColor: body,
    tertiaryColor: section,
    tertiaryBorderColor: border,
    tertiaryTextColor: body,
    lineColor: subtle,
    textColor: body,
    titleColor: heading,
    edgeLabelBackground: section,
    noteBkgColor: card,
    noteTextColor: body,
    noteBorderColor: border,
  }

  // A chart's slices have to differ, which no shape above does, and carry the section's text:
  // the site's palette, in the steps that text reads on, neighbours apart.
  const steps = darkMode ? [800, 600, 700, 500, 900] : [200, 400, 300, 500, 100]
  const slices = ['primary', 'secondary'].flatMap((family) => steps.map((step) => token(`--${family}-${step}`)))
  slices.forEach((value, i) => {
    if (value) theme[`pie${i + 1}`] = toHex(value, section)
  })

  return theme
}

/** What each source last looked like, so coming back to a page doesn't redraw its code first. */
const lastPicture = new Map()

/**
 * Mermaid — one diagram, from its source.
 *
 * @param {Object} props
 * @param {string} props.source - the diagram's text
 * @param {string} [props.alt] - what the picture says, for someone who can't see it.
 *   Otherwise the diagram's own `accTitle` and `accDescr`, else its source
 * @param {string} [props.className] - classes on the `<figure>`
 *
 * @example
 * // A fence in a named slot: ```mermaid:flow, declared as `flow` in meta.js
 * <Mermaid source={content.data.flow} />
 */
export function Mermaid({ source = '', alt, className, ...props }) {
  const { ref, inView, entry } = useInView({ rootMargin: '400px', triggerOnce: true })
  const [picture, setPicture] = useState(() => {
    const last = lastPicture.get(source)
    return last ? { source, ...last } : null
  })
  const [schemeChanges, setSchemeChanges] = useState(0)

  // Another component's `useAppearance` moves the scheme by the class on <html>, which is
  // all this can see of it. What it draws is cached by colours, so nothing else redraws.
  useEffect(() => {
    if (!inView) return
    const watcher = new MutationObserver(() => setSchemeChanges((n) => n + 1))
    watcher.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => watcher.disconnect()
  }, [inView])

  const element = entry?.target
  useEffect(() => {
    if (!inView || !element || !source.trim()) return
    let live = true
    drawDiagram(source, themeAt(element), element.clientWidth).then((drawn) => {
      if (!live) return
      if (drawn) lastPicture.set(source, drawn)
      setPicture(drawn ? { source, ...drawn } : null)
    })
    return () => {
      live = false
    }
  }, [inView, element, source, schemeChanges])

  // A picture made for other text isn't drawn: the block shows its source until its own arrives.
  const current = picture?.source === source ? picture : null

  return (
    <figure ref={ref} data-kind="diagram" className={className} {...props}>
      {current ? (
        <img
          src={current.src}
          alt={alt || current.label || source}
          width={current.width}
          height={current.height}
          style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
        />
      ) : (
        // Plain, since it stands only until the picture arrives: no highlighter loads for it.
        <Code content={source} language="mermaid" highlight={false} />
      )}
    </figure>
  )
}

export default Mermaid

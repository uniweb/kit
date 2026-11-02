/**
 * Mermaid's engine, in a frame that has no way to the page.
 *
 * ## ⭐ WHY THE WHOLE ENGINE IS SANDBOXED, NOT ONLY ITS PICTURE
 *
 * A diagram's source is content: whoever wrote it may not be the person who
 * wrote the foundation. Mermaid draws by putting the diagram into a live document
 * to measure it, so on the page a label that gets past its sanitizer runs there,
 * before anything could look at the result. Drawing into the page and showing the
 * result in an `<img>` protects only what comes after. And Mermaid's sanitizer
 * does get bypassed: its advisories run from August 2025 to August 2026, XSS, CSS
 * injection into the rest of the page and prototype pollution among them. A
 * published foundation also freezes the version it was built with, so a fix
 * doesn't reach it on its own.
 *
 * So the engine runs in `sandbox="allow-scripts"`: an opaque origin, with no
 * access to the page's DOM, cookies or storage, whatever runs in there. It hands
 * back a string, which the page never parses. It only ever becomes the address of
 * an `<img>`, and an image runs no script and loads nothing. A hostile diagram
 * reaches the frame and stops. `securityLevel: 'strict'` stays on as well.
 *
 * Nothing here runs on a server: the frame opens when a diagram comes into view.
 *
 * ## Where the engine comes from
 *
 * The same kind of thing as a Shiki grammar, for the same reason (`shiki-corpus.js`):
 * large, static, versioned, and wanted by few pages. Bundled into a foundation,
 * Mermaid took a built `docs` foundation from 11 files and 0.49 MB to 72 files and
 * 5.42 MB for every release, on sites whose pages may never draw a diagram, and it
 * adds 122 MB to an install. As a URL it costs a foundation nothing, and only a page
 * with a diagram in view fetches it. The base is the corpus's, so a host that
 * mirrors npm packages for code highlighting mirrors this one beside them.
 *
 * @module @uniweb/kit/styled/Mermaid/sandbox
 */

import { corpusBase } from '../Section/renderers/shiki-corpus.js'

/**
 * The Mermaid release kit draws with. An exact version, so a page draws what was
 * tested and a compromised new release reaches nobody. Moving it is a decision: try
 * a candidate on real diagrams in real browsers first, since no unit test can draw.
 */
export const MERMAID_VERSION = '12.2.0'

/** The engine's address on the corpus. */
export function mermaidUrl() {
  return `${corpusBase()}/mermaid@${MERMAID_VERSION}/dist/mermaid.esm.min.mjs`
}

/**
 * The frame's whole document: it imports the engine and answers one message at a
 * time, since `initialize` is global to the engine and each draw brings its own
 * colours.
 *
 * The drawing leaves as XML with an explicit size, because an SVG shown as an image
 * has to be well-formed and has no box to take `width="100%"` from. HTML labels stay
 * on: as plain SVG text, `<b>` and `<code>` in a label would show as written (25 of
 * 110 of our own diagrams, measured).
 *
 * @param {string} url - the engine's address
 * @returns {string}
 */
export function frameDocument(url) {
  // A JSON string in a script, with nothing in it that can close the script.
  const address = JSON.stringify(url).replace(/</g, '\\u003c')
  return `<!doctype html><meta charset="utf-8"><body><script type="module">
const engine = import(${address}).then((module) => module.default)
let queue = Promise.resolve()
addEventListener('message', (event) => {
  if (event.source === parent) queue = queue.then(() => draw(event.data))
})
async function draw({ id, source, theme, width }) {
  let answer
  try {
    const mermaid = await engine
    document.body.style.width = width > 0 ? width + 'px' : ''
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      suppressErrorRendering: true,
      theme: 'base',
      themeVariables: theme,
      fontFamily: 'system-ui, sans-serif',
    })
    const { svg } = await mermaid.render('diagram-' + id, source)
    const root = new DOMParser().parseFromString(svg, 'text/html').querySelector('svg')
    const { width: w, height: h } = root.viewBox.baseVal
    root.setAttribute('width', Math.ceil(w))
    root.setAttribute('height', Math.ceil(h))
    root.style.removeProperty('max-width')
    answer = {
      id,
      svg: new XMLSerializer().serializeToString(root),
      width: Math.ceil(w),
      height: Math.ceil(h),
      label: [root.querySelector('title'), root.querySelector('desc')]
        .map((node) => node?.textContent?.trim())
        .filter(Boolean)
        .join(': '),
    }
  } catch (error) {
    answer = { id, error: String(error?.message || error).split('\\n')[0] }
  }
  document.body.replaceChildren()
  parent.postMessage(answer, '*')
}
parent.postMessage({ ready: true }, '*')
</script>`
}

let frame = null
let opened = null
let serial = 0
const waiting = new Map()

/** The one frame a page's diagrams share, outside anything React draws. */
function openFrame() {
  opened ||= new Promise((ready) => {
    frame = document.createElement('iframe')
    frame.setAttribute('sandbox', 'allow-scripts')
    frame.setAttribute('aria-hidden', 'true')
    frame.tabIndex = -1
    // In a layout, since the engine measures what it draws, and out of the way.
    frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:1200px;height:900px;border:0;visibility:hidden'
    frame.srcdoc = frameDocument(mermaidUrl())
    addEventListener('message', (event) => {
      if (event.source !== frame.contentWindow) return
      const answer = event.data || {}
      if (answer.ready) return ready()
      waiting.get(answer.id)?.(answer)
      waiting.delete(answer.id)
    })
    document.body.append(frame)
  })
  return opened
}

/**
 * What the frame answered, as what the page may show: an image's address and
 * size, once the browser has decoded it, so a diagram never appears as a blank
 * box. What came from the frame is treated as a stranger's: it only ever becomes an
 * image's address and its numbers and its text only ever attributes.
 */
async function toPicture({ svg, width, height, label }) {
  if (typeof svg !== 'string' || !(width > 0) || !(height > 0)) throw new Error('the engine drew nothing')
  const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  const image = new Image()
  image.src = src
  await image.decode()
  return { src, width, height, label: typeof label === 'string' ? label : '' }
}

const drawings = new Map()

/**
 * Draw a diagram, once for each source and colours. Never rejects: a diagram the
 * engine can't draw — a syntax error, or no way to reach the CDN — resolves to null,
 * and its source stays on the page. A frame that never answers leaves it there too.
 *
 * @param {string} source - the diagram's text
 * @param {Object} theme - Mermaid `themeVariables`
 * @param {number} [width] - the box it will sit in, for the kinds that fill their width
 * @returns {Promise<{ src: string, width: number, height: number, label: string }|null>}
 */
export function drawDiagram(source, theme, width = 0) {
  const key = JSON.stringify([source, theme, width])
  let drawing = drawings.get(key)
  if (!drawing) {
    drawing = openFrame()
      .then(() => new Promise((answer) => {
        const id = ++serial
        waiting.set(id, answer)
        frame.contentWindow.postMessage({ id, source, theme, width }, '*')
      }))
      .then((answer) => {
        if (answer.error) throw new Error(answer.error)
        return toPicture(answer)
      })
      .catch((error) => {
        console.warn('[Mermaid] Kept as code:', error?.message || error)
        return null
      })
    drawings.set(key, drawing)
  }
  return drawing
}

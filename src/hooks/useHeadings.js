/**
 * useHeadings Hook
 *
 * The headings of the page being read, plus which one the reader is level with.
 * What a table of contents needs, without any opinion about how it looks.
 *
 * Every documentation shell on this framework has hand-written this, and each
 * one wrote it the only way a foundation can: scan the DOM for `h2, h3` after
 * the body renders. That works, but it costs a frame of timing guesswork and it
 * cannot run during prerender, so the rail is missing from every served page
 * until hydration.
 *
 * The framework can do better because it owns both ends. It renders the
 * headings and stamps their ids (`headingId`), and it holds the page content
 * that produced them — so the list can come from the content, before anything
 * is painted, and be guaranteed to match the anchors. Only the highlight needs
 * the DOM, because only scrolling does.
 *
 * @example
 * function PageContents() {
 *   const { headings, activeId, scrollTo } = useHeadings()
 *   if (!headings.length) return null
 *
 *   return (
 *     <nav aria-label="On this page">
 *       {headings.map(h => (
 *         <button key={h.id} onClick={() => scrollTo(h.id)}
 *                 className={h.id === activeId ? 'text-primary' : 'text-subtle'}>
 *           {h.text}
 *         </button>
 *       ))}
 *     </nav>
 *   )
 * }
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { headingAnchor, headingId, stripTags } from '../utils/index.js'
import { useWebsite } from './useWebsite.js'
import { useActiveRoute } from './useActiveRoute.js'

/**
 * A heading's characters, as a reader sees them, from the markup the parser gives it. A formula's
 * MathML carries its LaTeX source as well, which no reader sees.
 */
function headingText(html) {
  return stripTags(String(html ?? '').replace(/<annotation[\s\S]*?<\/annotation>/g, '')).trim()
}

/**
 * Pull headings out of the page's own content — available during prerender.
 *
 * ⭐ FROM THE SEQUENCE THE PAGE IS DRAWN FROM, with the anchor it draws (`headingAnchor`), so an entry
 * can't name an id the page doesn't have. ⛔ Until 2026-11-01 this worked from the raw nodes and made
 * each id again, and the two disagreed: the characters of `<path>` in a heading read as an element and
 * were dropped, an authored `{#id}` and a formula were left out, and on a page of error messages most
 * of the rail led nowhere.
 *
 * In a section of its own type, skips the headings the semantic parser claimed
 * as the section's title/pretitle/subtitle. In this framework a `#>` label line
 * is a pretitle (as is a smaller ordinary heading above the title, the older
 * spelling) and the `##` after the title is a subtitle — structure, not body
 * headings — so a typed section would otherwise open every contents rail with
 * two entries no reader recognises as sections of the article.
 *
 * ⭐ WHAT THE SECTION'S TYPE SAYS IT DRAWS DECIDES, where it says: `header` in its
 * runtime schema, from its `content:` (`@uniweb/build` `extractRuntimeSchema`).
 * `true`: it draws the parser's pretitle, title and subtitle as its header, so they
 * are skipped. `false`: it draws the section as written, a `sequence` alone, so every
 * heading counts, the `##` straight under the `#` too: the rail of a page opening
 * `# Install`, `## Homebrew` starts at Homebrew.
 *
 * A type that says neither falls back on the type the file named: none, so the
 * site's default section type, counts everything; any other type skips its header.
 * ⛔ Until 2026-11-05 that guess was the only rule. A default the foundation
 * declares can be a type with a header, so a docs page's `DocSection`, named or
 * not, listed its subtitle (a `<p>`, with no anchor) and nested the page's
 * sections under it, and a rail with one entry is drawn as none.
 */
export function headingsFromContent(page, levels = [2, 3]) {
  const blocks = page?.getBodyBlocks?.() ?? []
  const found = []

  for (const block of blocks) {
    const parsed = block?.parsedContent
    if (!Array.isArray(parsed?.sequence)) continue

    const declared = globalThis.uniweb?.getComponentMeta?.(block.type)?.header
    const drawsHeader =
      typeof declared === 'boolean'
        ? declared
        : !(block.type && block.type === block.website?.getDefaultBlockType?.())
    const claimed = new Set(
      drawsHeader
        ? [parsed.title, parsed.pretitle, parsed.subtitle]
            .flat()
            .filter(Boolean)
            .map(value => String(value).trim())
        : []
    )

    for (const element of parsed.sequence) {
      // `<Render>` draws a `#>` label line as a paragraph, so it has no anchor.
      if (element?.type !== 'heading' || element.attrs?.role === 'pretitle') continue
      const level = element.level ?? 1
      if (!levels.includes(level)) continue
      if (claimed.has(String(element.text ?? '').trim())) continue

      const text = headingText(element.text)
      if (text) found.push({ id: headingAnchor(element), text, level })
    }
  }

  return found
}

/**
 * Fall back to the rendered document, for content this hook cannot see — a
 * foundation rendering its own markup, or anything not built from page blocks.
 */
function headingsFromDom(root, levels) {
  if (typeof document === 'undefined') return []

  const scope = document.querySelector(root)
  if (!scope) return []

  const selector = levels.map(level => `h${level}`).join(', ')

  return [...scope.querySelectorAll(selector)]
    .map(el => {
      const text = el.textContent?.trim() || ''
      if (!text) return null
      // Adopt the id that is there; stamp the shared one when it is missing, so
      // scrollTo has something to find either way.
      if (!el.id) el.id = headingId(text)
      return { id: el.id, text, level: Number(el.tagName[1]) }
    })
    .filter(Boolean)
}

/**
 * Nest a flat, ordered heading list by level. A heading deeper than the one
 * before it becomes its child; anything at or above the top level starts a new
 * branch. Headings that skip a level still land somewhere sensible.
 */
function nest(flat) {
  if (!flat.length) return []

  const topLevel = Math.min(...flat.map(h => h.level))
  const tree = []
  let current = null

  for (const heading of flat) {
    const node = { ...heading, children: [] }
    if (heading.level === topLevel || !current) {
      tree.push(node)
      current = node
    } else {
      current.children.push(node)
    }
  }

  return tree
}

/**
 * A CSS length, as a page measures it, in px — `64px`, `4rem`, `3.5em` — or 0.
 */
export function lengthInPx(value, rootFontSize = 16) {
  const match = /^\s*(-?[\d.]+)(px|rem|em)?\s*$/.exec(String(value ?? ''))
  if (!match) return 0
  const number = parseFloat(match[1])
  return match[2] === 'rem' || match[2] === 'em' ? number * rootFontSize : number
}

/**
 * How far down the viewport the site's header reaches, so anchors are not scrolled under it:
 * what is stuck at the top, as the runtime measures it (`--uw-sticky-top`, a header that is a
 * sticky section), else the foundation's declared `--header-height` — plus a little room.
 * ⛔ Until 2026-10-20 the declared value was read with `parseInt`, so `4rem` — how the starter
 * templates declare it — offset 4px, not 64.
 *
 * ⛔ Read it each time, never once at mount. The runtime measures in the effect of the layout
 * around this hook's component, and a parent's effect runs after its children's, so at mount the
 * variable isn't there. It also moves when the header wraps. Until 2026-11-01 the highlight took it
 * once, at mount: a heading had to pass 45px under a 65px header to count, and every click left
 * the entry before it marked.
 */
function headerOffset(explicit) {
  if (typeof explicit === 'number') return explicit
  if (typeof document === 'undefined') return 0

  const root = getComputedStyle(document.documentElement)
  const rootFontSize = parseFloat(root.fontSize) || 16
  const stuck = root.getPropertyValue('--uw-sticky-top').trim()
  const reach = stuck ? lengthInPx(stuck, rootFontSize) : lengthInPx(root.getPropertyValue('--header-height'), rootFontSize)
  return reach + 16
}

// How long the page has to stand still to count as at rest. A smooth scroll moves every frame.
const REST_MS = 200

/**
 * Which heading a reader at `scrollY` is level with: the last to have come up to the line under
 * the header.
 *
 * A page usually ends before its last headings can get there, since its last section is shorter
 * than the window, and they would never be marked. So over the last stretch of scrolling the line
 * comes down the screen, and reaches the last heading where the page ends. Each heading gets its
 * turn, in order, whatever the page's length.
 *
 * @param {Array<{ id: string, top: number }>} positions - the headings in order, each with its
 *   distance from the top of the page
 * @param {Object} at
 * @param {number} at.scrollY - how far the page is scrolled
 * @param {number} at.room - how far it can scroll
 * @param {number} at.gap - how far below the window's top the line sits
 * @returns {string} the heading's id, the first heading's until one has come up; '' with none
 */
export function headingAt(positions, { scrollY, room, gap }) {
  if (!positions.length) return ''

  const short = positions[positions.length - 1].top - (room + gap)
  const stretch = Math.min(short, room)
  const into = scrollY - (room - stretch)
  const line = scrollY + gap + 4 + (stretch > 0 && into > 0 ? (short * into) / stretch : 0)

  let current = positions[0].id
  for (const { id, top } of positions) {
    if (top <= line) current = id
  }
  return current
}

/**
 * Hold a heading the reader asked for until the page has come to rest, wherever that is: a page
 * that ends early stops short of the line, and what the page does on the way is not the reader's.
 * Each scroll on the way starts the wait again. Where it rests is `rest`, and a move from there
 * is the reader's own.
 */
function holdUntilRest(asked) {
  clearTimeout(asked.current?.timer)
  const hold = { rest: null }
  hold.timer = setTimeout(() => {
    hold.rest = window.scrollY
  }, REST_MS)
  asked.current = hold
}

/**
 * @param {Object} [options]
 * @param {number[]} [options.levels=[2,3]] - Heading levels to collect
 * @param {string} [options.root='main'] - Selector to scan, for the DOM fallback
 * @param {number} [options.offset] - Scroll offset in px; defaults to how far the
 *   site's header reaches — `--uw-sticky-top` when a sticky header was measured, else
 *   `--header-height` — plus a little breathing room
 * @returns {{ headings: Array, activeId: string, scrollTo: (id: string) => void }}
 *   `headings` is nested — each entry carries `{ id, text, level, children }`
 */
export function useHeadings({ levels = [2, 3], root = 'main', offset } = {}) {
  const { website } = useWebsite()
  const { route } = useActiveRoute()
  const [domHeadings, setDomHeadings] = useState(null)
  const [activeId, setActiveId] = useState('')
  // The hold on a heading the reader asked for (`holdUntilRest`), while it stays marked.
  const asked = useRef(null)

  // The content path runs during render, so it is available server-side.
  const contentHeadings = useMemo(
    () => headingsFromContent(website?.activePage, levels),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [website?.activePage, route, levels.join()]
  )

  // Only reached when the content path found nothing.
  useEffect(() => {
    setActiveId('')
    if (contentHeadings.length) {
      setDomHeadings(null)
      return
    }
    const id = requestAnimationFrame(() => setDomHeadings(headingsFromDom(root, levels)))
    return () => cancelAnimationFrame(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, contentHeadings.length, root, levels.join()])

  const flat = contentHeadings.length ? contentHeadings : domHeadings ?? []
  const headings = useMemo(() => nest(flat), [flat])

  // Which heading the reader is level with. Scroll position is the one thing
  // here that only the DOM knows.
  useEffect(() => {
    if (!flat.length || typeof window === 'undefined') return

    function onScroll() {
      // A heading the reader asked for stays marked until they move the page on from it (a pixel
      // of give, for a page resting between two pixels).
      if (asked.current) {
        if (asked.current.rest === null) return holdUntilRest(asked)
        if (Math.abs(window.scrollY - asked.current.rest) <= 1) return
        asked.current = null
      }

      const positions = []
      for (const { id } of flat) {
        const el = document.getElementById(id)
        if (el) positions.push({ id, top: el.getBoundingClientRect().top + window.scrollY })
      }
      setActiveId(
        headingAt(positions, {
          scrollY: window.scrollY,
          room: document.documentElement.scrollHeight - window.innerHeight,
          gap: headerOffset(offset),
        }) || flat[0].id
      )
    }

    // A frame on, so the layout around this component has measured its header (`headerOffset`).
    // The address may name a heading, and the browser and the runtime are taking the page there.
    // ⛔ Not `:target`: the browser renders over the prerendered page, so that element is gone.
    const frame = requestAnimationFrame(() => {
      const hash = window.location.hash.slice(1)
      const named = hash && flat.find(({ id }) => encodeURI(id) === hash)
      if (named) {
        holdUntilRest(asked)
        setActiveId(named.id)
      } else {
        onScroll()
      }
    })
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      clearTimeout(asked.current?.timer)
      asked.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, flat.map(h => h.id).join(), offset])

  const scrollTo = useCallback(
    id => {
      const el = typeof document !== 'undefined' && document.getElementById(id)
      if (!el) return
      holdUntilRest(asked)
      setActiveId(id)
      window.scrollTo({
        top: el.getBoundingClientRect().top + window.scrollY - headerOffset(offset),
        behavior: 'smooth',
      })
    },
    [offset]
  )

  return { headings, activeId, scrollTo }
}

export default useHeadings

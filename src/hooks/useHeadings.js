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

import { useCallback, useEffect, useMemo, useState } from 'react'
import { headingId, nodeText } from '../utils/index.js'
import { useWebsite } from './useWebsite.js'
import { useActiveRoute } from './useActiveRoute.js'

/**
 * Pull headings out of the page's own content — available during prerender.
 */
function headingsFromContent(page, levels) {
  const blocks = page?.getBodyBlocks?.() ?? []
  const found = []

  for (const block of blocks) {
    const nodes = block?.rawContent?.content
    if (!Array.isArray(nodes)) continue

    for (const node of nodes) {
      if (node?.type !== 'heading') continue
      const level = node.attrs?.level ?? 1
      if (!levels.includes(level)) continue

      const text = nodeText(node).trim()
      if (text) found.push({ id: headingId(text), text, level })
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
 * Height of the fixed site header, so anchors are not scrolled under it.
 */
function headerOffset(explicit) {
  if (typeof explicit === 'number') return explicit
  if (typeof document === 'undefined') return 0

  const declared = getComputedStyle(document.documentElement).getPropertyValue('--header-height')
  return (parseInt(declared, 10) || 0) + 16
}

/**
 * @param {Object} [options]
 * @param {number[]} [options.levels=[2,3]] - Heading levels to collect
 * @param {string} [options.root='main'] - Selector to scan, for the DOM fallback
 * @param {number} [options.offset] - Scroll offset in px; defaults to the site
 *   header's height read from `--header-height`, plus a little breathing room
 * @returns {{ headings: Array, activeId: string, scrollTo: (id: string) => void }}
 *   `headings` is nested — each entry carries `{ id, text, level, children }`
 */
export function useHeadings({ levels = [2, 3], root = 'main', offset } = {}) {
  const { website } = useWebsite()
  const { route } = useActiveRoute()
  const [domHeadings, setDomHeadings] = useState(null)
  const [activeId, setActiveId] = useState('')

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

    const gap = headerOffset(offset)

    function onScroll() {
      const line = window.scrollY + gap + 4
      let current = ''
      for (const { id } of flat) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top + window.scrollY <= line) current = id
      }
      setActiveId(current || flat[0].id)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flat.map(h => h.id).join(), offset])

  const scrollTo = useCallback(
    id => {
      const el = typeof document !== 'undefined' && document.getElementById(id)
      if (!el) return
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

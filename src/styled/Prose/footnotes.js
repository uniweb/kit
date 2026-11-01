/**
 * Footnotes, as markdown writes them: `[^id]` where the mark goes, and a `[^id]: the note`
 * paragraph anywhere in the same section.
 *
 * The markdown reader keeps both as the text they are, so nothing about a footnote is stored, sent
 * or cleaned differently from any other text, and a file round-trips as written. Turning them into
 * footnotes is rendering, so it's here: each mark a number linked to its note, the notes listed at
 * the end of the section. It costs a site nothing unless a foundation uses `<Prose>`.
 *
 * A mark with no note stays as written, and so does a note with no mark, so an author sees either.
 */

const NOTE = /^\[\^([^\]\s]+)\]:\s*/

// A mark, or a code span to step over: `[^1]` in code is words about a footnote.
const MARK = /<code\b[^>]*>[\s\S]*?<\/code>|\[\^([^\]\s]+)\]/g

const noteOf = (element) =>
  element?.type === 'paragraph' && typeof element.text === 'string' ? NOTE.exec(element.text) : null

/** The element with `change` applied to each text it holds, through lists, quotes and tables. */
function mapText(element, change) {
  if (!element || typeof element !== 'object') return element
  if (Array.isArray(element)) return element.map((e) => mapText(e, change))
  if (element.type === 'codeBlock' || element.type === 'math') return element
  const next = { ...element }
  if (typeof next.text === 'string') next.text = change(next.text)
  for (const key of ['children', 'rows', 'cells', 'items']) {
    if (Array.isArray(next[key])) next[key] = mapText(next[key], change)
  }
  return next
}

/**
 * A section's sequence with its footnotes resolved, and the notes it now lists.
 *
 * @param {Array|null} sequence
 * @param {string} [scope] - tells this section's anchors from another's on the same page
 * @returns {{ sequence: Array|null, notes: Array<{ id: string, backId: string, html: string }> }}
 */
export function footnotesIn(sequence, scope = '') {
  if (!sequence?.some(noteOf)) return { sequence, notes: [] }

  const written = new Map()
  for (const element of sequence) {
    const note = noteOf(element)
    if (note) written.set(note[1], element.text.slice(note[0].length))
  }

  const prefix = String(scope).replace(/[^\w-]/g, '')
  const anchor = (kind, number) => [kind, prefix, number].filter(Boolean).join('-')
  const numbers = new Map()
  const marked = (text) =>
    text.replace(MARK, (match, id) => {
      if (!id || !written.has(id)) return match
      const seen = numbers.has(id)
      if (!seen) numbers.set(id, numbers.size + 1)
      const number = numbers.get(id)
      // The note links back to the first mark, so only that one holds the anchor.
      const back = seen ? '' : ` id="${anchor('fnref', number)}"`
      return `<sup class="footnote-ref"><a href="#${anchor('fn', number)}"${back}>${number}</a></sup>`
    })

  const body = sequence.map((element) => (noteOf(element) ? element : mapText(element, marked)))

  return {
    sequence: body.filter((element) => !numbers.has(noteOf(element)?.[1])),
    notes: [...numbers].map(([id, number]) => ({
      id: anchor('fn', number),
      backId: anchor('fnref', number),
      html: written.get(id),
    })),
  }
}

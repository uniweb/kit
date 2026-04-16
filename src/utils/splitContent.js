/**
 * Split parsed content at divider elements in the sequence.
 *
 * Returns an array of content-like objects — one per region between
 * dividers. Each object is a shallow copy of the original content
 * with its own `sequence` slice. Grouped fields (title, paragraphs,
 * items, etc.) are preserved from the original — only `sequence` is
 * split. If no divider exists, returns a single-element array
 * containing the original content.
 *
 * @param {Object} content - Parsed content from semantic parser
 * @returns {Array<Object>} Array of content objects with split sequences
 */
export function splitContent(content) {
  const seq = content.sequence || []
  const segments = [[]]
  for (const el of seq) {
    if (el.type === 'divider') segments.push([])
    else segments[segments.length - 1].push(el)
  }
  if (segments.length === 1) return [content]
  return segments.map(s => ({ ...content, sequence: s }))
}

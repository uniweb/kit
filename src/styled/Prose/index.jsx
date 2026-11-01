/**
 * Prose — content plus prose typography.
 *
 * `<Render>` walks the sequence; this adds the `prose` container that styles
 * the semantic markup it emits. Two concerns, deliberately separate: a
 * foundation with its own type system uses `<Render>` and lays out the elements
 * itself.
 *
 * The typography is `@uniweb/kit/prose-tokens.css`, one import in the
 * foundation's stylesheet: kit's own rules for the content vocabulary, colored
 * by the section's theme tokens and scaled by the site's `--prose-*` variables.
 * `size` picks a step of that scale. ⛔ Until 2026-10-19 it was Tailwind
 * Typography, which re-declared its colors on every container — hence the old
 * rules against nesting one and against palette modifiers, which no longer
 * apply.
 *
 * Markdown footnotes (`[^1]` and `[^1]: the note`) are resolved here, with the notes listed at
 * the end (`./footnotes.js`). A foundation that uses `<Render>` lays those out itself.
 *
 * Also works as a pure typography wrapper when given children instead of
 * content.
 *
 * @module @uniweb/kit/styled/Prose
 */

import React from 'react'
import { cn } from '../../utils/index.js'
import { SafeHtml } from '../../components/SafeHtml/index.js'
import { Render, toSequence } from '../Render/index.jsx'
import { footnotesIn } from './footnotes.js'

/** Prose sizes */
const SIZE_CLASSES = {
  sm: 'prose-sm',
  base: 'prose-base',
  lg: 'prose-lg',
  xl: 'prose-xl',
  '2xl': 'prose-2xl'
}

/**
 * Prose - Rendered content with prose typography
 *
 * @param {Object} props
 * @param {Object|Array} [props.content] - Parsed content (`.sequence`), a
 *   ProseMirror doc, or an array of ProseMirror nodes
 * @param {Object} [props.block] - Block instance (supplies content; resolves insets)
 * @param {Object} [props.components] - Per-element-type renderer overrides
 * @param {string} [props.size='lg'] - Text size: sm, base, lg, xl, 2xl
 * @param {string} [props.as='div'] - HTML element to render as
 * @param {string} [props.className] - Additional CSS classes
 * @param {React.ReactNode} [props.children] - Alternative to content (pure wrapper mode)
 *
 * @example
 * // Typical usage in a section component
 * function Lesson({ content, block }) {
 *   return <Prose content={content} block={block} />
 * }
 *
 * @example
 * // Render one element type your own way — the foundation's design, kit's walk
 * <Prose content={content} block={block} components={{ concept_block: Faq }} />
 *
 * @example
 * // Access data blocks separately — they are deliberately not rendered
 * <Prose content={content} block={block} />
 * {content.data.quiz && <Quiz data={content.data.quiz} />}
 *
 * @example
 * // Pure typography wrapper
 * <Prose size="base">
 *   <h2>Title</h2>
 * </Prose>
 */
export function Prose({
  block,
  content,
  components,
  size = 'lg',
  as: Component = 'div',
  className,
  children,
  ...props
}) {
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.lg

  if (children != null) {
    return (
      <Component className={cn('prose', sizeClass, 'max-w-none', className)} {...props}>
        {children}
      </Component>
    )
  }

  const { sequence, notes } = footnotesIn(toSequence(content, block), block?.stableId ?? block?.id)

  return (
    <Component className={cn('prose', sizeClass, 'max-w-none', className)} {...props}>
      <Render content={sequence ? { sequence } : content} block={block} components={components} />
      {notes.length > 0 && (
        <ol className="footnotes">
          {notes.map((note) => (
            <li key={note.id} id={note.id}>
              <SafeHtml value={note.html} as="span" />{' '}
              <a href={`#${note.backId}`} className="footnote-back" aria-label="Back to the text">
                ↩
              </a>
            </li>
          ))}
        </ol>
      )}
    </Component>
  )
}

export default Prose

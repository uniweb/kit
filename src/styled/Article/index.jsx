/**
 * Article — a document, in a semantic <article>.
 *
 * `<Prose>` with the right tag. That is the whole component now, and the point
 * of it is the element: an article is a self-contained composition, and saying
 * so in markup is what assistive technology and reader modes act on.
 *
 * It used to be its own thing — a prose container wrapped around a SECOND node
 * walker that read raw ProseMirror. That is why articles rendered with no bold,
 * no links and no math until 2026-07-30: the walker's `paragraph` case
 * flattened inline content to plain text, and it had no case for math at all.
 * Going through `<Render>` means there is one walk, and inline content arrives
 * from the parser already correct.
 *
 * @module @uniweb/kit/styled/Article
 */

import React from 'react'
import { Prose } from '../Prose/index.jsx'

/**
 * Article - Semantic article with prose typography
 *
 * @param {Object} props
 * @param {Object|Array} [props.content] - Parsed content (`.sequence`), a
 *   ProseMirror doc, or an array of ProseMirror nodes
 * @param {Object} [props.block] - Block instance (supplies content; resolves insets)
 * @param {Object} [props.components] - Per-element-type renderer overrides
 * @param {string} [props.size='lg'] - Text size: sm, base, lg, xl, 2xl
 * @param {string} [props.className] - Additional CSS classes
 * @param {React.ReactNode} [props.children] - Content to render (alternative to content)
 *
 * @example
 * <Article content={articleData.content} />
 *
 * @example
 * <Article block={block} components={{ blockquote: PullQuote }} />
 */
export function Article({ content, block, components, size = 'lg', className, children, ...props }) {
  return (
    <Prose
      as="article"
      content={content}
      block={block}
      components={components}
      size={size}
      className={className}
      {...props}
    >
      {children}
    </Prose>
  )
}

export default Article

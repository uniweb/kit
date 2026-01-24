/**
 * Article Component
 *
 * Semantic article wrapper with prose typography.
 * Use for blog posts, news articles, documentation pages, etc.
 *
 * @module @uniweb/kit/styled/Article
 */

import React from 'react'
import { cn } from '../../utils/index.js'
import { Render } from '../Section/Render.jsx'

/**
 * Prose sizes
 */
const SIZE_CLASSES = {
  sm: 'prose-sm',
  base: 'prose-base',
  lg: 'prose-lg',
  xl: 'prose-xl',
  '2xl': 'prose-2xl'
}

/**
 * Article - Semantic article with prose typography
 *
 * Renders content inside a semantic <article> tag with prose styling.
 * Can accept either children or a content prop (ProseMirror JSON).
 *
 * @param {Object} props
 * @param {Object|Array} [props.content] - ProseMirror content to render
 * @param {string} [props.size='lg'] - Text size: sm, base, lg, xl, 2xl
 * @param {string} [props.className] - Additional CSS classes
 * @param {React.ReactNode} [props.children] - Content to render (alternative to content prop)
 *
 * @example
 * // With ProseMirror content
 * <Article content={articleData.content} />
 *
 * @example
 * // With children
 * <Article>
 *   <h1>My Article</h1>
 *   <p>Article content...</p>
 * </Article>
 *
 * @example
 * // Composing with Render
 * <Article size="base" className="dark:prose-invert">
 *   <Render content={proseMirrorContent} />
 * </Article>
 */
export function Article({
  content,
  size = 'lg',
  className,
  children,
  ...props
}) {
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.lg

  // Resolve content - if it's a ProseMirror doc, get the content array
  let resolvedContent = content
  if (resolvedContent?.type === 'doc') {
    resolvedContent = resolvedContent.content
  }

  return (
    <article
      className={cn('prose', sizeClass, 'max-w-none', className)}
      {...props}
    >
      {children || (resolvedContent && <Render content={resolvedContent} />)}
    </article>
  )
}

export default Article

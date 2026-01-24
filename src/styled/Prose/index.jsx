/**
 * Prose Component
 *
 * Typography wrapper for long-form content.
 * Applies prose styling for readable text.
 *
 * @module @uniweb/kit/styled/Prose
 */

import React from 'react'
import { cn } from '../../utils/index.js'

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
 * Prose - Typography wrapper for long-form content
 *
 * Applies Tailwind Typography (prose) classes for readable text styling.
 * Use for article bodies, documentation, or any long-form content.
 *
 * @param {Object} props
 * @param {string} [props.size='lg'] - Text size: sm, base, lg, xl, 2xl
 * @param {string} [props.as='div'] - HTML element to render as
 * @param {string} [props.className] - Additional CSS classes
 * @param {React.ReactNode} props.children - Content to render
 *
 * @example
 * <Prose>
 *   <h2>Article Title</h2>
 *   <p>Article content...</p>
 * </Prose>
 *
 * @example
 * <Prose size="base" className="dark:prose-invert">
 *   <Render content={proseMirrorContent} />
 * </Prose>
 */
export function Prose({
  size = 'lg',
  as: Component = 'div',
  className,
  children,
  ...props
}) {
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.lg

  return (
    <Component
      className={cn('prose', sizeClass, 'max-w-none', className)}
      {...props}
    >
      {children}
    </Component>
  )
}

export default Prose

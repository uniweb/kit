/**
 * Section Component
 *
 * Rich content section renderer for Uniweb pages.
 * Handles content parsing, layout, and rendering.
 *
 * @module @uniweb/kit/Section
 */

import React from 'react'
import { cn } from '../../utils/index.js'
import { useWebsite } from '../../hooks/useWebsite.js'
import { Render } from './Render.jsx'

/**
 * Width presets
 */
const WIDTH_CLASSES = {
  sm: 'max-w-2xl',
  md: 'max-w-4xl',
  lg: 'max-w-5xl',
  xl: 'max-w-6xl',
  '2xl': 'max-w-7xl',
  full: 'max-w-none'
}

/**
 * Column layouts
 */
const COLUMN_CLASSES = {
  '1': 'grid-cols-1',
  '2': 'grid-cols-1 md:grid-cols-2',
  '3': 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  '4': 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
}

/**
 * Padding presets
 */
const PADDING_CLASSES = {
  none: '',
  sm: 'py-8',
  md: 'py-12',
  lg: 'py-16',
  xl: 'py-24'
}

/**
 * Section - Rich content section
 *
 * @param {Object} props
 * @param {Object} [props.block] - Block object from content
 * @param {Object|Array} [props.content] - Content to render
 * @param {string} [props.width='lg'] - Content width: sm, md, lg, xl, 2xl, full
 * @param {string} [props.columns='1'] - Column layout: 1, 2, 3, 4
 * @param {string} [props.padding='lg'] - Vertical padding: none, sm, md, lg, xl
 * @param {string} [props.as='section'] - HTML element to render as
 * @param {string} [props.className] - Additional CSS classes
 * @param {React.ReactNode} [props.children] - Child elements
 *
 * @example
 * <Section content={blockContent} width="lg" padding="md" />
 *
 * @example
 * <Section width="xl" columns="2" className="bg-gray-50">
 *   <div>Column 1</div>
 *   <div>Column 2</div>
 * </Section>
 */
export function Section({
  block,
  content,
  width = 'lg',
  columns = '1',
  padding = 'lg',
  as: Component = 'section',
  className,
  children,
  ...props
}) {
  const { website } = useWebsite()

  // Get properties from block if provided
  const blockProps = block?.getBlockProperties?.() || {}
  const resolvedWidth = blockProps.width || width
  const resolvedColumns = blockProps.columns || columns
  const resolvedPadding = blockProps.vertical_padding || padding

  // Get content from block if not provided directly
  let resolvedContent = content

  if (!resolvedContent && block) {
    // Get parsed content from block
    resolvedContent = block.parsedContent || block.content

    // If it's a ProseMirror doc, get the content array
    if (resolvedContent?.type === 'doc') {
      resolvedContent = resolvedContent.content
    }
  }

  // Build classes
  const widthClass = WIDTH_CLASSES[resolvedWidth] || WIDTH_CLASSES.lg
  const columnClass = COLUMN_CLASSES[resolvedColumns] || COLUMN_CLASSES['1']
  const paddingClass = PADDING_CLASSES[resolvedPadding] || PADDING_CLASSES.lg

  return (
    <Component
      className={cn(paddingClass, className)}
      {...props}
    >
      <div className={cn('mx-auto px-4 sm:px-6 lg:px-8', widthClass)}>
        {/* Content grid */}
        {(resolvedContent || children) && (
          <div className={cn(
            columns !== '1' && 'grid gap-8',
            columns !== '1' && columnClass
          )}>
            {children || (
              <div className="prose prose-gray max-w-none">
                <Render content={resolvedContent} />
              </div>
            )}
          </div>
        )}
      </div>
    </Component>
  )
}

export default Section

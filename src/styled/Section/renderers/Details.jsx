/**
 * Details/Collapsible Renderer
 *
 * Renders collapsible content sections.
 *
 * @module @uniweb/kit/Section/renderers/Details
 */

import React, { useState } from 'react'
import { cn } from '../../../utils/index.js'
import { SafeHtml } from '../../../components/SafeHtml/index.js'

/**
 * Details - Collapsible section
 *
 * @param {Object} props
 * @param {string} props.summary - Summary/title text
 * @param {string|React.ReactNode} props.content - Collapsible content
 * @param {boolean} [props.open=false] - Initially open
 * @param {string} [props.className] - Additional CSS classes
 */
export function Details({
  summary,
  content,
  open = false,
  className,
  ...props
}) {
  const [isOpen, setIsOpen] = useState(open)

  return (
    <div
      className={cn(
        'border border-border rounded-lg overflow-hidden',
        className
      )}
      {...props}
    >
      {/* Summary/Toggle */}
      <button
        className={cn(
          'w-full flex items-center justify-between px-4 py-3',
          'text-left font-medium text-heading bg-muted',
          'hover:bg-card transition-colors'
        )}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <span>{summary}</span>
        <svg
          className={cn(
            'w-5 h-5 text-subtle transition-transform',
            isOpen && 'rotate-180'
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Content */}
      {isOpen && (
        <div className="px-4 py-3 border-t border-border">
          {typeof content === 'string' ? (
            <SafeHtml value={content} className="prose prose-sm" />
          ) : (
            content
          )}
        </div>
      )}
    </div>
  )
}

export default Details

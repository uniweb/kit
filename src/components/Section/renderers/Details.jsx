/**
 * Details/Collapsible Renderer
 *
 * Renders collapsible content sections.
 *
 * @module @uniweb/kit/Section/renderers/Details
 */

import React, { useState } from 'react'
import { cn } from '../../../utils/index.js'
import { SafeHtml } from '../../SafeHtml/index.js'

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
        'border border-gray-200 rounded-lg overflow-hidden',
        className
      )}
      {...props}
    >
      {/* Summary/Toggle */}
      <button
        className={cn(
          'w-full flex items-center justify-between px-4 py-3',
          'text-left font-medium text-gray-900 bg-gray-50',
          'hover:bg-gray-100 transition-colors'
        )}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <span>{summary}</span>
        <svg
          className={cn(
            'w-5 h-5 text-gray-500 transition-transform',
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
        <div className="px-4 py-3 border-t border-gray-200">
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

/**
 * Table Renderer
 *
 * Renders HTML tables from structured content.
 *
 * @module @uniweb/kit/Section/renderers/Table
 */

import React from 'react'
import { cn } from '../../../utils/index.js'
import { SafeHtml } from '../../../components/SafeHtml/index.js'

/**
 * Table - Table renderer
 *
 * @param {Object} props
 * @param {Array} props.content - Table content as rows/cells array
 * @param {string} [props.className] - Additional CSS classes
 */
export function Table({ content, className, ...props }) {
  if (!content || !Array.isArray(content)) return null

  return (
    <div className={cn('overflow-x-auto', className)} {...props}>
      <table className="min-w-full divide-y divide-border border border-border rounded-lg">
        <tbody className="divide-y divide-border bg-section">
          {content.map((row, rowIndex) => (
            <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-section' : 'bg-muted'}>
              {row.content?.map((cell, cellIndex) => {
                const CellTag = cell.type === 'tableHeader' ? 'th' : 'td'
                const cellContent = cell.content?.[0]?.content?.[0]?.text || ''

                return (
                  <CellTag
                    key={cellIndex}
                    className={cn(
                      'px-4 py-2 text-sm',
                      cell.type === 'tableHeader'
                        ? 'font-medium text-heading bg-muted'
                        : 'text-body'
                    )}
                  >
                    <SafeHtml value={cellContent} as="span" />
                  </CellTag>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default Table

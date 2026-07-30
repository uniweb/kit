/**
 * Table Renderer — the styled table, opt-in.
 *
 * The engine emits a plain semantic `<table>` and leaves the look to the
 * typography layer, because what a table LOOKS like is a foundation's call.
 * This is the other option: visible structure — header band, row separators,
 * zebra striping — that a foundation opts into.
 *
 *   <Prose content={content} block={block} components={{ table: Table }} />
 *
 * ── What was wrong with it ──
 *
 * Until 2026-07-31 this read raw ProseMirror and got two things wrong, both
 * silently. It tested `cell.type === 'tableHeader'`, a node type the reader
 * never emits — cells are `tableCell` carrying `attrs.header` — so **no cell
 * was ever a `<th>`** and every table rendered as an undifferentiated grid.
 * And it read `cell.content[0].content[0].text`, the first text node of the
 * first paragraph, so a cell was truncated to its first run with every mark
 * discarded: `` `name` `` came out as bare `name`, and a cell holding a link
 * lost it entirely.
 *
 * It now takes the sequence's table element, where a cell is a nested sequence
 * — so a cell keeps its marks and may hold any block.
 *
 * @module @uniweb/kit/Section/renderers/Table
 */

import React from 'react'
import { cn } from '../../../utils/index.js'
import { SafeHtml } from '../../../components/SafeHtml/index.js'
import { SequenceElement } from '../../Render/index.jsx'

/**
 * A cell's contents, with a lone paragraph unwrapped.
 *
 * `tableCell` is `paragraph+`, so a markdown cell is always exactly one
 * paragraph — and emitting that `<p>` is what a typography layer then gives
 * margins to, measured at 17.5px top and bottom, turning one-line rows into
 * 75px. The engine makes the same allowance for the same reason.
 */
function cellContent(cell, block, components) {
  const children = cell?.children || []
  const [only] = children

  if (children.length === 1 && only?.type === 'paragraph') {
    return <SafeHtml value={only.text || ''} as="span" />
  }
  return children.map((el, i) => (
    <SequenceElement key={i} element={el} block={block} components={components} />
  ))
}

/**
 * Table - styled table renderer
 *
 * @param {Object} props
 * @param {Array} [props.rows] - Rows from a sequence table element
 * @param {Object} [props.element] - The table element itself, so this drops
 *   straight into `components={{ table: Table }}` with no adapter
 * @param {Object} [props.block] - Block instance, for insets inside a cell
 * @param {Object} [props.components] - Renderer overrides, for nested content
 * @param {string} [props.className] - Additional CSS classes
 */
export function Table({ rows, element, block, components, className, ...props }) {
  const data = rows ?? element?.rows
  if (!Array.isArray(data) || data.length === 0) return null

  const [first, ...rest] = data
  const hasHeader = first.cells?.some((cell) => cell.header)
  const bodyRows = hasHeader ? rest : data

  const renderRow = (row, key, zebra) => (
    <tr key={key} className={zebra ? 'bg-muted' : undefined}>
      {row.cells?.map((cell, i) => {
        const CellTag = cell.header ? 'th' : 'td'
        return (
          <CellTag
            key={i}
            style={cell.align ? { textAlign: cell.align } : undefined}
            colSpan={cell.colspan > 1 ? cell.colspan : undefined}
            rowSpan={cell.rowspan > 1 ? cell.rowspan : undefined}
            className={cn(
              'px-4 py-2 text-sm',
              cell.header ? 'font-medium text-heading' : 'text-body'
            )}
          >
            {cellContent(cell, block, components)}
          </CellTag>
        )
      })}
    </tr>
  )

  return (
    <div className={cn('overflow-x-auto', className)} {...props}>
      <table className="min-w-full border border-border rounded-lg">
        {hasHeader && <thead className="bg-muted">{renderRow(first, 'h', false)}</thead>}
        <tbody className="divide-y divide-border">
          {bodyRows.map((row, i) => renderRow(row, i, i % 2 === 1))}
        </tbody>
      </table>
    </div>
  )
}

export default Table

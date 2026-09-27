/**
 * ChildGrid — a section's child sections, laid out in the columns its author chose.
 *
 * The author chooses with the section's reserved `grid:` key — `3` (equal columns) or
 * `'40/60'` (relative widths) — one of the layouts the component offers in `meta.js`
 * (`children: { grid: [2, 3, '40/60'] }`). A component opts in by rendering its
 * children through this, so what a visual editor draws from the same value
 * (`gridTemplate`, `@uniweb/schemas/grid`) is what renders.
 *
 * Narrow screens get one column; from the `md` breakpoint a layout of up to two
 * columns applies as chosen and a wider one shows two equal columns; from `lg` the
 * chosen layout applies whatever its width.
 *
 * @module @uniweb/kit/styled/ChildGrid
 */

import React from 'react'
import { parseGrid, gridTemplate } from '@uniweb/schemas/grid'
import { ChildBlocks, cn } from '../../utils/index.js'

const TWO_EQUAL = 'repeat(2, minmax(0, 1fr))'

/**
 * @param {Object} props
 * @param {Object} props.from - the section's Block; its `childBlocks` are laid out
 * @param {number|string} [props.fallback] - the layout when the section chose none
 *   (or chose something that is not a layout) — the component's default
 * @param {boolean} [props.headerRow] - the first child spans every column
 * @param {string} [props.className] - classes on the grid, e.g. a gap (`gap-8` by default)
 * @param {string} [props.cellClassName] - classes on each child's cell
 *
 * @example
 * <ChildGrid from={block} fallback={3} headerRow={params.headerRow} className="gap-6" />
 */
export function ChildGrid({ from: block, fallback = null, headerRow = false, className, cellClassName }) {
  const children = block?.childBlocks || []
  if (children.length === 0) return null

  const choice = parseGrid(block.grid) ? block.grid : fallback
  const layout = parseGrid(choice)
  const style = layout
    ? {
        '--uniweb-grid-cols': gridTemplate(choice),
        '--uniweb-grid-cols-md': layout.columns <= 2 ? gridTemplate(choice) : TWO_EQUAL,
      }
    : undefined

  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-8',
        layout && 'md:grid-cols-[var(--uniweb-grid-cols-md)] lg:grid-cols-[var(--uniweb-grid-cols)]',
        className
      )}
      style={style}
      data-grid={layout ? String(choice) : undefined}
    >
      {children.map((child, index) => (
        <div
          key={child.id || index}
          className={cn(headerRow && index === 0 && 'md:col-span-full', cellClassName)}
        >
          <ChildBlocks blocks={[child]} />
        </div>
      ))}
    </div>
  )
}

export default ChildGrid

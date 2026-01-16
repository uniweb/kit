/**
 * Divider Renderer
 *
 * Renders horizontal dividers.
 *
 * @module @uniweb/kit/Section/renderers/Divider
 */

import React from 'react'
import { cn } from '../../../utils/index.js'

/**
 * Divider - Horizontal divider
 *
 * @param {Object} props
 * @param {string} [props.type='hr'] - Divider type: 'hr' or 'dots'
 * @param {string} [props.className] - Additional CSS classes
 */
export function Divider({ type = 'hr', className, ...props }) {
  if (type === 'dots') {
    return (
      <div
        className={cn('flex justify-center gap-2 py-4', className)}
        role="separator"
        {...props}
      >
        <span className="w-2 h-2 bg-gray-300 rounded-full" />
        <span className="w-2 h-2 bg-gray-300 rounded-full" />
        <span className="w-2 h-2 bg-gray-300 rounded-full" />
      </div>
    )
  }

  return (
    <hr
      className={cn('border-gray-200 my-6', className)}
      {...props}
    />
  )
}

export default Divider

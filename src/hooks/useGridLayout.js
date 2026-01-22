/**
 * useGridLayout Hook
 *
 * Returns Tailwind CSS classes for responsive grid layouts.
 * Standardizes the grid column patterns used across components.
 *
 * @example
 * function Features({ items, params }) {
 *   const gridClass = useGridLayout(params.columns)
 *
 *   return (
 *     <div className={gridClass}>
 *       {items.map(item => <FeatureCard key={item.id} {...item} />)}
 *     </div>
 *   )
 * }
 *
 * @example
 * // With custom gap
 * const gridClass = useGridLayout(3, { gap: 12 })
 * // Returns: "grid gap-12 sm:grid-cols-2 lg:grid-cols-3"
 */

/**
 * Standard responsive grid column configurations.
 * Keys are column counts, values are Tailwind classes.
 */
const GRID_CONFIGS = {
  1: '',
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 lg:grid-cols-3',
  4: 'sm:grid-cols-2 lg:grid-cols-4',
  5: 'sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5',
  6: 'sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6',
}

/**
 * Hook to generate responsive grid layout classes.
 *
 * @param {number} columns - Number of columns (1-6)
 * @param {Object} options - Configuration options
 * @param {number} [options.gap=8] - Gap size (Tailwind scale: 4, 6, 8, 10, 12)
 * @param {string} [options.baseClass='grid'] - Base class to include
 * @returns {string} Tailwind CSS classes for the grid
 */
export function useGridLayout(columns = 3, options = {}) {
  const {
    gap = 8,
    baseClass = 'grid',
  } = options

  const colConfig = GRID_CONFIGS[columns] || GRID_CONFIGS[3]
  const gapClass = `gap-${gap}`

  return [baseClass, gapClass, colConfig].filter(Boolean).join(' ')
}

/**
 * Get grid classes without the hook (for non-React contexts)
 * @param {number} columns
 * @param {Object} options
 * @returns {string}
 */
export function getGridClasses(columns = 3, options = {}) {
  const { gap = 8, baseClass = 'grid' } = options
  const colConfig = GRID_CONFIGS[columns] || GRID_CONFIGS[3]
  const gapClass = `gap-${gap}`
  return [baseClass, gapClass, colConfig].filter(Boolean).join(' ')
}

export default useGridLayout

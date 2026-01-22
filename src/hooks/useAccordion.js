/**
 * useAccordion Hook
 *
 * Manages expand/collapse state for accordion-style UIs.
 * Used in FAQ components and collapsible navigation (LeftPanel).
 *
 * @example
 * // Single-select accordion (only one item open at a time)
 * function FAQ({ items }) {
 *   const { isOpen, toggle } = useAccordion()
 *
 *   return items.map((item, i) => (
 *     <div key={i}>
 *       <button onClick={() => toggle(i)}>{item.question}</button>
 *       {isOpen(i) && <p>{item.answer}</p>}
 *     </div>
 *   ))
 * }
 *
 * @example
 * // Multi-select with first item open
 * const { isOpen, toggle } = useAccordion({
 *   multiple: true,
 *   defaultOpen: [0]
 * })
 *
 * @example
 * // All items open by default
 * const { isOpen, toggle, openAll, closeAll } = useAccordion({
 *   multiple: true,
 *   defaultOpen: 'all',
 *   items: faqItems  // needed when using 'all'
 * })
 */

import { useState, useCallback } from 'react'

/**
 * Hook to manage accordion expand/collapse state.
 *
 * @param {Object} options - Configuration options
 * @param {boolean} [options.multiple=false] - Allow multiple items open at once
 * @param {Array|string} [options.defaultOpen=[]] - Initially open items (indices or 'all')
 * @param {Array} [options.items] - Items array (needed for defaultOpen: 'all')
 * @returns {Object} Accordion state and controls
 */
export function useAccordion(options = {}) {
  const {
    multiple = false,
    defaultOpen = [],
    items = [],
  } = options

  // Compute initial open state
  const getInitialOpen = () => {
    if (defaultOpen === 'all' && items.length > 0) {
      return items.map((_, i) => i)
    }
    if (Array.isArray(defaultOpen)) {
      return defaultOpen
    }
    return []
  }

  const [openItems, setOpenItems] = useState(getInitialOpen)

  /**
   * Check if an item is open
   * @param {number|string} id - Item identifier (index or key)
   * @returns {boolean}
   */
  const isOpen = useCallback((id) => {
    return openItems.includes(id)
  }, [openItems])

  /**
   * Toggle an item open/closed
   * @param {number|string} id - Item identifier
   */
  const toggle = useCallback((id) => {
    setOpenItems(prev => {
      if (prev.includes(id)) {
        // Close this item
        return prev.filter(item => item !== id)
      }
      if (multiple) {
        // Add to open items
        return [...prev, id]
      }
      // Single select: replace open item
      return [id]
    })
  }, [multiple])

  /**
   * Open a specific item
   * @param {number|string} id - Item identifier
   */
  const open = useCallback((id) => {
    setOpenItems(prev => {
      if (prev.includes(id)) return prev
      if (multiple) return [...prev, id]
      return [id]
    })
  }, [multiple])

  /**
   * Close a specific item
   * @param {number|string} id - Item identifier
   */
  const close = useCallback((id) => {
    setOpenItems(prev => prev.filter(item => item !== id))
  }, [])

  /**
   * Open all items (only works in multiple mode)
   * @param {Array} allIds - All item identifiers
   */
  const openAll = useCallback((allIds) => {
    if (multiple && Array.isArray(allIds)) {
      setOpenItems(allIds)
    }
  }, [multiple])

  /**
   * Close all items
   */
  const closeAll = useCallback(() => {
    setOpenItems([])
  }, [])

  return {
    openItems,
    isOpen,
    toggle,
    open,
    close,
    openAll,
    closeAll,
  }
}

export default useAccordion

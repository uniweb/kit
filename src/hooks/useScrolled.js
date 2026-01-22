/**
 * useScrolled Hook
 *
 * Detects scroll position for sticky header effects.
 * Common pattern in Header components across all templates.
 *
 * @example
 * function Header() {
 *   const scrolled = useScrolled()
 *   return (
 *     <header className={scrolled ? 'bg-white shadow' : 'bg-transparent'}>
 *       ...
 *     </header>
 *   )
 * }
 *
 * @example
 * // With custom threshold
 * const scrolled = useScrolled(50) // triggers after 50px scroll
 */

import { useState, useEffect } from 'react'

/**
 * Hook to detect if page has scrolled past a threshold.
 *
 * @param {number} threshold - Scroll position threshold in pixels (default: 0)
 * @returns {boolean} Whether scroll position is past threshold
 */
export function useScrolled(threshold = 0) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > threshold)
    }

    // Check initial state
    handleScroll()

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [threshold])

  return scrolled
}

export default useScrolled

/**
 * useMobileMenu Hook
 *
 * Manages mobile menu state with automatic close on route change.
 * Common pattern in Header/Navbar components across all templates.
 *
 * @example
 * function Header() {
 *   const { isOpen, toggle, close } = useMobileMenu()
 *
 *   return (
 *     <>
 *       <button onClick={toggle}>Menu</button>
 *       {isOpen && (
 *         <nav>
 *           <Link href="/about" onClick={close}>About</Link>
 *         </nav>
 *       )}
 *     </>
 *   )
 * }
 */

import { useState, useEffect, useCallback } from 'react'
import { useActiveRoute } from './useActiveRoute.js'

/**
 * Hook to manage mobile menu state.
 * Automatically closes menu on route change.
 *
 * @returns {Object} Menu state and controls
 * @property {boolean} isOpen - Whether menu is open
 * @property {function} open - Open the menu
 * @property {function} close - Close the menu
 * @property {function} toggle - Toggle menu open/closed
 */
export function useMobileMenu() {
  const [isOpen, setIsOpen] = useState(false)
  const { route } = useActiveRoute()

  // Close menu on route change
  useEffect(() => {
    setIsOpen(false)
  }, [route])

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen(prev => !prev), [])

  return {
    isOpen,
    open,
    close,
    toggle,
  }
}

export default useMobileMenu

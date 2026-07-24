/**
 * Theme Data Hooks
 *
 * Provides access to runtime theme configuration and appearance settings.
 * These hooks are for accessing theme data from the Uniweb runtime.
 *
 * Note: For component styling classes (light/dark/gray themes), use useTheme() instead.
 *
 * @example
 * function ColorPicker() {
 *   const theme = useThemeData()
 *   const colors = theme?.getPaletteNames() || []
 *   return <div>{colors.join(', ')}</div>
 * }
 *
 * @example
 * function DarkModeToggle() {
 *   const { scheme, toggle, canToggle } = useAppearance()
 *   if (!canToggle) return null
 *   return <button onClick={toggle}>{scheme === 'dark' ? '☀️' : '🌙'}</button>
 * }
 */

import { useState, useEffect, useCallback } from 'react'
import { getUniweb, Theme } from '@uniweb/core'

// Storage key for appearance preference
const APPEARANCE_STORAGE_KEY = 'uniweb-appearance'

// CSS classes for the two schemes
const DARK_SCHEME_CLASS = 'scheme-dark'
const LIGHT_SCHEME_CLASS = 'scheme-light'

/**
 * Read the scheme currently applied to the document.
 *
 * The runtime resolves and applies the boot scheme before React renders (see
 * @uniweb/runtime's appearance.js), so this hook reads that result rather than
 * re-deriving it from config + localStorage. One resolver, one boot-time writer.
 *
 * Deriving it independently here is what used to break: the runtime and this
 * hook each applied their own answer, and the runtime's — which ignored the
 * stored preference — won, because React runs child effects before parent ones.
 *
 * @returns {string} 'light' or 'dark'
 */
function readAppliedScheme() {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.classList.contains(DARK_SCHEME_CLASS) ? 'dark' : 'light'
}

/**
 * Access the full Theme object from the active website.
 *
 * Returns the Theme instance which provides methods like:
 * - getColor(name, shade) - Get a color value
 * - getPalette(name) - Get all shades for a color
 * - getContextToken(context, token) - Get semantic token
 * - getAppearance() - Get appearance configuration
 *
 * @returns {Theme|null} Theme instance or null if not available
 *
 * @example
 * const theme = useThemeData()
 * const primaryColor = theme?.getColor('primary', 500)
 */
export function useThemeData() {
  const uniweb = getUniweb()
  const website = uniweb?.activeWebsite
  const themeData = website?.themeData

  if (!themeData) {
    return null
  }

  // Return a Theme instance if we have theme data
  // The website may already have a Theme instance, or we create one
  if (website.theme instanceof Theme) {
    return website.theme
  }

  // Create a new Theme instance from themeData
  return new Theme(themeData)
}

/**
 * Get the current section's color context.
 *
 * Note: This requires the component to receive the block prop.
 * For components that don't have block access, use a default or pass context explicitly.
 *
 * @param {Object} block - Block instance (optional)
 * @returns {string} Context name ('light', 'medium', or 'dark')
 *
 * @example
 * function MyComponent({ block }) {
 *   const context = useColorContext(block)
 *   return <div className={`context-${context}`}>...</div>
 * }
 */
export function useColorContext(block) {
  // Get context from block's theme property
  const context = block?.themeName || block?.theme || 'light'

  // Validate context name
  const validContexts = ['light', 'medium', 'dark']
  if (validContexts.includes(context)) {
    return context
  }

  return 'light'
}

/**
 * Check and toggle site-wide appearance scheme (light/dark mode).
 *
 * This hook manages the site's color scheme preference and provides
 * utilities for toggling between light and dark modes.
 *
 * @returns {Object} Appearance utilities
 * @property {string} scheme - Current scheme ('light' or 'dark')
 * @property {Function} setScheme - Set scheme explicitly
 * @property {Function} toggle - Toggle between light and dark
 * @property {boolean} canToggle - Whether toggling is enabled
 * @property {string[]} schemes - Available schemes
 *
 * @example
 * function DarkModeToggle() {
 *   const { scheme, toggle, canToggle } = useAppearance()
 *
 *   if (!canToggle) return null
 *
 *   return (
 *     <button onClick={toggle}>
 *       {scheme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
 *     </button>
 *   )
 * }
 */
export function useAppearance() {
  const theme = useThemeData()
  const appearance = theme?.getAppearance() || { default: 'light', allowToggle: false }

  const [scheme, setSchemeState] = useState(readAppliedScheme)

  // Apply scheme to document.
  //
  // Sets an explicit class both ways rather than relying on the absence of one:
  // `default: 'system'` themes generate a `@media (prefers-color-scheme: dark)`
  // block scoped to `:root:not(.scheme-light)`, so forcing light on a dark OS
  // needs `scheme-light` present — removing `scheme-dark` alone would leave the
  // media query still applying dark tokens.
  const applyScheme = useCallback((newScheme) => {
    if (typeof document === 'undefined') return

    const root = document.documentElement
    if (newScheme === 'dark') {
      root.classList.add(DARK_SCHEME_CLASS)
      root.classList.remove(LIGHT_SCHEME_CLASS)
    } else {
      root.classList.add(LIGHT_SCHEME_CLASS)
      root.classList.remove(DARK_SCHEME_CLASS)
    }
  }, [])

  // Set scheme with persistence and DOM update
  const setScheme = useCallback((newScheme) => {
    if (newScheme !== 'light' && newScheme !== 'dark') {
      console.warn(`[useAppearance] Invalid scheme: ${newScheme}. Use 'light' or 'dark'.`)
      return
    }

    setSchemeState(newScheme)
    applyScheme(newScheme)

    // Persist to localStorage
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(APPEARANCE_STORAGE_KEY, newScheme)
    }
  }, [applyScheme])

  // Toggle between light and dark
  const toggle = useCallback(() => {
    const newScheme = scheme === 'light' ? 'dark' : 'light'
    setScheme(newScheme)
  }, [scheme, setScheme])

  // No mount effect applying the initial scheme: the runtime already applied it
  // before React rendered, and `scheme` was read back from that. Re-applying
  // here is what made this hook a second writer.

  // Listen for system preference changes
  useEffect(() => {
    if (!appearance.respectSystemPreference || typeof window === 'undefined') {
      return
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const handleChange = (e) => {
      // Only auto-switch if the visitor hasn't manually set a preference
      let stored = null
      try {
        stored = localStorage.getItem(APPEARANCE_STORAGE_KEY)
      } catch {
        // Safari private mode throws on access — treat as "no preference"
      }
      if (stored) return

      const newScheme = e.matches ? 'dark' : 'light'
      if (!appearance.schemes?.includes(newScheme)) return

      // Track the OS without persisting. Going through setScheme() would write
      // to localStorage, which reads back as a manual preference and stops this
      // listener from ever following the OS again.
      setSchemeState(newScheme)
      applyScheme(newScheme)
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [appearance.respectSystemPreference, appearance.schemes, applyScheme])

  return {
    scheme,
    setScheme,
    toggle,
    canToggle: appearance.allowToggle === true,
    schemes: appearance.schemes || ['light'],
  }
}

/**
 * Get a specific color from the theme.
 * Convenience hook that combines useThemeData with getColor.
 *
 * @param {string} name - Color name (e.g., 'primary', 'neutral')
 * @param {number} shade - Shade level (50-950), defaults to 500
 * @returns {string|null} Color value or null
 *
 * @example
 * const primaryColor = useThemeColor('primary', 600)
 */
export function useThemeColor(name, shade = 500) {
  const theme = useThemeData()
  return theme?.getColor(name, shade) || null
}

/**
 * Get CSS variable reference for a color.
 * Useful for inline styles that reference theme colors.
 *
 * @param {string} name - Color name
 * @param {number} shade - Shade level
 * @returns {string} CSS var() reference
 *
 * @example
 * const style = { color: useThemeColorVar('primary', 600) }
 * // Returns: 'var(--primary-600)'
 */
export function useThemeColorVar(name, shade = 500) {
  return `var(--${name}-${shade})`
}

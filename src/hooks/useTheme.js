/**
 * useTheme Hook
 *
 * Provides standardized theme classes for components.
 * Eliminates duplicated theme objects across 25+ components.
 *
 * @example
 * function Hero({ params }) {
 *   const t = useTheme(params.theme)
 *
 *   return (
 *     <section className={t.section}>
 *       <h1 className={t.title}>...</h1>
 *       <p className={t.body}>...</p>
 *     </section>
 *   )
 * }
 *
 * @example
 * // With custom overrides
 * const t = useTheme('dark', {
 *   card: 'bg-gray-800 rounded-xl',
 *   cardHover: 'hover:bg-gray-700'
 * })
 */

/**
 * Standard theme definitions.
 * Keys are standardized across all components.
 */
const THEMES = {
  light: {
    // Section backgrounds
    section: 'bg-white',
    sectionAlt: 'bg-gray-50',

    // Typography
    title: 'text-gray-900',
    subtitle: 'text-gray-700',
    pretitle: 'text-primary',
    body: 'text-gray-600',
    muted: 'text-gray-500',

    // Cards
    card: 'bg-gray-50',
    cardHover: 'hover:shadow-lg',
    cardBorder: 'border border-gray-200',

    // Interactive
    link: 'text-primary hover:text-primary-dark',
    linkMuted: 'text-gray-600 hover:text-gray-900',

    // Borders & Dividers
    border: 'border-gray-200',
    divider: 'bg-gray-200',
  },

  gray: {
    section: 'bg-gray-50',
    sectionAlt: 'bg-gray-100',

    title: 'text-gray-900',
    subtitle: 'text-gray-700',
    pretitle: 'text-primary',
    body: 'text-gray-600',
    muted: 'text-gray-500',

    card: 'bg-white shadow-sm',
    cardHover: 'hover:shadow-lg',
    cardBorder: 'border border-gray-200',

    link: 'text-primary hover:text-primary-dark',
    linkMuted: 'text-gray-600 hover:text-gray-900',

    border: 'border-gray-200',
    divider: 'bg-gray-300',
  },

  dark: {
    section: 'bg-gray-900',
    sectionAlt: 'bg-gray-800',

    title: 'text-white',
    subtitle: 'text-gray-300',
    pretitle: 'text-primary',
    body: 'text-gray-400',
    muted: 'text-gray-500',

    card: 'bg-gray-800',
    cardHover: 'hover:bg-gray-750',
    cardBorder: 'border border-gray-700',

    link: 'text-primary hover:text-primary-light',
    linkMuted: 'text-gray-400 hover:text-white',

    border: 'border-gray-700',
    divider: 'bg-gray-700',
  },

  primary: {
    section: 'bg-primary',
    sectionAlt: 'bg-primary-dark',

    title: 'text-white',
    subtitle: 'text-white/90',
    pretitle: 'text-white/80',
    body: 'text-white/80',
    muted: 'text-white/60',

    card: 'bg-white/10',
    cardHover: 'hover:bg-white/20',
    cardBorder: 'border border-white/20',

    link: 'text-white hover:text-white/80',
    linkMuted: 'text-white/70 hover:text-white',

    border: 'border-white/20',
    divider: 'bg-white/20',
  },

  gradient: {
    section: 'bg-gradient-to-br from-primary to-indigo-600',
    sectionAlt: 'bg-gradient-to-br from-primary-dark to-indigo-700',

    title: 'text-white',
    subtitle: 'text-white/90',
    pretitle: 'text-white/80',
    body: 'text-white/80',
    muted: 'text-white/60',

    card: 'bg-white/10 backdrop-blur-sm',
    cardHover: 'hover:bg-white/20',
    cardBorder: 'border border-white/20',

    link: 'text-white hover:text-white/80',
    linkMuted: 'text-white/70 hover:text-white',

    border: 'border-white/20',
    divider: 'bg-white/20',
  },

  glass: {
    section: 'bg-white/10 backdrop-blur-lg',
    sectionAlt: 'bg-white/5 backdrop-blur-lg',

    title: 'text-white',
    subtitle: 'text-white/90',
    pretitle: 'text-primary',
    body: 'text-white/80',
    muted: 'text-white/60',

    card: 'bg-white/10 backdrop-blur-sm',
    cardHover: 'hover:bg-white/20',
    cardBorder: 'border border-white/20',

    link: 'text-white hover:text-primary',
    linkMuted: 'text-white/70 hover:text-white',

    border: 'border-white/20',
    divider: 'bg-white/20',
  },
}

/**
 * Hook to get theme classes by name.
 *
 * @param {string} themeName - Theme name (light, gray, dark, primary, gradient, glass)
 * @param {Object} overrides - Custom class overrides
 * @returns {Object} Theme classes object
 */
export function useTheme(themeName = 'light', overrides = {}) {
  const baseTheme = THEMES[themeName] || THEMES.light

  if (Object.keys(overrides).length === 0) {
    return baseTheme
  }

  return {
    ...baseTheme,
    ...overrides,
  }
}

/**
 * Get theme classes without the hook (for non-React contexts)
 * @param {string} themeName
 * @param {Object} overrides
 * @returns {Object}
 */
export function getThemeClasses(themeName = 'light', overrides = {}) {
  const baseTheme = THEMES[themeName] || THEMES.light
  return { ...baseTheme, ...overrides }
}

/**
 * All available theme names
 */
export const THEME_NAMES = Object.keys(THEMES)

/**
 * Export theme definitions for customization
 */
export { THEMES }

export default useTheme

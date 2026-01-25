/**
 * @uniweb/kit
 *
 * Standard component library for Uniweb foundations.
 *
 * For pre-styled components (Section, SidebarLayout, Disclaimer, etc.),
 * import from '@uniweb/kit/styled'.
 *
 * @example
 * import { Link, Image, useWebsite } from '@uniweb/kit'
 *
 * function MyComponent() {
 *   const { localize } = useWebsite()
 *   return (
 *     <Link to="/about">
 *       <Image src="/logo.png" alt="Logo" />
 *       {localize({ en: 'About', fr: 'À propos' })}
 *     </Link>
 *   )
 * }
 */

// ============================================================================
// Components (Primitives - no Tailwind dependency)
// ============================================================================

// Navigation
export { Link } from './components/Link/index.js'
export { Image } from './components/Image/index.js'
export { SafeHtml } from './components/SafeHtml/index.js'
export { Icon } from './components/Icon/index.js'

// Typography
export {
  Text,
  H1, H2, H3, H4, H5, H6,
  P, Span, Div,
  PlainText
} from './components/Text/index.js'

// Media (plain version - for styled facade, use @uniweb/kit/tailwind)
export { Media } from './components/Media/index.js'
export { FileLogo } from './components/FileLogo/index.js'
export { MediaIcon } from './components/MediaIcon/index.js'

// Files (plain version - for styled card, use @uniweb/kit/tailwind)
export { Asset } from './components/Asset/index.js'

// Social
export {
  SocialIcon,
  getSocialPlatform,
  isSocialLink,
  filterSocialLinks
} from './components/SocialIcon/index.jsx'

// ============================================================================
// Hooks
// ============================================================================

export {
  useWebsite,
  useRouting,
  useActiveRoute,
  useScrolled,
  useMobileMenu,
  useAccordion,
  useGridLayout,
  getGridClasses,
  useTheme,
  getThemeClasses,
  THEMES,
  THEME_NAMES,
  // Theme data hooks (runtime theme access)
  useThemeData,
  useColorContext,
  useAppearance,
  useThemeColor,
  useThemeColorVar
} from './hooks/index.js'

// ============================================================================
// Utilities
// ============================================================================

export {
  cn,
  twMerge,
  twJoin,
  stripTags,
  isExternalUrl,
  isFileUrl,
  detectMediaType
} from './utils/index.js'

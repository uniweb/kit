/**
 * @uniweb/kit
 *
 * Standard component library for Uniweb foundations.
 * All components, hooks, and utilities are exported from this single entry point.
 *
 * @example
 * import { Link, Image, Section, Render, useWebsite, cn } from '@uniweb/kit'
 */

// ============================================================================
// Components (Primitives)
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

// Media
export { Media } from './components/Media/index.js'
export { FileLogo } from './components/FileLogo/index.js'
export { MediaIcon } from './components/MediaIcon/index.js'

// Files
export { Asset } from './components/Asset/index.js'

// Data loading
export { DataPlaceholder } from './components/DataPlaceholder.jsx'

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
  useVersion,
  useScrolled,
  useMobileMenu,
  useAccordion,
  useGridLayout,
  getGridClasses,
  useTheme,
  getThemeClasses,
  THEMES,
  THEME_NAMES,
  // Viewport detection
  useInView,
  useIsInView,
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
  detectMediaType,
  parseIconRef,
  // Runtime utilities
  getChildBlockRenderer,
  // Locale utilities
  LOCALE_DISPLAY_NAMES,
  getLocaleLabel
} from './utils/index.js'

// ============================================================================
// Styled Components (Tailwind-based)
// ============================================================================

export { SidebarLayout } from './styled/SidebarLayout/index.js'
export { Section, Render } from './styled/Section/index.js'
export { Prose } from './styled/Prose/index.jsx'
export { Article } from './styled/Article/index.jsx'
export { Code, Alert, Warning, Table, Details, Divider } from './styled/Section/renderers/index.js'
export { Disclaimer } from './styled/Disclaimer/index.js'
export { Visual } from './styled/Visual/index.jsx'

// ============================================================================
// Search
// ============================================================================

export { createSearchClient, loadSearchIndex, clearSearchCache } from './search/client.js'
export { buildSnippet, highlightMatches, escapeHtml } from './search/snippets.js'
export { useSearch, useSearchIndex, useSearchShortcut, useSearchWithIntent } from './search/hooks.js'

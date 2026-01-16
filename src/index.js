/**
 * @uniweb/kit
 *
 * Standard component library for Uniweb foundations.
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
// Components
// ============================================================================

// Primitives
export { Link } from './components/Link/index.js'
export { Image } from './components/Image/index.js'
export { SafeHtml } from './components/SafeHtml/index.js'
export { Icon } from './components/Icon/index.js'

// Media
export { Media } from './components/Media/index.js'
export { FileLogo } from './components/FileLogo/index.js'
export { MediaIcon } from './components/MediaIcon/index.js'

// Content
export { Section, Render } from './components/Section/index.js'
export { Code, Alert, Warning, Table, Details, Divider } from './components/Section/renderers/index.js'

// Utilities
export { Asset } from './components/Asset/index.js'
export { Disclaimer } from './components/Disclaimer/index.js'

// ============================================================================
// Hooks
// ============================================================================

export { useWebsite } from './hooks/index.js'

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

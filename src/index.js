/**
 * @uniweb/kit
 *
 * Standard component library for Uniweb foundations.
 *
 * @example
 * import { Link, useWebsite } from '@uniweb/kit'
 *
 * function MyComponent() {
 *   const { localize } = useWebsite()
 *   return <Link to="/about">{localize({ en: 'About', fr: 'À propos' })}</Link>
 * }
 */

// Components
export { Link } from './components/Link/index.js'

// Hooks
export { useWebsite } from './hooks/index.js'

// Utilities
export {
  cn,
  twMerge,
  twJoin,
  stripTags,
  isExternalUrl,
  isFileUrl,
  detectMediaType
} from './utils/index.js'

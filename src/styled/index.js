/**
 * @uniweb/kit/styled
 *
 * Pre-styled components from the kit.
 *
 * These components come with built-in styling (using Tailwind CSS).
 * For unstyled primitives, use the main '@uniweb/kit' export.
 *
 * @example
 * import { SidebarLayout, Section, Media } from '@uniweb/kit/styled'
 */

// ============================================================================
// Layout
// ============================================================================

export { SidebarLayout } from './SidebarLayout/index.js'

// ============================================================================
// Content Rendering
// ============================================================================

// Section - Rich content section layout container
export { Section, Render } from './Section/index.js'

// Prose - Typography wrapper for long-form content
export { Prose } from './Prose/index.jsx'

// Article - Semantic article with prose typography
export { Article } from './Article/index.jsx'

// Renderers - Individual content type renderers
export { Code, Alert, Warning, Table, Details, Divider } from './Section/renderers/index.js'

// ============================================================================
// UI Components
// ============================================================================

// Disclaimer - Modal dialog for legal disclaimers
export { Disclaimer } from './Disclaimer/index.js'

// Media - Video player with styled play button facade
export { Media } from './Media/index.js'

// Asset - File download card with preview and hover overlay
export { Asset } from './Asset/index.js'

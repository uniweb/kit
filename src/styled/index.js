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

// Section - Rich content section renderer
export { Section, Render } from './Section/index.js'

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

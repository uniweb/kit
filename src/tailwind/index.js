/**
 * @uniweb/kit/tailwind
 *
 * Tailwind CSS-styled components from the kit.
 *
 * IMPORTANT: These components use Tailwind classes. For Tailwind v4 projects,
 * add this path to your @source directive in styles.css:
 *
 * @example
 * // foundation/src/styles.css
 * @import "tailwindcss";
 * @source "./components/**\/*.jsx";
 * @source "../node_modules/@uniweb/kit/src/tailwind/**\/*.jsx";
 *
 * @example
 * // Usage
 * import { SidebarLayout, Section } from '@uniweb/kit/tailwind'
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

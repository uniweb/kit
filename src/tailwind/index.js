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
 * import { SidebarLayout } from '@uniweb/kit/tailwind'
 *
 * export default {
 *   Layout: SidebarLayout,
 * }
 */

// Layout components
export { SidebarLayout } from '../components/SidebarLayout/index.js'

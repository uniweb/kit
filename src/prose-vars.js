/**
 * The prose layer's variables, declared as foundation vars — so a site's
 * theme.yml can set them under `vars:`, and an editor reading the foundation's
 * schema can offer them, described:
 *
 *   // main.js
 *   import { proseVars } from '@uniweb/kit/prose-vars'
 *
 *   export const vars = {
 *     ...proseVars,
 *     'header-height': { default: '4rem', description: 'Fixed header height' },
 *   }
 *
 * `@uniweb/kit/prose-tokens.css` reads every one of them; a site may set them
 * whether or not the foundation declares them, and declaring them is what makes
 * them discoverable.
 *
 * Only three carry a default. The others take each size step's own value
 * (`prose-sm` … `prose-2xl`) until a site sets them, so they declare none: a
 * default is written on `:root`, and would flatten every step to it.
 *
 * Plain JavaScript with no imports, on purpose: the build imports `main.js` in
 * Node to read its declarations, so what it imports must load there.
 *
 * @module @uniweb/kit/prose-vars
 */
export const proseVars = {
  'prose-size': {
    default: '1rem',
    description: 'Reading size of long-form text at the base step; the other steps are ratios of it',
  },
  'prose-leading': {
    description: 'Line height of long-form text, at every step. Unset, each step uses its own',
  },
  'prose-measure': {
    default: '65ch',
    description: 'Line length of long-form text',
  },
  'prose-flow': {
    description: 'Space between paragraphs and lists, in em. Unset, each step uses its own',
  },
  'prose-h1': {
    description: 'Size of a first-level heading in long-form text, relative to the text. Unset, each step uses its own',
  },
  'prose-h2': {
    description: 'Size of a second-level heading in long-form text, relative to the text. Unset, each step uses its own',
  },
  'prose-h3': {
    description: 'Size of a third-level heading in long-form text, relative to the text. Unset, each step uses its own',
  },
  'prose-h4': {
    default: '1em',
    description: 'Size of a fourth-level heading in long-form text, relative to the text',
  },
}

export default proseVars

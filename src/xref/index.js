/**
 * @uniweb/kit/xref — cross-reference machinery for foundations that
 * support `[#id]` markdown markers.
 *
 * Foundations using cross-references (academic, documentation, long-form)
 * import:
 *   - `Ref` to register in `defaultInsets` so content-reader's
 *     `inset_ref { component: 'Ref' }` markers resolve.
 *   - `buildXrefRegistry` if they want to trigger registry construction
 *     manually (the runtime does it automatically when foundation
 *     declares `xref:`).
 *   - `getXrefRegistry` to read the registry from list sections (e.g.
 *     ListOfFigures).
 *
 * Foundations that do NOT use cross-references never import this
 * subpath; kit's tree-shaking strips the entire xref module from their
 * bundle.
 */

export { buildXrefRegistry, getXrefRegistry } from './registry.js'
export {
    XREF_STYLES,
    DEFAULT_XREF_STYLE,
    resolveXrefStyle,
    getKindMeta,
} from './styles.js'
export { Ref, default as RefDefault } from './Ref.jsx'

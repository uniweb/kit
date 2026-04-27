/**
 * Cross-reference registry — per-website lookup table from `{#id}` to
 * counter / kind / metadata.
 *
 * The walker visits the parsed document tree (siteContent.pages[].
 * sections[].content) once, finds every block-level element carrying a
 * `{#id}` attribute, infers the element's kind from its node type, and
 * records the entry with a per-kind counter. The registry is consumed
 * by:
 *   - The framework's <Ref> component to render `[#id]` cross-references
 *     as "Figure 3" / "§3.2" / etc.
 *   - List sections (foundation-side: ListOfFigures / ListOfTables /
 *     TableOfContents) to enumerate captioned figures/tables/headings.
 *   - Press LaTeX adapters' \autoref helpers to filter unresolved ids.
 *
 * Built-in kinds:
 *   - heading      → 'section'   (hierarchical: 1, 1.1, 1.1.1, 2, …)
 *   - image        → 'figure'    (flat arabic counter)
 *   - math_display → 'equation'  (flat arabic counter)
 *   - table        → 'table'     (flat arabic counter)
 *
 * Foundation extensions: foundations that need additional kinds (e.g.
 * theorem, lemma, definition for an academic foundation) declare them
 * via `foundation.xref.kinds`. The id-collection pass uses each kind's
 * `prefix` field (e.g. `thm` → `theorem`) to classify ids that don't
 * land on a built-in element type.
 *
 * Storage: a WeakMap keyed by Website. The registry is NOT attached as
 * a property on the Website object — keeping the persistent vanilla-JS
 * object graph free of feature-specific properties is a deliberate
 * Uniweb convention. Same pattern as cite-registry.js (book foundation)
 * and Press's DocumentProvider registration store.
 *
 * Lifecycle: built once per website at runtime initialization (see
 * runtime/src/setup.js / ssr-renderer.js's initPrerender — they detect
 * `foundation.xref` and trigger the build). Consumers read it via
 * `getXrefRegistry(website)`. When the website becomes unreachable
 * (page navigation, editor preview swap), the WeakMap entry is GC-
 * eligible automatically.
 *
 * Output shape per entry:
 *   {
 *     id,            // the id itself
 *     kind,          // 'figure' | 'equation' | 'section' | 'table' | <foundation-declared>
 *     counter,       // number for flat kinds, dotted string for hierarchical
 *     counterText,   // displayable counter ('3', '3.2')
 *     sourcePath,    // page route the id was declared on (for back-refs)
 *     caption,       // (figures, tables) caption attr, when set
 *     text,          // (sections) heading's plain text content
 *     latex,         // (equations) latex source for the equation
 *   }
 *
 * `caption`, `text`, and `latex` are populated only for the elements
 * that carry them — undefined on other kinds.
 */

const KIND_BY_TYPE = {
    heading: 'section',
    image: 'figure',
    math_display: 'equation',
    table: 'table',
}

/**
 * Per-website registry storage. Keyed by the Website instance (or any
 * object — the WeakMap doesn't enforce a type). Entries are GC-eligible
 * once the website becomes unreachable.
 */
const REGISTRIES = new WeakMap()

/**
 * Walk the website's parsed content tree to build the registry. Stores
 * the result keyed by the website instance.
 *
 * @param {Object} website - The Website instance the registry belongs
 *   to. Used as the WeakMap key. Should expose its parsed content
 *   either at `website.rawContent` or `website.siteContent` depending
 *   on how the runtime exposes it; the walker accepts both.
 * @param {Object} [options]
 * @param {Object} [options.foundationKinds] - Map of kind → metadata
 *   the foundation declared via `foundation.xref.kinds`. Drives id-
 *   prefix classification for non-built-in kinds (e.g. thm-foo →
 *   theorem) and is referenced when an explicit `kind` attribute on a
 *   node points at a foundation-declared kind.
 * @param {Function} [options.onWarn] - Per-warning callback. Default
 *   logs to console.
 * @returns {{entries: Object}} The built registry.
 */
export function buildXrefRegistry(website, options = {}) {
    const { foundationKinds = {}, onWarn = (msg) => console.warn(msg) } = options

    const entries = {}
    const flatCounters = {}
    const sectionStack = []

    const prefixToKind = {}
    for (const [kind, meta] of Object.entries(foundationKinds)) {
        if (meta?.prefix) prefixToKind[meta.prefix] = kind
    }

    function nextFlat(kind) {
        flatCounters[kind] = (flatCounters[kind] || 0) + 1
        return flatCounters[kind]
    }

    let topLevel = null

    function nextHierarchical(level) {
        if (topLevel == null || level < topLevel) topLevel = level
        const depth = level - topLevel + 1
        while (sectionStack.length >= depth) sectionStack.pop()
        while (sectionStack.length < depth - 1) sectionStack.push(1)
        sectionStack.push((sectionStack[depth - 1] || 0) + 1)
        sectionStack.length = depth
        return sectionStack.slice().join('.')
    }

    function collectTextContent(node) {
        if (!node || typeof node !== 'object') return ''
        if (node.type === 'text' && typeof node.text === 'string') return node.text
        if (Array.isArray(node.content)) {
            return node.content.map(collectTextContent).join('')
        }
        return ''
    }

    function inferKind(node) {
        const builtin = KIND_BY_TYPE[node.type]
        if (builtin) return builtin
        if (node.attrs?.kind && (KIND_BY_TYPE[node.attrs.kind] || foundationKinds[node.attrs.kind])) {
            return node.attrs.kind
        }
        const id = node.attrs?.id
        if (id && id.includes('-')) {
            const prefix = id.slice(0, id.indexOf('-'))
            if (prefixToKind[prefix]) return prefixToKind[prefix]
        }
        return null
    }

    function visit(node, sourcePath) {
        if (!node || typeof node !== 'object') return

        let counter = null
        let counterText = null
        if (node.type === 'heading') {
            const level = Math.max(1, Math.min(6, node.attrs?.level || 1))
            counterText = nextHierarchical(level)
            counter = counterText
        }

        const id = node.attrs?.id
        if (id) {
            const kind = inferKind(node)
            if (!kind) {
                onWarn(`[xref] {#${id}} on unrecognized element type "${node.type}" — ignored`)
            } else if (entries[id]) {
                onWarn(`[xref] duplicate id "${id}" — keeping first registration`)
            } else {
                if (counter == null) {
                    counter = nextFlat(kind)
                    counterText = String(counter)
                }
                const entry = { id, kind, counter, counterText, sourcePath: sourcePath || '' }
                const captionAttr = node.attrs?.caption
                if (kind === 'figure' || kind === 'table') {
                    if (captionAttr) entry.caption = String(captionAttr)
                }
                if (node.type === 'heading') {
                    const text = collectTextContent(node)
                    if (text) entry.text = text
                }
                if (node.type === 'math_display') {
                    const latex = node.attrs?.latex
                    if (latex) entry.latex = String(latex)
                }
                entries[id] = entry
            }
        }
        // Heading without an id still advances the hierarchical counter
        // — counter computed above; just no entry registered.

        if (Array.isArray(node.content)) {
            for (const child of node.content) visit(child, sourcePath)
        }
    }

    // Iterate the Website object graph: pages → bodyBlocks → rawContent.
    // Each Block's rawContent is a ProseMirror doc; the registry walker
    // visits its block-level children to find {#id} attributes.
    for (const page of website?.pages || []) {
        for (const block of page.bodyBlocks || []) {
            const content = block.rawContent
            if (content?.type === 'doc' && Array.isArray(content.content)) {
                for (const child of content.content) visit(child, page.route)
            }
        }
    }

    const registry = { entries }
    if (website && typeof website === 'object') {
        REGISTRIES.set(website, registry)
    }
    return registry
}

/**
 * Read the registry previously built for a website. Returns null if no
 * registry was built (e.g. the foundation didn't declare `xref` so
 * runtime initialization didn't trigger `buildXrefRegistry`).
 *
 * Consumers (Ref renderer, ListOfFigures section, press LaTeX inset
 * formatters) handle the null case gracefully — typically by treating
 * it as an empty entries map, which renders cross-refs as "[?<id>]"
 * placeholders.
 */
export function getXrefRegistry(website) {
    if (!website || typeof website !== 'object') return null
    return REGISTRIES.get(website) || null
}

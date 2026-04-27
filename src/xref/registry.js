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
 *   - math         → 'equation'  (flat arabic counter; display:true only)
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
    math: 'equation',
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

    function inferKind(el) {
        // Built-in: element type matches a registered kind.
        const builtin = KIND_BY_TYPE[el.type]
        if (builtin) return builtin
        // Explicit kind attribute on the element.
        if (el.attrs?.kind && (KIND_BY_TYPE[el.attrs.kind] || foundationKinds[el.attrs.kind])) {
            return el.attrs.kind
        }
        // Foundation-declared prefix on the id.
        const id = readId(el)
        if (id && id.includes('-')) {
            const prefix = id.slice(0, id.indexOf('-'))
            if (prefixToKind[prefix]) return prefixToKind[prefix]
        }
        return null
    }

    // Sequence elements expose `id` differently per element type. Most
    // (heading, image, table) carry it under `attrs`; math promotes it
    // to a top-level field (per @uniweb/semantic-parser's sequence
    // builder). Read both.
    function readId(el) {
        return el.attrs?.id ?? el.id ?? null
    }

    function visit(el, sourcePath) {
        let counter = null
        let counterText = null
        if (el.type === 'heading') {
            const level = Math.max(1, Math.min(6, el.level || el.attrs?.level || 1))
            counterText = nextHierarchical(level)
            counter = counterText
        }

        const id = readId(el)
        if (!id) return

        const kind = inferKind(el)
        if (!kind) {
            onWarn(`[xref] {#${id}} on unrecognized element type "${el.type}" — ignored`)
            return
        }
        if (entries[id]) {
            onWarn(`[xref] duplicate id "${id}" — keeping first registration`)
            return
        }
        if (counter == null) {
            counter = nextFlat(kind)
            counterText = String(counter)
        }
        const entry = { id, kind, counter, counterText, sourcePath: sourcePath || '' }
        const caption = el.attrs?.caption
        if ((kind === 'figure' || kind === 'table') && caption) {
            entry.caption = String(caption)
        }
        if (el.type === 'heading' && el.text) {
            entry.text = String(el.text)
        }
        if (el.type === 'math' && el.latex) {
            entry.latex = String(el.latex)
        }
        entries[id] = entry
    }

    // Walk the Website's object graph: pages → bodyBlocks. Each Block's
    // `parsedContent.sequence` is a flat document-order array of
    // semantic elements (heading, paragraph, image, list, blockquote,
    // codeBlock, table, math, divider, …). Iterating the sequence is
    // enough — the registry's id-bearing kinds (heading, image,
    // math (display:true), table) all live at sequence level.
    //
    // Website.pages, Page.bodyBlocks, and Block.parsedContent.sequence
    // are framework invariants — always arrays. No defensive guards.
    for (const page of website.pages) {
        for (const block of page.bodyBlocks) {
            for (const el of block.parsedContent.sequence) {
                visit(el, page.route)
            }
        }
    }

    const registry = { entries }
    REGISTRIES.set(website, registry)
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

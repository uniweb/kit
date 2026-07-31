/**
 * Cross-reference renderer.
 *
 * Foundations that want `[#id]` cross-reference rendering import this
 * component from `@uniweb/kit/xref` and register it in their
 * foundation.js's `defaultInsets` map:
 *
 *   import { Ref } from '@uniweb/kit/xref'
 *   export default {
 *     defaultInsets: { Ref },
 *     xref: { kinds: { ... } },
 *     // ...
 *   }
 *
 * Content-reader compiles `[#id]` markdown markers to
 * `inset_ref { component: 'Ref', key: <id> }` regardless of foundation
 * choice; the runtime's inset resolver looks up the component name in
 * the foundation's defaultInsets to find this renderer.
 *
 * Resolution flow at render time:
 *   1. Read `getXrefRegistry(block.website)` — the per-document
 *      registry the runtime populated from `{#id}` attributes when the
 *      foundation declared `xref:`.
 *   2. Pick the active xref-style preset (foundation default + document
 *      override) and the kind metadata for the registered entry.
 *   3. Render via the style's label + counter + locator.
 *
 * Multi-ref clusters (`[#a;#b]`) split on `;` and render same-kind
 * groups using the style's `labelPlural`. Mixed-kind clusters fall
 * back to comma-separated singular rendering with a console warning.
 *
 * Missing ids render `[?<id-with-typo>]` so the failing key is visible
 * in the output — easier to debug than the bare `[?]` we use for
 * missing cite keys.
 */

import React from 'react'
import { getXrefRegistry } from './registry.js'
import { resolveXrefStyle, getKindMeta } from './styles.js'

function splitKeys(raw) {
    return String(raw || '')
        .split(';')
        .map((k) => k.trim().replace(/^#/, ''))
        .filter(Boolean)
}

function formatLocator(params) {
    const { page, locator, label = 'page' } = params || {}
    const value = page || locator
    if (!value) return ''
    const labels = {
        page: 'p.',
        chapter: 'chap.',
        section: '§',
        paragraph: '¶',
    }
    const lab = labels[label] || `${label}.`
    return ` (${lab} ${value})`
}

function renderEntry(entry, kindMeta) {
    const label = kindMeta?.label || ''
    const sep = kindMeta?.sep ?? ' '
    const counter = entry.counterText
    return label ? `${label}${sep}${counter}` : counter
}

/** A counter as a link to the element it numbers. */
function counterLink(entry) {
    return (
        <a key={entry.id} href={`#${entry.id}`}>
            {entry.counterText}
        </a>
    )
}

/**
 * Prose list punctuation: "1", "1 and 2", "1, 2, and 3".
 *
 * Takes and returns nodes rather than strings so each counter can be its own
 * link. A cluster's LABEL is deliberately left outside them — "Figures" covers
 * the whole group, and there is no single target it could point at.
 */
function joinProse(nodes) {
    if (nodes.length <= 1) return nodes
    if (nodes.length === 2) return [nodes[0], ' and ', nodes[1]]
    const out = []
    nodes.forEach((node, i) => {
        if (i > 0) out.push(i === nodes.length - 1 ? ', and ' : ', ')
        out.push(node)
    })
    return out
}

function renderGroupSameKind(entries, kindMeta) {
    const plural = entries.length > 1
    const label = (plural ? kindMeta?.labelPlural || kindMeta?.label : kindMeta?.label) || ''
    const sep = kindMeta?.sep ?? ' '
    const body = joinProse(entries.map(counterLink))
    return label ? [label, sep, ...body] : body
}

export function Ref({ params, block }) {
    const website = block?.website
    const registry = getXrefRegistry(website)
    const entries = registry?.entries || {}
    const styleName = website?.config?.book?.xrefStyle || 'humanities'
    const style = resolveXrefStyle(styleName, website?.config)

    const ids = splitKeys(params?.key)
    if (ids.length === 0) {
        return <span className="xref xref--missing" title="No id">[?]</span>
    }

    const resolved = ids.map((id) => {
        const entry = entries[id]
        return entry ? { id, entry, kindMeta: getKindMeta(style, entry.kind) } : { id, missing: true }
    })

    if (resolved.length === 1 && resolved[0].missing) {
        return (
            <span className="xref xref--missing" title={`Missing label: ${resolved[0].id}`}>
                [?{resolved[0].id}]
            </span>
        )
    }

    const allKinds = resolved.filter((r) => !r.missing).map((r) => r.entry.kind)
    const sameKind = allKinds.every((k) => k === allKinds[0])

    const locator = formatLocator(params)

    if (!sameKind) {
        if (typeof console !== 'undefined') {
            // eslint-disable-next-line no-console
            console.warn(
                `[xref] mixed-kind cluster (${[...new Set(allKinds)].join(', ')}) — falling back to comma-separated rendering`,
            )
        }
        // Each kind keeps its own singular label, and each resolved part links
        // to its own target. A missing one stays visible text.
        const parts = []
        resolved.forEach((r, i) => {
            if (i > 0) parts.push(', ')
            if (r.missing) {
                parts.push(`[?${r.id}]`)
                return
            }
            const label = r.kindMeta?.label || ''
            const sep = r.kindMeta?.sep ?? ' '
            if (label) parts.push(label, sep)
            parts.push(counterLink(r.entry))
        })
        return <span className="xref">{parts}{locator}</span>
    }

    const onlyResolved = resolved.filter((r) => !r.missing)

    // The single case links the WHOLE reference — "Equation 1", label and all,
    // is one phrase naming one thing, so the label belongs inside the link.
    // A cluster cannot do that: "Figures 1 and 2" has one label over two
    // targets, so there each counter is its own link and the label is plain.
    if (onlyResolved.length === 1 && resolved.length === 1) {
        const { entry, kindMeta } = onlyResolved[0]
        return (
            <a className="xref" href={`#${entry.id}`}>
                {renderEntry(entry, kindMeta)}{locator}
            </a>
        )
    }

    const body = onlyResolved.length > 0
        ? renderGroupSameKind(
              onlyResolved.map((r) => r.entry),
              onlyResolved[0].kindMeta,
          )
        : []

    const missing = resolved.filter((r) => r.missing).map((r) => `[?${r.id}]`)
    const parts = missing.length > 0 && body.length > 0 ? [...body, ', ', ...missing] : [...body, ...missing]

    return <span className="xref">{parts}{locator}</span>
}

export default Ref

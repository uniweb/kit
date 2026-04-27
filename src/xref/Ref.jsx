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

function renderGroupSameKind(entries, kindMeta) {
    if (entries.length === 1) {
        return renderEntry(entries[0], kindMeta)
    }
    const label = kindMeta?.labelPlural || kindMeta?.label || ''
    const sep = kindMeta?.sep ?? ' '
    const counters = entries.map((e) => e.counterText)
    let body
    if (counters.length === 2) {
        body = counters.join(' and ')
    } else {
        body = counters.slice(0, -1).join(', ') + ', and ' + counters[counters.length - 1]
    }
    return label ? `${label}${sep}${body}` : body
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
        const parts = resolved.map((r) =>
            r.missing ? `[?${r.id}]` : renderEntry(r.entry, r.kindMeta),
        )
        return <span className="xref">{parts.join(', ')}{locator}</span>
    }

    const onlyResolved = resolved.filter((r) => !r.missing)
    const text = onlyResolved.length > 0
        ? renderGroupSameKind(
              onlyResolved.map((r) => r.entry),
              onlyResolved[0].kindMeta,
          )
        : ''

    const missingTail = resolved.filter((r) => r.missing).map((r) => `[?${r.id}]`).join(', ')
    const body = [text, missingTail].filter(Boolean).join(', ')

    return <span className="xref">{body}{locator}</span>
}

export default Ref

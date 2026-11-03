/**
 * trackAction — report something a visitor did in a section, counted the way the section's author
 * chose.
 *
 * ```js
 * // meta.js
 * params: {
 *   copyConverts: { type: 'boolean', label: 'Copying the command is a conversion', default: true },
 * }
 *
 * // the section
 * <CopyButton onCopied={() => trackAction(block, 'command_copied', params.copyConverts)} />
 * ```
 *
 * ⭐ **The section offers the choice and its author makes it.** A component can't know which of
 * the things a visitor does in it is a result for this site: a video in a Hero is the point of one
 * page and decoration on another. So the component declares a param for each act it can report,
 * and the author decides in the editor [Diego, 2026-11-03]. With `converts` true the act is a
 * `conversion`, which campaigns are judged by. Otherwise it is an `engagement`, so the act is still
 * counted and still read beside its campaign, without inflating a conversion rate.
 *
 * ⭐ **The author names nothing.** The name is the component's, the same in every section that
 * offers the same act, so the Hero's copy and the closing section's copy add up. `block.track`
 * attaches the page, the section type and the section, so no field needs to say where.
 *
 * ⛔ **Once per name per page load, as the runtime's own listener counts:** copying a command twice
 * is one copy. A conversion and an engagement of the same name are kept apart, because two sections
 * of one page may count the same act differently. A reload is a new page load, so it counts again.
 *
 * ⛔ **Not for a link.** A link counts by its address in the site's `tracking.conversions` list,
 * wherever it appears, so a param on a link would count one click twice.
 *
 * ⚖️ **Never gated, like any event a foundation sends.** `emit` and a host's list narrow what the
 * runtime emits by itself, never `track()`, and this is the foundation asking. With no destination
 * it does nothing, so a call needs no guard.
 *
 * Only `name` crosses the wire. The set of names already reported lives in this module, so it is
 * one per document per copy of kit: an extension that bundles its own kit and reports the same name
 * counts once more.
 *
 * @module @uniweb/kit/trackAction
 */

const reported = new Set()

/**
 * @param {object} block - the section's block
 * @param {string} name - what the visitor did, such as `command_copied`. Keep it short: a collector
 *        may cut a long one
 * @param {boolean} converts - whether the section's author counts it as a conversion. Only `true`
 *        does
 */
export function trackAction(block, name, converts) {
  if (!name) return
  const event = converts === true ? 'conversion' : 'engagement'
  const key = `${event}\u0000${name}`
  if (reported.has(key)) return
  reported.add(key)
  block?.track?.(event, { name })
}

export default trackAction

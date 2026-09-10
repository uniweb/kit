/**
 * The predicates a foundation calls before rendering UI for a site service.
 *
 * ## The one idea
 *
 * ⭐ **One predicate per service, no arguments, and the same meaning of `false`
 * everywhere:** *would rendering UI for this service produce something that
 * works?* Call it before you draw; if it is false, **draw nothing** — not a
 * disabled control, not an explanation. A visitor has no stake in which
 * services the operator provisioned, and *"search is unavailable"* reads as
 * breakage when it is simply a feature this site does not have.
 *
 * Before this existed there were four shapes for one question — a free function
 * taking a website (`@uniweb/api`'s `isEnabled`), a method on `Website`
 * (`isSearchEnabled`), a field on a hook's return (`useFormSubmit().canSubmit`),
 * and the raw `resolveService(website, name)` — so every service grew its own.
 *
 * ## ⛔ These add NO logic
 *
 * Each resolves the active website and calls `Website.isServiceEnabled(name)`,
 * which is the single implementation. That method lives in `@uniweb/core` for a
 * reason worth not undoing: a foundation bundles its own frozen copy of this
 * package, so a fix made here never reaches one built before it, while core is
 * carried by the runtime and re-exported through the import map — a foundation
 * of any age calls the current method. ⇒ **Logic in core, surface here.**
 *
 * ## The website is resolved, not passed
 *
 * A foundation never holds a `Website` to ask a question about the site it is
 * already rendering. ⛔ The core primitive `resolveService(website, name)` keeps
 * its explicit parameter, because it also runs where there is no singleton —
 * an SSR isolate over a plain content object.
 *
 * ## A service the framework ships no client for
 *
 * The registry is open, so any name resolves. There is deliberately no generic
 * `isServiceEnabled(name)` exported here: ask the method directly —
 * `useWebsite().website.isServiceEnabled('booking')`. A one-liner can be added
 * if a real case appears.
 */

import { getUniweb } from '@uniweb/core'

/**
 * The active website, or null before the runtime has initialized.
 *
 * ⛔ **Every predicate below passes its service name as a LITERAL**, rather than
 * sharing a `enabled(name)` helper. That indirection reads better and breaks
 * `uniweb.supports`: the derivation walks the foundation's post-shake module
 * graph looking for the name as an *argument*, so a name that arrives as a
 * parameter is an unresolved identifier — counted as blindness, not as a
 * service, and published short with a warning nobody is watching for. Measured
 * here 2026-09-10: the helper form derived `[]` for all five.
 * (`@uniweb/build/foundation/derive-supports`.)
 */
function activeWebsite() {
  return getUniweb()?.activeWebsite ?? null
}

/**
 * Does this site have an app backend — accounts, per-visitor data, member
 * writes? The question to ask before drawing a sign-in affordance or any
 * control only a backend can answer. Re-exported by `@uniweb/api`.
 */
export function isApiEnabled() {
  return activeWebsite()?.isServiceEnabled('api') ?? false
}

/**
 * Can this site be searched?
 *
 * ⭐ **True when ANY provider answers** — a server, or the prebuilt index that
 * needs no address at all, which is the default on a site with no host. ⛔ So
 * this is not "is there a search service": gating a search box on that would
 * hide it on every static site.
 */
export function isSearchEnabled() {
  return activeWebsite()?.isServiceEnabled('search') ?? false
}

/** Does this site have somewhere to send form submissions? */
export function isSubmitEnabled() {
  return activeWebsite()?.isServiceEnabled('submit') ?? false
}

/** Does this site have somewhere to send analytics events? */
export function isTrackingEnabled() {
  return activeWebsite()?.isServiceEnabled('tracking') ?? false
}

/** Does this site have an assistant surface to answer? */
export function isAssistantEnabled() {
  return activeWebsite()?.isServiceEnabled('assistant') ?? false
}

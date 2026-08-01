import { applyBasePath } from './href.js'

/**
 * Site services — where a site's search, form submissions, assistant, or
 * anything else of that shape actually go.
 *
 * ## The one idea
 *
 * A component must never name a host. Whether this site's search is answered by
 * a prebuilt index, a server endpoint, or a vendor API is a *deployment* fact,
 * and a foundation that hardcodes it is coupled to one deployment. So the
 * address comes from configuration, and there are exactly two places it can
 * come from:
 *
 *   1. **The site**, authored — `search:`, `submit:`, `assistant:` in site.yml.
 *      The operator's own declaration, and it wins.
 *   2. **The host**, served — `config.services.<name>` in the payload. What the
 *      deployment offers, which the site never had to know about.
 *
 * Absent from both means the site has no such service, and the component says so
 * rather than guessing an address. That is the same rule for every service, and
 * it is why this module exists: it was previously implemented three times — the
 * search provider, the submit resolver, and a hand-rolled copy inside a
 * foundation — with three slightly different base-joining rules between them.
 *
 * ## The registry is open, not an enum
 *
 * `resolveService(website, name)` takes a *name*, and the framework has no list
 * of permitted ones. It ships **clients** only for what it already implements
 * (search, form submission); it ships **resolution** for anything. A foundation
 * that invents `assistant`, `booking` or `translate` gets the same precedence,
 * the same base handling and the same absent-means-absent behaviour, and a host
 * can fill the slot without a framework change.
 *
 * This is deliberate and it is the same shape as `fetcher.transports`: the
 * framework owns the seam, not the catalogue.
 *
 * ## What this deliberately does not model
 *
 * **Entitlement.** A host that will not serve a service either omits it or
 * supplies a `reason`, which is relayed to the UI verbatim. The framework never
 * learns why — no plan names, no tiers, no "paid" anywhere. That is not
 * squeamishness: `@uniweb/kit` is public, and a framework that encodes which
 * capabilities cost money ships the business model into open source.
 *
 * **The site's own base.** `config.base` is where the site *lives*, not a
 * service it consumes — it is load-bearing for routing and asset URLs too. It
 * stays where it is and is an input here, not an entry.
 */

/** Anything with a scheme, or protocol-relative — never joined to a base. */
const ABSOLUTE_URL_RE = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i

/** Shown when nothing supplies a service and the caller gives no wording. */
export const NO_SERVICE_REASON = 'This site has no such service configured.'

/**
 * Read an endpoint out of either declaration form.
 *
 * A site may write the shorthand (`submit: /forms`) or the object
 * (`submit: { endpoint: /forms }`); a host emits JSON and normally writes the
 * object. Both are accepted from both sides — one reader, no per-side rules to
 * remember.
 *
 * @param {*} declaration
 * @returns {string} the endpoint, or '' when there is none
 */
function readEndpoint(declaration) {
  if (typeof declaration === 'string') return declaration.trim()
  if (typeof declaration?.endpoint === 'string') return declaration.endpoint.trim()
  return ''
}

/**
 * Join a service endpoint to the site's base path.
 *
 * Three cases, and the middle one is why this is not simply `applyBasePath`:
 *
 *   - **Absolute** (`https://…`, `//host/…`, any scheme) — passed through. A
 *     service on another origin is not the site's to relocate.
 *   - **Bare relative** (`_search`) — rooted first. This spelling is documented
 *     and in use, and `applyBasePath` alone would leave it untouched, silently
 *     producing a request relative to whatever page the visitor is on.
 *   - **Root-relative** (`/forms`) — the ordinary case.
 *
 * The join itself goes through `applyBasePath` rather than concatenation,
 * because that is where the invariant "a base is only ever joined to a path that
 * starts at the site root" is enforced, and it is idempotent — an
 * already-based path is not based twice.
 *
 * @param {string} endpoint
 * @param {string} [basePath] - `website.basePath`
 * @returns {string}
 */
export function resolveServiceUrl(endpoint, basePath = '') {
  if (!endpoint) return ''
  if (ABSOLUTE_URL_RE.test(endpoint)) return endpoint

  const rooted = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  // `applyBasePath` concatenates and documents its input as carrying no
  // trailing slash, so normalizing is the caller's job — skip it and
  // `base: /docs/` yields `/docs//forms`.
  const base = (basePath || '').replace(/\/+$/, '')
  return applyBasePath(rooted, base)
}

/**
 * Resolve where a named service lives for this site.
 *
 * ```js
 * const { url, reason } = resolveService(website, 'submit')
 * if (!url) return renderDisabled(reason)
 * ```
 *
 * @param {object} website - the active Website
 * @param {string} name - service name, e.g. 'submit' · 'search' · 'assistant'
 * @param {object} [options]
 * @param {string} [options.reason] - wording when nothing supplies it
 * @returns {{ url: string|null, reason: string|null, source: 'site'|'host'|null }}
 *   `source` says which declaration answered — useful in diagnostics, and the
 *   thing to check when a host's value appears not to be taking effect.
 */
export function resolveService(website, name, options = {}) {
  const config = website?.config
  const basePath = website?.basePath

  // 1 — the site's own declaration wins. An operator who named an endpoint
  // means it, including on a host that offers one.
  const authored = readEndpoint(config?.[name])
  if (authored) {
    return { url: resolveServiceUrl(authored, basePath), reason: null, source: 'site' }
  }

  // 2 — what the host says it offers.
  const hostDeclaration = config?.services?.[name]
  const hostEndpoint = readEndpoint(hostDeclaration)
  if (hostEndpoint) {
    return { url: resolveServiceUrl(hostEndpoint, basePath), reason: null, source: 'host' }
  }

  // A host that declines may say why, and that reaches the visitor unaltered.
  const hostReason =
    typeof hostDeclaration?.reason === 'string' ? hostDeclaration.reason.trim() : ''
  if (hostReason) return { url: null, reason: hostReason, source: 'host' }

  // 3 — nobody supplied one.
  return { url: null, reason: options.reason || NO_SERVICE_REASON, source: null }
}

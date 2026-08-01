/**
 * Resolve where this site's form submissions go.
 *
 * A site declares its endpoint under `submit:` in site.yml, and the value
 * arrives here as `website.config.submit` — the same passthrough every other
 * site.yml key rides (`collections:`, `search:`, `fetcher:`). Two spellings,
 * because one destination is the common case and the object form leaves room
 * to grow:
 *
 *   submit: /forms                    # shorthand
 *   submit: { endpoint: /forms }      # object form
 *   submit: https://forms.example.com/intake
 *
 * A relative endpoint resolves against `website.basePath`, so one spelling
 * works whether the site is served from the root, from a subdirectory
 * (`base: /docs/`), or from a host subpath. An absolute URL passes through
 * untouched, for a form service on another origin.
 *
 * ## Precedence — and why the framework never picks one itself
 *
 * A destination comes from the first of these that applies:
 *
 *   1. `submit:` here — the site operator's declaration.
 *   2. A value the HOST supplies in the served payload. Not implemented yet;
 *      see below for where it slots in.
 *   3. Neither — `url: null` plus a reason, so the form renders disabled.
 *
 * What the framework must never do is invent one. It cannot know where a given
 * site can accept a submission, and guessing is worse than having none: on a
 * static host, or any deployment with nothing listening, the form POSTs a
 * visitor's data into a 404 and nothing here can tell. The asymmetry with
 * reading matters — a fetch that 404s degrades to `[]` and the page still
 * renders, which is a documented guarantee, but a write that 404s loses what
 * someone typed.
 *
 * Note that a host supplying a site-local path is NOT the same as the framework
 * defaulting to one, even when the two produce an identical request: a host only
 * offers the path when something is actually there to catch it. Same bytes, and
 * only one of them is correct.
 *
 * ## Adding tier 2
 *
 * It belongs between the two branches below — read the host-supplied field off
 * the payload config, after the authored value and before giving up. The host
 * owns that value end to end; relay whatever reason it gives verbatim rather
 * than interpreting it, since the framework has no standing to judge why a
 * given site can or cannot accept submissions.
 */

/**
 * Shown when a site declares no endpoint. English, and a foundation is free to
 * ignore it and render its own copy — check `url` for the yes/no and treat this
 * as a default rather than a string to translate.
 */
export const NO_SUBMIT_TARGET_REASON =
  'This site has no form submission endpoint configured.'

/**
 * Resolve the submission target for a site.
 *
 * @param {object} website - The active Website instance
 * @returns {{ url: string|null, reason: string|null }}
 *   `url` is the resolved absolute-or-base-relative endpoint, or null when the
 *   site declares none. `reason` is set exactly when `url` is null.
 */
export function resolveSubmitTarget(website) {
  // Tier 1 — the site operator's own declaration.
  const declared = website?.config?.submit

  const endpoint =
    typeof declared === 'string'
      ? declared.trim()
      : typeof declared?.endpoint === 'string'
        ? declared.endpoint.trim()
        : ''

  if (endpoint) {
    return { url: resolveAgainstBase(endpoint, website?.basePath), reason: null }
  }

  // Tier 2 — a host-supplied destination — goes here. See the header.

  // Tier 3 — nobody supplied one.
  return { url: null, reason: NO_SUBMIT_TARGET_REASON }
}

/**
 * Join a declared endpoint to the site's base path.
 *
 * This is the same shape as `resolveEndpointUrl` in the search provider, and is
 * deliberately NOT shared with it: that one falls back to a default endpoint
 * when given nothing, which is precisely the behaviour a submission target must
 * not have (see the header). Three lines of duplication is the cheaper mistake.
 *
 * @param {string} endpoint - Declared endpoint, relative or absolute
 * @param {string} [basePath] - `website.basePath`, normalized without a trailing slash
 * @returns {string}
 */
export function resolveAgainstBase(endpoint, basePath = '') {
  if (/^https?:\/\//i.test(endpoint)) return endpoint

  const base = (basePath || '').replace(/\/+$/, '')
  const rel = endpoint.replace(/^\/+/, '')
  return `${base}/${rel}`
}

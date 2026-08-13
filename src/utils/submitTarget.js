import { resolveService, resolveServiceUrl } from './services.js'

/**
 * Where this site's form submissions go.
 *
 * A thin naming of the general rule in `./services.js` — a site declares
 * `submit:` in site.yml, a host may offer one under `config.services.submit`,
 * and absent from both means the form renders disabled rather than posting a
 * visitor's answers to an address nobody claimed.
 *
 * ## There is deliberately no default
 *
 * The framework does not know where a given site can accept a submission, and
 * picking a path on the site's behalf is worse than having none: on a static
 * host, or any deployment with nothing listening, the form POSTs into a 404 and
 * nothing here can tell. The asymmetry with reading matters — a fetch that 404s
 * degrades to `[]` and the page still renders, which is a documented guarantee,
 * but a write that 404s loses what someone typed.
 *
 * Note that a host supplying a site-local path is NOT the same as the framework
 * defaulting to one, even when the two produce an identical request: a host only
 * offers the path when something is actually there to catch it. Same bytes, and
 * only one of them is correct.
 *
 * ## Simulating a host locally
 *
 * The bundle lane spreads all of site.yml into the payload config, so writing a
 * `services:` block in site.yml exercises the host tier end to end with no
 * framework change. It cannot leak into a real deployment: the sync lane is an
 * explicit allowlist and does not carry `services`, so a synced site's value can
 * only have come from its host.
 */

/**
 * Resolve the submission target for a site.
 *
 * @param {object} website - The active Website instance
 * @returns {{ url: string|null, source: 'site'|'host'|null }}
 *   `url` is the resolved endpoint, or null when nothing supplies one — in which
 *   case render no form, or degrade to contact details the site already carries.
 */
export function resolveSubmitTarget(website) {
  return resolveService(website, 'submit')
}

/**
 * Join an endpoint to the site's base path.
 *
 * Retained as a named export because it shipped as one. Prefer
 * `resolveServiceUrl` from `./services.js` — this is that function.
 *
 * @param {string} endpoint - Declared endpoint, relative or absolute
 * @param {string} [basePath] - `website.basePath`
 * @returns {string}
 */
export function resolveAgainstBase(endpoint, basePath = '') {
  return resolveServiceUrl(endpoint, basePath)
}

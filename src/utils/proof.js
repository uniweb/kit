/**
 * Proof of work for a form a host protects.
 *
 * A host may protect a form's address with a small puzzle. Before it accepts a
 * submission, the visitor's browser has to spend a moment of computing, which a
 * person never notices and a bulk sender pays for every time. The host says so
 * in the service's own row, with one more address beside `endpoint`:
 *
 *     config.services.submit = { endpoint: '/_submit', challenge: '/_submit/challenge' }
 *
 * `challenge` present ⇒ fetch a puzzle there, solve it, and send the answer
 * with the request. Absent ⇒ send as before. Nothing here guesses an address:
 * a challenge address is read from the row exactly as the endpoint is, and a
 * site whose host says nothing (every static site) sends nothing extra.
 *
 * ## The wire: ALTCHA v1, unmodified
 *
 * - `GET <challenge>` answers `{ algorithm, challenge, maxnumber, salt, signature }`.
 * - The answer is the number `n` in `0…maxnumber` for which
 *   `hex(digest(algorithm, salt + n)) === challenge`.
 * - It travels in the `X-Proof` header as Base64 of
 *   `{ algorithm, challenge, number, salt, signature }`.
 *
 * `salt` and `signature` are the host's and opaque here: they are sent back as
 * received, never read. How hard the puzzle is (`maxnumber`) is the host's
 * setting, read from each puzzle, so difficulty changes need no new kit.
 *
 * ## A refusal the client can fix: an expired puzzle
 *
 * A host refuses with `403` and an `X-Uniweb-Error` header naming why:
 * `proof-missing`, `proof-invalid`, `proof-expired` or `proof-replayed`. Only
 * `proof-expired` is something a fresh puzzle fixes (a visitor who took longer
 * than the puzzle lives), so that one is solved again and sent once more. The
 * others are thrown with the code on the error, since sending again would only
 * be refused again.
 *
 * @module @uniweb/kit/utils/proof
 */

import { resolveServiceUrl } from './services.js'

/** The request header carrying the answer. */
export const PROOF_HEADER = 'X-Proof'

/** The response header a host names its refusal in. */
export const PROOF_ERROR_HEADER = 'X-Uniweb-Error'

/** The digests a puzzle may name, as Web Crypto spells them. */
const ALGORITHMS = new Set(['SHA-256', 'SHA-384', 'SHA-512'])

/**
 * An address a service's row names beside its endpoint, read from the tier
 * that supplied the endpoint, with the site's base applied.
 *
 * ⛔ **Same tier as the endpoint, never a per-key merge.** A host that offers
 * `/_submit` names the challenge for `/_submit`. Taking `challenge` from the
 * site's own `submit:` while the endpoint came from the host would send a
 * puzzle answer meant for one server to another, and the reverse would ask a
 * site's own form provider for a puzzle it never issues.
 *
 * ```js
 * const confirm = resolveServiceAddress(website, 'requests', 'confirm')
 * ```
 *
 * @param {object} website - the active Website
 * @param {string} name - service name, e.g. 'submit' · 'requests'
 * @param {string} key - the address key in that row, e.g. 'challenge' · 'confirm'
 * @returns {string|null} the address, or null when the answering tier names none
 */
export function resolveServiceAddress(website, name, key) {
  const config = website?.config
  const row = endpointOf(config?.services?.[name])
    ? config.services[name]
    : endpointOf(config?.[name])
      ? config[name]
      : null
  const value = row && typeof row === 'object' ? row[key] : null
  if (typeof value !== 'string' || !value.trim()) return null
  return resolveServiceUrl(value.trim(), website?.basePath) || null
}

/** The endpoint a declaration offers, honouring the off switch. */
function endpointOf(declaration) {
  if (declaration === false || declaration == null) return ''
  if (typeof declaration === 'string') return declaration.trim()
  if (typeof declaration !== 'object' || declaration.enabled === false) return ''
  return typeof declaration.endpoint === 'string' ? declaration.endpoint.trim() : ''
}

/**
 * Solve one puzzle: find the number whose digest, after the salt, is the
 * challenge.
 *
 * @param {{ algorithm?: string, challenge: string, maxnumber?: number, salt: string }} puzzle
 * @returns {Promise<number>}
 * @throws {Error} when the puzzle is malformed or has no answer in range
 */
export async function solveChallenge(puzzle) {
  const algorithm = puzzle?.algorithm || 'SHA-256'
  if (!ALGORITHMS.has(algorithm)) {
    throw new Error(`solveChallenge: unsupported algorithm "${algorithm}"`)
  }
  const { challenge, salt } = puzzle || {}
  if (typeof challenge !== 'string' || typeof salt !== 'string') {
    throw new Error('solveChallenge: a puzzle needs a challenge and a salt')
  }
  const subtle = globalThis.crypto?.subtle
  if (!subtle) throw new Error('solveChallenge: Web Crypto is unavailable')

  const target = hexToBytes(challenge)
  const max = Number.isFinite(puzzle.maxnumber) ? puzzle.maxnumber : 1e6
  const encoder = new TextEncoder()

  for (let n = 0; n <= max; n++) {
    const digest = new Uint8Array(await subtle.digest(algorithm, encoder.encode(salt + n)))
    if (sameBytes(digest, target)) return n
  }
  throw new Error('solveChallenge: no answer within maxnumber')
}

/**
 * Fetch a puzzle from a challenge address and return the `X-Proof` value.
 *
 * @param {string} challengeUrl
 * @param {typeof fetch} [fetchFn=fetch]
 * @returns {Promise<string>} Base64 of `{ algorithm, challenge, number, salt, signature }`
 */
export async function fetchProof(challengeUrl, fetchFn = globalThis.fetch) {
  const res = await fetchFn(challengeUrl, { method: 'GET', headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Could not fetch a challenge (HTTP ${res.status})`)
  const puzzle = await res.json()
  const number = await solveChallenge(puzzle)
  const { algorithm = 'SHA-256', challenge, salt, signature } = puzzle
  return btoa(JSON.stringify({ algorithm, challenge, number, salt, signature }))
}

/**
 * Send a request to a protected address: fetch a puzzle, solve it, and send
 * the answer in `X-Proof`. With no `challenge`, this is `fetchFn(url, init)`.
 *
 * On `403 proof-expired` it solves a fresh puzzle and sends once more. Any
 * other proof refusal comes back as the response, for the caller to report;
 * {@link proofError} reads its code.
 *
 * @param {string} url
 * @param {RequestInit} init - a body that can be sent twice (a string, not a stream)
 * @param {object} [opts]
 * @param {string|null} [opts.challenge] - the challenge address, when the host names one
 * @param {typeof fetch} [opts.fetchFn=fetch]
 * @returns {Promise<Response>}
 */
export async function sendWithProof(url, init = {}, { challenge, fetchFn = globalThis.fetch } = {}) {
  if (!challenge) return fetchFn(url, init)

  const send = async () => fetchFn(url, {
    ...init,
    headers: { ...(init.headers || {}), [PROOF_HEADER]: await fetchProof(challenge, fetchFn) },
  })

  const res = await send()
  return proofError(res) === 'proof-expired' ? send() : res
}

/**
 * The proof refusal a response carries, or null.
 *
 * @param {Response} res
 * @returns {string|null} e.g. 'proof-missing' · 'proof-invalid' · 'proof-expired' · 'proof-replayed'
 */
export function proofError(res) {
  if (!res || res.status !== 403) return null
  const code = res.headers?.get?.(PROOF_ERROR_HEADER)
  return typeof code === 'string' && code.startsWith('proof-') ? code : null
}

function hexToBytes(hex) {
  const clean = hex.trim().toLowerCase()
  if (!/^(?:[0-9a-f]{2})+$/.test(clean)) throw new Error('solveChallenge: challenge is not hex')
  const out = new Uint8Array(clean.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  return out
}

function sameBytes(a, b) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

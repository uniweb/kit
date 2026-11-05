/**
 * Proof of work for a host-protected form address (ALTCHA v1 wire).
 *
 * What has to hold:
 *  - the solver finds the number a real puzzle was made from, and the
 *    `X-Proof` value decodes to exactly the five fields the host checks;
 *  - a challenge address is read from the tier that supplied the endpoint,
 *    never mixed across tiers, and never constructed;
 *  - no challenge ⇒ the request is sent exactly as before (static sites);
 *  - `proof-expired` is solved again and sent once more; other refusals are
 *    not retried and reach the caller as `error.code`;
 *  - uploads after a protected create carry no proof.
 */

import { createHash } from 'node:crypto'
import {
  solveChallenge,
  fetchProof,
  sendWithProof,
  proofError,
  resolveServiceAddress,
  PROOF_HEADER,
} from '../src/utils/proof.js'
import { submitForm } from '../src/utils/submitForm.js'

function makePuzzle(number, salt = 'a1b2c3?expires=1999999999&k=x') {
  return {
    algorithm: 'SHA-256',
    challenge: createHash('sha256').update(salt + number).digest('hex'),
    maxnumber: 5000,
    salt,
    signature: 'sig-opaque',
  }
}

function response({ status = 200, body = {}, headers = {} } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k) => headers[k] ?? headers[k.toLowerCase()] ?? null },
    json: async () => body,
  }
}

/** A fetch double: GET <challenge> answers puzzles in turn, everything else from `answers`. */
function fakeFetch({ puzzles = [], answers = [] } = {}) {
  const calls = []
  const fn = async (url, init = {}) => {
    calls.push({ url, init })
    if (String(url).endsWith('/challenge')) return response({ body: puzzles.shift() })
    return answers.shift() || response({ body: { submissionId: 's1' } })
  }
  fn.calls = calls
  return fn
}

const decode = (v) => JSON.parse(atob(v))

describe('solveChallenge', () => {
  it('finds the number the puzzle was made from', async () => {
    expect(await solveChallenge(makePuzzle(1234))).toBe(1234)
    expect(await solveChallenge(makePuzzle(0))).toBe(0)
  })

  it('refuses an algorithm it does not know, and a puzzle with no answer in range', async () => {
    await expect(solveChallenge({ ...makePuzzle(1), algorithm: 'MD5' })).rejects.toThrow(/unsupported/)
    await expect(solveChallenge({ ...makePuzzle(50), maxnumber: 10 })).rejects.toThrow(/no answer/)
  })
})

describe('fetchProof', () => {
  it('returns Base64 JSON of exactly algorithm, challenge, number, salt, signature', async () => {
    const puzzle = makePuzzle(77)
    const proof = decode(await fetchProof('/_submit/challenge', fakeFetch({ puzzles: [puzzle] })))
    expect(proof).toEqual({
      algorithm: 'SHA-256',
      challenge: puzzle.challenge,
      number: 77,
      salt: puzzle.salt,
      signature: 'sig-opaque',
    })
  })
})

describe('resolveServiceAddress', () => {
  it('reads a key from the host row that answered, with the base applied', () => {
    const website = {
      basePath: '/docs',
      config: { services: { submit: { endpoint: '/_submit', challenge: '/_submit/challenge' } } },
    }
    expect(resolveServiceAddress(website, 'submit', 'challenge')).toBe('/docs/_submit/challenge')
  })

  it('never takes a key from the site tier when the host supplied the endpoint', () => {
    const website = {
      config: {
        submit: { endpoint: '/mine', challenge: '/mine/challenge' },
        services: { submit: { endpoint: '/_submit' } },
      },
    }
    expect(resolveServiceAddress(website, 'submit', 'challenge')).toBeNull()
  })

  it('reads the site tier when the site supplied the endpoint', () => {
    const website = { config: { submit: { endpoint: '/mine', challenge: '/mine/challenge' } } }
    expect(resolveServiceAddress(website, 'submit', 'challenge')).toBe('/mine/challenge')
  })

  it('is null with no row, a declined row, or a row without the key', () => {
    expect(resolveServiceAddress({ config: {} }, 'requests', 'confirm')).toBeNull()
    expect(resolveServiceAddress({ config: { services: { requests: { endpoint: '/x', enabled: false, confirm: '/c' } } } }, 'requests', 'confirm')).toBeNull()
    expect(resolveServiceAddress({ config: { services: { requests: { endpoint: '/x' } } } }, 'requests', 'confirm')).toBeNull()
  })
})

describe('sendWithProof', () => {
  it('sends unchanged when there is no challenge', async () => {
    const fetchFn = fakeFetch()
    await sendWithProof('/forms', { method: 'POST', body: '{}' }, { fetchFn })
    expect(fetchFn.calls).toHaveLength(1)
    expect(fetchFn.calls[0].init.headers).toBeUndefined()
  })

  it('solves again and resends once on proof-expired', async () => {
    const fetchFn = fakeFetch({
      puzzles: [makePuzzle(3), makePuzzle(9)],
      answers: [
        response({ status: 403, headers: { 'X-Uniweb-Error': 'proof-expired' } }),
        response({ body: { ok: 1 } }),
      ],
    })
    const res = await sendWithProof('/_submit', { method: 'POST', body: '{}' }, { challenge: '/_submit/challenge', fetchFn })
    expect(res.ok).toBe(true)
    const posts = fetchFn.calls.filter((c) => c.url === '/_submit')
    expect(posts.map((c) => decode(c.init.headers[PROOF_HEADER]).number)).toEqual([3, 9])
  })

  it('does not retry any other refusal', async () => {
    const fetchFn = fakeFetch({
      puzzles: [makePuzzle(3)],
      answers: [response({ status: 403, headers: { 'X-Uniweb-Error': 'proof-replayed' } })],
    })
    const res = await sendWithProof('/_submit', { method: 'POST', body: '{}' }, { challenge: '/_submit/challenge', fetchFn })
    expect(proofError(res)).toBe('proof-replayed')
    expect(fetchFn.calls.filter((c) => c.url === '/_submit')).toHaveLength(1)
  })
})

describe('submitForm with a challenge', () => {
  it('proves the create request and nothing after it', async () => {
    const fetchFn = fakeFetch({ puzzles: [makePuzzle(5)] })
    const file = { name: 'a.txt', size: 1, type: 'text/plain' }
    await submitForm({ formData: { Name: 'Ada' }, target: '/_submit', challenge: '/_submit/challenge', files: [file], fetchFn })

    const create = fetchFn.calls.find((c) => c.url === '/_submit')
    expect(decode(create.init.headers[PROOF_HEADER]).number).toBe(5)
    const after = fetchFn.calls.filter((c) => /\/(upload|finalize)$/.test(c.url))
    expect(after).toHaveLength(2)
    for (const c of after) expect(c.init.headers[PROOF_HEADER]).toBeUndefined()
  })

  it('throws a proof refusal with its code', async () => {
    const fetchFn = fakeFetch({
      puzzles: [makePuzzle(5)],
      answers: [response({ status: 403, headers: { 'X-Uniweb-Error': 'proof-invalid' } })],
    })
    await expect(
      submitForm({ formData: { a: 'b' }, target: '/_submit', challenge: '/_submit/challenge', fetchFn }),
    ).rejects.toMatchObject({ code: 'proof-invalid' })
  })
})

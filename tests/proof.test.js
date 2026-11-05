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
  prepareProof,
  proofError,
  resolveServiceAddress,
  PROOF_HEADER,
} from '../src/utils/proof.js'
import { submitForm } from '../src/utils/submitForm.js'
import { sha256 } from '../src/utils/sha256.js'

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

describe('sha256', () => {
  it('matches Node across block boundaries', () => {
    for (const s of ['', 'abc', 'x'.repeat(55), 'x'.repeat(56), 'x'.repeat(64), 'x'.repeat(200), 'é salt?expires=1#42']) {
      const ours = Buffer.from(sha256(new TextEncoder().encode(s))).toString('hex')
      expect(ours).toBe(createHash('sha256').update(s).digest('hex'))
    }
  })
})

describe('solveChallenge', () => {
  it('finds the number the puzzle was made from', async () => {
    expect(await solveChallenge(makePuzzle(1234))).toBe(1234)
    expect(await solveChallenge(makePuzzle(0))).toBe(0)
  })

  it('solves SHA-512 through Web Crypto', async () => {
    const salt = 'q'
    const challenge = createHash('sha512').update(salt + 21).digest('hex')
    expect(await solveChallenge({ algorithm: 'SHA-512', challenge, maxnumber: 100, salt })).toBe(21)
  })

  it('answers past a slice boundary', async () => {
    expect(await solveChallenge({ ...makePuzzle(12001), maxnumber: 20000 })).toBe(12001)
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

describe('prepareProof', () => {
  it('solves ahead, and the next send uses that answer once', async () => {
    const fetchFn = fakeFetch({ puzzles: [makePuzzle(11), makePuzzle(12)] })
    prepareProof('/a/challenge', fetchFn)
    prepareProof('/a/challenge', fetchFn) // already waiting: no second fetch
    await sendWithProof('/a', { method: 'POST', body: '{}' }, { challenge: '/a/challenge', fetchFn })
    await sendWithProof('/a', { method: 'POST', body: '{}' }, { challenge: '/a/challenge', fetchFn })

    expect(fetchFn.calls.map((c) => c.url)).toEqual(['/a/challenge', '/a', '/a/challenge', '/a'])
    const numbers = fetchFn.calls.filter((c) => c.url === '/a').map((c) => decode(c.init.headers[PROOF_HEADER]).number)
    expect(numbers).toEqual([11, 12])
  })

  it('falls back to a fresh fetch when preparing failed', async () => {
    let first = true
    const fetchFn = async (url, init) => {
      if (url.endsWith('/challenge')) {
        if (first) { first = false; return response({ status: 500 }) }
        return response({ body: makePuzzle(4) })
      }
      return response({ body: { ok: 1 }, headers: {} , status: 200 })
    }
    prepareProof('/b/challenge', fetchFn)
    await new Promise((r) => setTimeout(r, 0))
    const res = await sendWithProof('/b', { method: 'POST', body: '{}' }, { challenge: '/b/challenge', fetchFn })
    expect(res.ok).toBe(true)
  })

  it('does nothing with no challenge', () => {
    const fetchFn = fakeFetch()
    prepareProof(null, fetchFn)
    expect(fetchFn.calls).toHaveLength(0)
  })
})

describe('proof-too-soon', () => {
  it('waits Retry-After and resends the same answer once', async () => {
    const fetchFn = fakeFetch({
      puzzles: [makePuzzle(8)],
      answers: [
        response({ status: 403, headers: { 'X-Uniweb-Error': 'proof-too-soon', 'Retry-After': '0.05' } }),
        response({ body: { ok: 1 } }),
      ],
    })
    const started = Date.now()
    const res = await sendWithProof('/c', { method: 'POST', body: '{}' }, { challenge: '/c/challenge', fetchFn })
    expect(res.ok).toBe(true)
    expect(Date.now() - started).toBeGreaterThanOrEqual(45)
    const posts = fetchFn.calls.filter((c) => c.url === '/c')
    expect(posts).toHaveLength(2)
    expect(posts[1].init.headers[PROOF_HEADER]).toBe(posts[0].init.headers[PROOF_HEADER])
    expect(fetchFn.calls.filter((c) => c.url === '/c/challenge')).toHaveLength(1)
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

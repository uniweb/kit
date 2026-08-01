/**
 * Where a form submission goes, and what happens when a site hasn't said.
 *
 * The behaviour under test is the one the previous implementation got wrong: it
 * hardcoded a path, so a form on any deployment without something listening
 * POSTed a visitor's data into a 404 and surfaced it as a generic failure. The
 * three cases below are the ones that has to stay fixed —
 *
 *  - an authored endpoint is used
 *  - no authored endpoint means no request at all, not a request to a guess
 *  - a relative endpoint follows the site's base path, so one spelling in
 *    site.yml works on a root deploy and a subdirectory deploy alike
 *
 * The last is the same class of bug as the search index URL and download links
 * before them: a path used verbatim that silently 404s on every non-root
 * deployment. Base handling is asserted rather than assumed for that reason.
 */

import { submitForm, deriveSummary } from '../src/utils/submitForm.js'
import {
  resolveSubmitTarget,
  resolveAgainstBase,
  NO_SUBMIT_TARGET_REASON,
} from '../src/utils/submitTarget.js'

/** A website whose only relevant surface is `config` + `basePath`. */
function makeWebsite({ submit, forms, basePath = '' } = {}) {
  const config = {}
  if (submit !== undefined) config.submit = submit
  // The host tier lives under `services`, keyed by service name — provenance is
  // structural rather than a naming convention two keys have to keep apart.
  if (forms !== undefined) config.services = { submit: forms }
  return { basePath, config }
}

/** A fetch double that records the call and returns a 200 JSON body. */
function fakeFetch(body = { submissionId: 'abc' }, { ok = true, status = 200 } = {}) {
  const calls = []
  const fn = async (url, init) => {
    calls.push({ url, init })
    return { ok, status, json: async () => body }
  }
  fn.calls = calls
  return fn
}

describe('resolveSubmitTarget', () => {
  it('resolves the shorthand string form', () => {
    const { url, reason, source } = resolveSubmitTarget(makeWebsite({ submit: '/forms' }))
    expect(url).toBe('/forms')
    expect(reason).toBeNull()
    expect(source).toBe('site')
  })

  it('resolves the object form', () => {
    const { url } = resolveSubmitTarget(makeWebsite({ submit: { endpoint: '/forms' } }))
    expect(url).toBe('/forms')
  })

  it('passes an absolute URL through untouched, base path or not', () => {
    const site = makeWebsite({ submit: 'https://forms.example.com/intake', basePath: '/docs' })
    expect(resolveSubmitTarget(site).url).toBe('https://forms.example.com/intake')
  })

  it('reports no target when the site declares none', () => {
    const { url, reason } = resolveSubmitTarget(makeWebsite())
    expect(url).toBeNull()
    expect(reason).toBe(NO_SUBMIT_TARGET_REASON)
  })

  it('treats an empty or blank declaration as no target', () => {
    for (const submit of ['', '   ', {}, { endpoint: '' }, null]) {
      expect(resolveSubmitTarget(makeWebsite({ submit })).url).toBeNull()
    }
  })

  it('survives a website with no config at all', () => {
    expect(resolveSubmitTarget(undefined).url).toBeNull()
    expect(resolveSubmitTarget({}).url).toBeNull()
  })

  // The regression this file exists for.
  it('resolves a relative endpoint against a non-root base', () => {
    const site = makeWebsite({ submit: '/forms', basePath: '/docs' })
    expect(resolveSubmitTarget(site).url).toBe('/docs/forms')
  })

  it('resolves the same whether the endpoint is written with a leading slash', () => {
    const withSlash = makeWebsite({ submit: '/forms', basePath: '/docs' })
    const without = makeWebsite({ submit: 'forms', basePath: '/docs' })
    expect(resolveSubmitTarget(withSlash).url).toBe(resolveSubmitTarget(without).url)
  })

  it('does not double a slash when the base carries a trailing one', () => {
    expect(resolveAgainstBase('/forms', '/docs/')).toBe('/docs/forms')
    expect(resolveAgainstBase('/forms', '')).toBe('/forms')
  })
})

describe('resolveSubmitTarget — a host-supplied destination', () => {
  it('uses the host endpoint when the site declares none', () => {
    const site = makeWebsite({ forms: { endpoint: '/_submit' } })
    expect(resolveSubmitTarget(site)).toMatchObject({ url: '/_submit', reason: null, source: 'host' })
  })

  it('resolves the host endpoint against the base too', () => {
    const site = makeWebsite({ forms: { endpoint: '/_submit' }, basePath: '/gateway/site/abc' })
    expect(resolveSubmitTarget(site).url).toBe('/gateway/site/abc/_submit')
  })

  // Precedence: the operator's own declaration is an override, so a site that
  // names an endpoint keeps it even where the host offers one.
  it('prefers the authored declaration over the host', () => {
    const site = makeWebsite({ submit: '/mine', forms: { endpoint: '/_submit' } })
    expect(resolveSubmitTarget(site).url).toBe('/mine')
  })

  /**
   * A host that declines says why, and that string reaches the visitor
   * unaltered. The framework has no standing to judge or reword the reason, and
   * inventing one in public code would mean encoding someone else's policy here.
   */
  it('relays the host reason verbatim when it supplies no endpoint', () => {
    const site = makeWebsite({ forms: { reason: 'Submissions are turned off for this site.' } })
    expect(resolveSubmitTarget(site)).toMatchObject({
      url: null,
      reason: 'Submissions are turned off for this site.',
      source: 'host',
    })
  })

  it('falls back to the generic reason when the host says nothing useful', () => {
    for (const forms of [undefined, {}, { endpoint: '' }, { reason: '   ' }, null]) {
      expect(resolveSubmitTarget(makeWebsite({ forms })).reason).toBe(NO_SUBMIT_TARGET_REASON)
    }
  })

  it('prefers a host endpoint over a host reason when both are present', () => {
    const site = makeWebsite({ forms: { endpoint: '/_submit', reason: 'ignored' } })
    expect(resolveSubmitTarget(site)).toMatchObject({ url: '/_submit', reason: null, source: 'host' })
  })
})

describe('submitForm', () => {
  it('POSTs JSON to the resolved target', async () => {
    const fetchFn = fakeFetch()
    const result = await submitForm({
      formData: { Name: 'Ada' },
      target: '/docs/forms',
      fetchFn,
    })

    expect(result).toEqual({ submissionId: 'abc' })
    expect(fetchFn.calls).toHaveLength(1)

    const [{ url, init }] = fetchFn.calls
    expect(url).toBe('/docs/forms')
    expect(init.method).toBe('POST')
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(init.body).formData).toEqual({ Name: 'Ada' })
  })

  // The core guarantee: no target means no request, rather than a request to a
  // path the framework picked.
  it('refuses to POST when there is no target', async () => {
    const fetchFn = fakeFetch()
    await expect(submitForm({ formData: { Name: 'Ada' }, fetchFn })).rejects.toThrow(
      /no submission target/i,
    )
    expect(fetchFn.calls).toHaveLength(0)
  })

  it('still requires formData', async () => {
    const fetchFn = fakeFetch()
    await expect(submitForm({ target: '/forms', fetchFn })).rejects.toThrow(/formData/)
    expect(fetchFn.calls).toHaveLength(0)
  })

  it('surfaces the server message on a non-2xx', async () => {
    const fetchFn = fakeFetch({ error: 'Rejected by the endpoint' }, { ok: false, status: 422 })
    await expect(
      submitForm({ formData: { Name: 'Ada' }, target: '/forms', fetchFn }),
    ).rejects.toThrow('Rejected by the endpoint')
  })

  it('falls back to a status-code message when the body is not JSON', async () => {
    const fetchFn = async () => ({
      ok: false,
      status: 500,
      json: async () => { throw new Error('not JSON') },
    })
    await expect(
      submitForm({ formData: { Name: 'Ada' }, target: '/forms', fetchFn }),
    ).rejects.toThrow('HTTP 500')
  })

  /**
   * The API renames `preview` → `summary` and `turnstileToken` →
   * `verificationToken`, but the request body keeps the names deployed
   * endpoints already read. This pins the mapping so a later tidy-up of the
   * "mismatch" fails here instead of in production.
   */
  it('maps the neutral API names onto the existing wire names', async () => {
    const fetchFn = fakeFetch()
    await submitForm({
      formData: { Name: 'Ada' },
      target: '/forms',
      summary: { title: 'Ada', subtitle: 'ada@example.com', tag: 'contact' },
      context: { formId: 'contact', sectionType: 'ContactForm' },
      verificationToken: 'token-123',
      fetchFn,
    })

    const body = JSON.parse(fetchFn.calls[0].init.body)
    expect(body.turnstileToken).toBe('token-123')
    expect(body.metadata).toEqual({
      formId: 'contact',
      sectionType: 'ContactForm',
      preview: { title: 'Ada', subtitle: 'ada@example.com', tag: 'contact' },
    })
    expect(body).not.toHaveProperty('verificationToken')
    expect(body).not.toHaveProperty('summary')
  })

  it('omits the optional wire fields when they are not supplied', async () => {
    const fetchFn = fakeFetch()
    await submitForm({ formData: { Name: 'Ada' }, target: '/forms', fetchFn })

    const body = JSON.parse(fetchFn.calls[0].init.body)
    expect(body).not.toHaveProperty('turnstileToken')
    expect(body).not.toHaveProperty('fileSlots')
  })

  it('sends fileSlots only when the list is non-empty', async () => {
    const fetchFn = fakeFetch()
    await submitForm({ formData: { Name: 'Ada' }, target: '/forms', fileSlots: [], fetchFn })
    expect(JSON.parse(fetchFn.calls[0].init.body)).not.toHaveProperty('fileSlots')

    await submitForm({
      formData: { Name: 'Ada' },
      target: '/forms',
      fileSlots: [{ name: 'cv.pdf', size: 10 }],
      fetchFn,
    })
    expect(JSON.parse(fetchFn.calls[1].init.body).fileSlots).toHaveLength(1)
  })

  it('derives a summary from the values when none is given', async () => {
    const fetchFn = fakeFetch()
    await submitForm({
      formData: { Name: 'Ada', Email: 'ada@example.com' },
      target: '/forms',
      fetchFn,
    })

    expect(JSON.parse(fetchFn.calls[0].init.body).metadata.preview).toEqual({
      title: 'Ada',
      subtitle: 'ada@example.com',
    })
  })
})

describe('deriveSummary', () => {
  it('takes the first two non-empty string values', () => {
    expect(deriveSummary({ a: '', b: 'One', c: '  ', d: 'Two', e: 'Three' })).toEqual({
      title: 'One',
      subtitle: 'Two',
    })
  })

  it('ignores non-string values', () => {
    expect(deriveSummary({ count: 3, ok: true, name: 'Ada' })).toEqual({
      title: 'Ada',
      subtitle: '',
    })
  })

  it('degrades to a placeholder rather than throwing', () => {
    expect(deriveSummary(undefined)).toEqual({ title: 'Submission', subtitle: '' })
    expect(deriveSummary({})).toEqual({ title: 'Submission', subtitle: '' })
  })
})

/**
 * Declaring files is not sending them.
 *
 * `submitForm` sends a `fileSlots` manifest; the second phase — PUT the bytes to
 * the endpoint's `uploadUrls` — is not built. Left silent that is the worst
 * shape a failure takes: the submission succeeds, the text lands, and the
 * attachment is discarded with nothing reporting it. These pin the two places
 * that must not go quiet again.
 */
describe('file uploads — declared, not delivered', () => {
  it('warns when a manifest arrives with no files to send', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fetchFn = fakeFetch()

    await submitForm({
      formData: { Name: 'Ada' },
      target: '/forms',
      fileSlots: [{ name: 'cv.pdf', size: 10, mime: 'application/pdf' }],
      fetchFn,
    })

    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toMatch(/bytes are NOT/)
    warn.mockRestore()
  })

  it('stays quiet when no files are declared', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await submitForm({ formData: { Name: 'Ada' }, target: '/forms', fetchFn: fakeFetch() })
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  // The manifest still rides, so the endpoint's own validation and the eventual
  // second phase both keep working from it.
  it('still sends the manifest — the warning is not a refusal', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fetchFn = fakeFetch()
    await submitForm({
      formData: { Name: 'Ada' },
      target: '/forms',
      fileSlots: [{ name: 'cv.pdf', size: 10 }],
      fetchFn,
    })
    expect(JSON.parse(fetchFn.calls[0].init.body).fileSlots).toHaveLength(1)
    vi.restoreAllMocks()
  })
})

/**
 * Phase two — the bytes.
 *
 * Phase one posts a manifest and gets a submission id; the attachment travels
 * separately so it never rides inside the JSON. The endpoint's shape:
 * `POST {target}/upload` with a raw body and `X-Submission-Id` / `X-Slot`, then
 * `POST {target}/finalize`.
 *
 * The failure cases matter more than the happy one. By the time an upload runs,
 * the submission row already exists — so a silent failure here is the
 * discarded-attachment bug relocated, and a caller must be able to tell the
 * visitor their message landed and their file did not.
 */
const fileOf = (name, type = 'application/pdf') => ({ name, size: 3, type })

function uploadFetch(first = { submissionId: 'sub-1' }) {
  const calls = []
  const fn = async (url, init) => {
    calls.push({ url, init })
    return { ok: true, status: 200, json: async () => first }
  }
  fn.calls = calls
  return fn
}

describe('submitForm — uploading attachments', () => {
  it('posts the manifest, then each file, then finalizes', async () => {
    const fetchFn = uploadFetch()
    const result = await submitForm({
      formData: { Name: 'Ada' },
      target: '/_submit',
      files: [{ file: fileOf('a.pdf'), field: 'photos' }, fileOf('b.png', 'image/png')],
      fetchFn,
    })

    expect(fetchFn.calls.map((c) => c.url)).toEqual([
      '/_submit', '/_submit/upload', '/_submit/upload', '/_submit/finalize',
    ])
    expect(result.filesUploaded).toBe(2)

    // The manifest is derived from the files, so it cannot disagree with them.
    const manifest = JSON.parse(fetchFn.calls[0].init.body).fileSlots
    expect(manifest).toEqual([
      { name: 'a.pdf', size: 3, mime: 'application/pdf', field: 'photos' },
      { name: 'b.png', size: 3, mime: 'image/png' },
    ])

    // X-Slot indexes the manifest, so the two are built in one order.
    const up = fetchFn.calls[1].init
    expect(up.headers['X-Submission-Id']).toBe('sub-1')
    expect(up.headers['X-Slot']).toBe('0')
    expect(up.headers['Content-Type']).toBe('application/pdf')
    expect(up.body.name).toBe('a.pdf') // the File itself, not JSON
    expect(fetchFn.calls[2].init.headers['X-Slot']).toBe('1')
    expect(JSON.parse(fetchFn.calls[3].init.body)).toEqual({ submissionId: 'sub-1' })
  })

  it('prefers uploadUrls when the endpoint returns them', async () => {
    const fetchFn = uploadFetch({ submissionId: 'sub-2', uploadUrls: ['https://r2/put/0'] })
    await submitForm({ formData: { a: '1' }, target: '/_submit', files: [fileOf('a.pdf')], fetchFn })

    expect(fetchFn.calls[1].url).toBe('https://r2/put/0')
  })

  it('skips both extra calls when there are no files', async () => {
    const fetchFn = uploadFetch()
    const r = await submitForm({ formData: { a: '1' }, target: '/_submit', fetchFn })

    expect(fetchFn.calls).toHaveLength(1)
    expect(r.filesUploaded).toBeUndefined()
  })

  it('reports that the submission landed when an upload fails', async () => {
    const calls = []
    const fetchFn = async (url, init) => {
      calls.push(url)
      if (url.endsWith('/upload')) return { ok: false, status: 413, json: async () => ({}) }
      return { ok: true, status: 200, json: async () => ({ submissionId: 'sub-3' }) }
    }
    await expect(
      submitForm({ formData: { a: '1' }, target: '/_submit', files: [fileOf('big.pdf')], fetchFn }),
    ).rejects.toThrow(/sub-3 was recorded, but uploading "big\.pdf" failed \(HTTP 413\)/)
    expect(calls).not.toContain('/_submit/finalize') // never finalize a broken upload
  })

  it('reports a finalize failure without pretending the files did not arrive', async () => {
    const fetchFn = async (url) => {
      if (url.endsWith('/finalize')) return { ok: false, status: 500, json: async () => ({}) }
      return { ok: true, status: 200, json: async () => ({ submissionId: 'sub-4' }) }
    }
    await expect(
      submitForm({ formData: { a: '1' }, target: '/_submit', files: [fileOf('a.pdf')], fetchFn }),
    ).rejects.toThrow(/were uploaded, but finalizing failed/)
  })

  it('refuses to upload when the endpoint returns no submissionId', async () => {
    const fetchFn = uploadFetch({})
    await expect(
      submitForm({ formData: { a: '1' }, target: '/_submit', files: [fileOf('a.pdf')], fetchFn }),
    ).rejects.toThrow(/no submissionId/)
    expect(fetchFn.calls).toHaveLength(1)
  })

  it('ignores a trailing slash on the target when deriving the phase-two paths', async () => {
    const fetchFn = uploadFetch()
    await submitForm({ formData: { a: '1' }, target: '/_submit/', files: [fileOf('a.pdf')], fetchFn })

    // one file → manifest, upload, finalize
    expect(fetchFn.calls.map((c) => c.url)).toEqual([
      '/_submit/', '/_submit/upload', '/_submit/finalize',
    ])
  })
})

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
function makeWebsite({ submit, basePath = '' } = {}) {
  return { basePath, config: submit === undefined ? {} : { submit } }
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
    const { url, reason } = resolveSubmitTarget(makeWebsite({ submit: '/forms' }))
    expect(url).toBe('/forms')
    expect(reason).toBeNull()
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

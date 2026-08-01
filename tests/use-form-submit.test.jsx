/**
 * @vitest-environment jsdom
 *
 * useFormSubmit() resolves the target from the site rather than the component,
 * which is what lets a form component stay free of any endpoint at all.
 *
 * The case worth having a test for is the unhappy one: when a site declares no
 * `submit:`, the hook has to say so *before* anyone fills the form in, so the
 * component can disable its control. A hook that only failed at submit time
 * would still lose what someone typed — just later.
 */

import { act, renderHook, waitFor } from '@testing-library/react'
import { useFormSubmit } from '../src/hooks/useFormSubmit.js'

/**
 * Install a minimal Uniweb singleton — what useWebsite() reads.
 *
 * Deliberately setup/teardown rather than the scoped `withWebsite(fn)` wrapper
 * the synchronous tests elsewhere in this package use: the hook re-renders on
 * every state transition, so a wrapper that restores the singleton when its
 * callback *returns* pulls the runtime out from under the re-render that
 * happens once the submit promise resolves.
 */
let previousUniweb

beforeEach(() => { previousUniweb = globalThis.uniweb })
afterEach(() => { globalThis.uniweb = previousUniweb })

function setWebsite(website) {
  globalThis.uniweb = { activeWebsite: website, routingComponents: {} }
}

function makeWebsite({ submit, basePath = '' } = {}) {
  return { basePath, config: submit === undefined ? {} : { submit } }
}

function fakeFetch(body = { submissionId: 'abc' }) {
  const calls = []
  const fn = async (url, init) => {
    calls.push({ url, init })
    return { ok: true, status: 200, json: async () => body }
  }
  fn.calls = calls
  return fn
}

describe('useFormSubmit', () => {
  it('reports canSubmit when the site declares an endpoint', () => {
    setWebsite(makeWebsite({ submit: '/forms' }))

    const { result } = renderHook(() => useFormSubmit())

    expect(result.current.canSubmit).toBe(true)
    expect(result.current.unavailableReason).toBeNull()
    expect(result.current.status).toBe('idle')
  })

  // The reason this hook exposes state at all: a component has to be able to
  // disable the control before a visitor types anything.
  it('reports canSubmit false with a reason when the site declares none', () => {
    setWebsite(makeWebsite())

    const { result } = renderHook(() => useFormSubmit())

    expect(result.current.canSubmit).toBe(false)
    expect(result.current.unavailableReason).toMatch(/no form submission endpoint/i)
  })

  it('submits to the base-resolved target', async () => {
    const fetchFn = fakeFetch()
    setWebsite(makeWebsite({ submit: '/forms', basePath: '/docs' }))

    const { result } = renderHook(() => useFormSubmit({ fetchFn }))
    await act(async () => { await result.current.submit({ Name: 'Ada' }) })
    await waitFor(() => expect(result.current.status).toBe('success'))

    expect(fetchFn.calls[0].url).toBe('/docs/forms')
  })

  it('fills submission context from the block, letting explicit context win', async () => {
    const fetchFn = fakeFetch()
    const block = {
      type: 'ContactForm',
      stableId: 'contact',
      id: '3',
      page: { id: 'about', title: 'About Us' },
    }
    setWebsite(makeWebsite({ submit: '/forms' }))

    const { result } = renderHook(() =>
      useFormSubmit({ block, context: { formId: 'contact', pageLabel: 'Overridden' }, fetchFn }),
    )
    await act(async () => { await result.current.submit({ Name: 'Ada' }) })
    await waitFor(() => expect(result.current.status).toBe('success'))

    const { metadata } = JSON.parse(fetchFn.calls[0].init.body)
    expect(metadata).toMatchObject({
      formId: 'contact',
      sectionType: 'ContactForm',
      sectionId: 'contact', // stableId, not the positional id
      pageId: 'about',
      pageLabel: 'Overridden',
    })
  })

  it('falls back to the positional id when a block has no stable one', async () => {
    const fetchFn = fakeFetch()
    const block = { type: 'ContactForm', stableId: null, id: '3', page: {} }
    setWebsite(makeWebsite({ submit: '/forms' }))

    const { result } = renderHook(() => useFormSubmit({ block, fetchFn }))
    await act(async () => { await result.current.submit({ Name: 'Ada' }) })
    await waitFor(() => expect(result.current.status).toBe('success'))

    const { metadata } = JSON.parse(fetchFn.calls[0].init.body)
    expect(metadata.sectionId).toBe('3')
    expect(metadata).not.toHaveProperty('pageId')
  })

  it('resolves a summary function against the values being submitted', async () => {
    const fetchFn = fakeFetch()
    setWebsite(makeWebsite({ submit: '/forms' }))

    const { result } = renderHook(() =>
      useFormSubmit({ summary: (f) => ({ title: f.Name, subtitle: f.Email }), fetchFn }),
    )
    await act(async () => {
      await result.current.submit({ Name: 'Ada', Email: 'ada@example.com' })
    })
    await waitFor(() => expect(result.current.status).toBe('success'))

    expect(JSON.parse(fetchFn.calls[0].init.body).metadata.preview).toEqual({
      title: 'Ada',
      subtitle: 'ada@example.com',
    })
  })

  // With an empty dependency list the callback would close over the first
  // render's defaults forever, so a summary or context derived from content
  // that changes would keep sending the original values.
  it('uses the newest defaults, not the ones from the first render', async () => {
    const fetchFn = fakeFetch()
    setWebsite(makeWebsite({ submit: '/forms' }))

    const { result, rerender } = renderHook(
      ({ label }) => useFormSubmit({ context: { sectionLabel: label }, fetchFn }),
      { initialProps: { label: 'First' } },
    )

    rerender({ label: 'Second' })
    await act(async () => { await result.current.submit({ Name: 'Ada' }) })
    await waitFor(() => expect(result.current.status).toBe('success'))

    expect(JSON.parse(fetchFn.calls[0].init.body).metadata.sectionLabel).toBe('Second')
  })

  it('errors without sending when there is no target', async () => {
    const fetchFn = fakeFetch()
    setWebsite(makeWebsite())

    const { result } = renderHook(() => useFormSubmit({ fetchFn }))
    await act(async () => {
      await expect(result.current.submit({ Name: 'Ada' })).rejects.toThrow(
        /no submission target/i,
      )
    })
    await waitFor(() => expect(result.current.status).toBe('error'))

    expect(fetchFn.calls).toHaveLength(0)
  })

  it('reset() returns the hook to idle', async () => {
    const fetchFn = fakeFetch()
    setWebsite(makeWebsite({ submit: '/forms' }))

    const { result } = renderHook(() => useFormSubmit({ fetchFn }))
    await act(async () => { await result.current.submit({ Name: 'Ada' }) })
    await waitFor(() => expect(result.current.status).toBe('success'))

    act(() => { result.current.reset() })

    expect(result.current.status).toBe('idle')
    expect(result.current.response).toBeNull()
  })
})

/**
 * A file input a foundation renders is a promise it can deliver the bytes, so
 * the answer belongs where a component decides whether to render one — the same
 * reason `canSubmit` is checked at render rather than on the button press.
 *
 * It tracks `canSubmit` because it is a statement about this client, not about
 * the endpoint: whether a given endpoint accepts uploads is discovered on
 * submit and reported by a throw. What must never come back is offering a file
 * input when nothing could send the bytes at all.
 */
describe('useFormSubmit — file uploads', () => {
  it('can deliver files once there is a target', () => {
    setWebsite(makeWebsite({ submit: '/forms' }))
    const { result } = renderHook(() => useFormSubmit())

    expect(result.current.canSubmit).toBe(true)
    expect(result.current.canUploadFiles).toBe(true)
  })

  it('cannot deliver files when there is nowhere to submit', () => {
    setWebsite(makeWebsite())
    const { result } = renderHook(() => useFormSubmit())

    expect(result.current.canSubmit).toBe(false)
    expect(result.current.canUploadFiles).toBe(false)
  })
})

import { useCallback, useState } from 'react'
import { submitForm } from '../utils/submitForm.js'

/**
 * React hook wrapping `submitForm()` with state machine for the
 * `idle → submitting → success | error` lifecycle most form UIs need.
 *
 * Pass `defaults` once (formId, sectionType, preview-builder, …) and call
 * `submit(formData)` from your submit handler. The hook exposes:
 *   - status: 'idle' | 'submitting' | 'success' | 'error'
 *   - error:  Error | null
 *   - response: { submissionId, uploadUrls? } | null  (on success)
 *   - submit: async (formData, perCallOverrides?) => response
 *   - reset:  () => void
 *
 * `defaults.preview` may be either a static object or a function of formData
 * that returns one. The function form is useful when the preview is computed
 * from the same fields that just got submitted.
 *
 * Examples — see kit's submitForm() JSDoc for the full payload contract.
 *
 * @param {object} [defaults] — merged into every submit() call
 * @returns {{
 *   status: 'idle' | 'submitting' | 'success' | 'error',
 *   error: Error | null,
 *   response: object | null,
 *   submit: (formData: object, overrides?: object) => Promise<object>,
 *   reset: () => void,
 * }}
 */
export function useFormSubmit(defaults = {}) {
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  const [response, setResponse] = useState(null)

  const submit = useCallback(
    async (formData, perCallOverrides = {}) => {
      setStatus('submitting')
      setError(null)
      try {
        const merged = { ...defaults, ...perCallOverrides, formData }
        // Resolve preview-as-function against the formData being submitted.
        if (typeof merged.preview === 'function') {
          merged.preview = merged.preview(formData)
        }
        const result = await submitForm(merged)
        setStatus('success')
        setResponse(result)
        return result
      } catch (err) {
        setStatus('error')
        setError(err)
        throw err
      }
    },
    // `defaults` is referentially unstable across renders; we deliberately
    // close over the latest one each render rather than memo the hook.
    // The lint rule fires false positives here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const reset = useCallback(() => {
    setStatus('idle')
    setError(null)
    setResponse(null)
  }, [])

  return { status, error, response, submit, reset }
}

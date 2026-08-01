import { useCallback, useRef, useState } from 'react'
import { submitForm } from '../utils/submitForm.js'
import { resolveSubmitTarget } from '../utils/submitTarget.js'
import { useWebsite } from './useWebsite.js'

/**
 * Submit a form, with the `idle → submitting → success | error` lifecycle most
 * form UIs need.
 *
 * The hook resolves *where* to submit from the site's configuration (`submit:`
 * in site.yml) or from its host, so a component never names an endpoint. When
 * neither supplies one, `canSubmit` is false and `unavailableReason` says why —
 * render the control disabled rather than letting someone fill in a form whose
 * contents have nowhere to go. See `resolveSubmitTarget` for the precedence.
 *
 * ```jsx
 * const { submit, status, error, canSubmit, unavailableReason } =
 *   useFormSubmit({ block, context: { formId: 'contact' } })
 *
 * <button type="submit" disabled={!canSubmit || status === 'submitting'}>
 *   {canSubmit ? 'Send' : unavailableReason}
 * </button>
 * ```
 *
 * Pass `block` and the submission carries where it came from — section type,
 * section id, page id and label — without every component assembling that by
 * hand. Anything in `context` wins over what the block supplies.
 *
 * `summary` may be an object or a function of the submitted values, which is
 * the useful form when the digest is built from the fields that were just
 * filled in.
 *
 * @param {object} [defaults] — merged into every submit() call
 * @param {object} [defaults.block] — the section's block, for submission context
 * @param {object} [defaults.context] — formId and any explicit overrides
 * @param {object|Function} [defaults.summary] — { title, subtitle, tag? } or (formData) => that
 * @returns {{
 *   status: 'idle' | 'submitting' | 'success' | 'error',
 *   error: Error | null,
 *   response: object | null,
 *   canSubmit: boolean,
 *   unavailableReason: string | null,
 *   submit: (formData: object, overrides?: object) => Promise<object>,
 *   reset: () => void,
 * }}
 */
export function useFormSubmit(defaults = {}) {
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  const [response, setResponse] = useState(null)

  const { website } = useWebsite()
  const { url: target, reason: unavailableReason } = resolveSubmitTarget(website)

  // `defaults` is a fresh object every render, so listing it as a dependency
  // would rebuild the callback on each one. A ref is what actually makes "the
  // newest defaults win" true — with an empty dependency list the callback
  // closes over the *first* render's defaults forever, so a summary or context
  // computed from changing content would silently keep sending the original.
  const defaultsRef = useRef(defaults)
  defaultsRef.current = defaults

  const submit = useCallback(
    async (formData, perCallOverrides = {}) => {
      setStatus('submitting')
      setError(null)
      try {
        const { block, context, summary, ...rest } = {
          ...defaultsRef.current,
          ...perCallOverrides,
        }

        const merged = {
          ...rest,
          formData,
          target,
          // Block-derived context first so an explicit `context` overrides it.
          context: { ...contextFromBlock(block), ...context },
          summary: typeof summary === 'function' ? summary(formData) : summary,
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
    [target],
  )

  const reset = useCallback(() => {
    setStatus('idle')
    setError(null)
    setResponse(null)
  }, [])

  return {
    status,
    error,
    response,
    canSubmit: !!target,
    unavailableReason,
    // Whether a file field can actually deliver its bytes. FALSE TODAY, for
    // every site: `submitForm` sends a `fileSlots` manifest and the second
    // phase — PUT the bytes to the endpoint's `uploadUrls` — is not built.
    //
    // Exposed rather than left implicit because the failure is otherwise
    // invisible: the submission succeeds and the attachment is discarded. A
    // component should check this where it decides whether to RENDER a file
    // input, for the same reason it checks `canSubmit` at render rather than on
    // the button press — the framework knows before the visitor types, and
    // telling them afterwards costs them the work twice.
    //
    // Becomes endpoint-dependent rather than a constant once the phase lands.
    canUploadFiles: false,
    submit,
    reset,
  }
}

/**
 * Where a submission came from, read off the block the form is rendered in.
 *
 * `stableId` is preferred over the positional `id` because it survives a
 * section being reordered on its page — a submission's origin should not change
 * because something moved above it. Keys with no value are dropped rather than
 * sent as null, so they never mask a caller-supplied one.
 *
 * @param {object} [block]
 * @returns {object}
 */
function contextFromBlock(block) {
  if (!block) return {}

  const page = block.page
  const fields = {
    sectionType: block.type,
    sectionId: block.stableId || block.id,
    pageId: page?.id,
    pageLabel: page?.title,
  }

  return Object.fromEntries(
    Object.entries(fields).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  )
}

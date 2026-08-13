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
 * neither supplies one, `canSubmit` is false — don't render a form whose
 * contents have nowhere to go. See `resolveSubmitTarget` for the precedence.
 *
 * ```jsx
 * const { submit, status, error, canSubmit } =
 *   useFormSubmit({ block, context: { formId: 'contact' } })
 *
 * if (!canSubmit) return null      // or fall back to contact details the
 *                                  // site already carries in its content
 *
 * <button type="submit" disabled={status === 'submitting'}>Send</button>
 * ```
 *
 * ⛔ **There is no `unavailableReason`, and there was one — it was a mistake.**
 * It carried a canned English sentence and this very example rendered it as
 * button copy. A visitor has no stake in which services the operator bought,
 * the string reads like a breakage when nothing is broken, and it cannot be
 * translated on a framework whose sites are usually multilingual and often not
 * English. Text a visitor reads is *site content*. `canSubmit` is the whole
 * signal.
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
 *   submit: (formData: object, overrides?: object) => Promise<object>,
 *   reset: () => void,
 * }}
 */
export function useFormSubmit(defaults = {}) {
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  const [response, setResponse] = useState(null)

  const { website } = useWebsite()
  const { url: target } = resolveSubmitTarget(website)

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
    // Whether attachments can be delivered. True once there is a target: the
    // client sends the manifest, then the bytes, then finalizes.
    //
    // It tracks `canSubmit` because it is a statement about THIS client, not
    // about the endpoint — whether a given endpoint accepts uploads is
    // discovered on submit, and a failure there throws with a message saying
    // the submission landed and the attachment did not. What this rules out is
    // the case that has no honest report: offering a file input when nothing
    // could ever send the bytes.
    //
    // Kept as its own field rather than folded into `canSubmit` because a
    // component decides *whether to render a file input* separately from
    // whether to render the form, and that decision belongs at render time.
    canUploadFiles: !!target,
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

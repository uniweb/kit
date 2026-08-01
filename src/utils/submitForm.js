/**
 * POST a form's values to a submission endpoint.
 *
 * This is the low-level companion of `useFormSubmit()`. Most components want
 * the hook — it resolves the target from the site's configuration and tracks
 * the request's lifecycle. Reach for this directly when you are submitting
 * outside React, or already hold a resolved target.
 *
 * ## `target` is required, and there is no default
 *
 * Where a site's submissions go is the site's declaration (`submit:` in
 * site.yml — see `resolveSubmitTarget`), never this function's guess. Calling
 * without a target throws rather than falling back to a path, because a form
 * POSTing into a 404 loses what a visitor typed and reports success-shaped
 * failure. Resolve first, disable the control if there is nowhere to send.
 *
 * ## API names and wire names differ, on purpose
 *
 * The request body's field names are a contract with already-deployed
 * endpoints, so they are kept exactly as those endpoints read them. This
 * function's *arguments* are named for what they mean to a foundation
 * developer. The mapping is applied in one place below and is not a bug to
 * tidy up — changing the body's spelling would require every deployed endpoint
 * to change with it.
 *
 * @param {object} args
 * @param {Record<string, unknown>} args.formData  — field values
 * @param {string} args.target                     — resolved endpoint URL (required)
 * @param {object} [args.summary]                  — { title, subtitle, tag? }, a short
 *                                                   human-readable digest of this
 *                                                   submission; derived from formData
 *                                                   when omitted
 * @param {object} [args.context]                  — where the submission came from:
 *                                                   formId, sectionType, sectionId,
 *                                                   pageId, pageLabel
 * @param {string} [args.verificationToken]        — bot-protection token, when the
 *                                                   endpoint verifies one
 * @param {Array<{name:string,size:number,mime?:string}>} [args.fileSlots]
 *                                                 — declared file uploads
 * @param {typeof fetch} [args.fetchFn=fetch]      — fetch override (testing / SSR)
 *
 * @returns {Promise<{ submissionId: string, uploadUrls?: Array }>}
 * @throws {Error} with no target, and on non-2xx with the server's message when present.
 */
export async function submitForm({
  formData,
  target,
  summary,
  context = {},
  verificationToken,
  fileSlots,
  fetchFn = typeof fetch === 'function' ? fetch : null,
} = {}) {
  if (!formData || typeof formData !== 'object') {
    throw new Error('submitForm: formData object is required')
  }
  if (!target || typeof target !== 'string') {
    throw new Error(
      'submitForm: no submission target. Declare `submit:` in site.yml, or ' +
      'check `canSubmit` from useFormSubmit() before calling.',
    )
  }
  if (!fetchFn) {
    throw new Error('submitForm: fetch is unavailable in this environment')
  }

  // ── API name → wire name. See the header before "correcting" these. ──
  const body = {
    formData,
    metadata: { ...context, preview: summary || deriveSummary(formData) },
    ...(verificationToken ? { turnstileToken: verificationToken } : {}),
    ...(Array.isArray(fileSlots) && fileSlots.length ? { fileSlots } : {}),
  }

  const res = await fetchFn(target, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    let serverMessage
    try { serverMessage = (await res.json()).error } catch { /* not JSON */ }
    throw new Error(serverMessage || `Submission failed (HTTP ${res.status})`)
  }

  return res.json()
}

/**
 * Build a default summary from a form's values: the first two non-empty string
 * fields become the title and subtitle, so whoever reads submissions sees
 * something meaningful even when a component passes no summary of its own.
 *
 * @param {Record<string, unknown>} data
 * @returns {{ title: string, subtitle: string }}
 */
export function deriveSummary(data) {
  if (!data || typeof data !== 'object') return { title: 'Submission', subtitle: '' }
  const entries = Object.entries(data).filter(
    ([, v]) => typeof v === 'string' && v.trim().length > 0,
  )
  return {
    title: entries[0]?.[1] || 'Submission',
    subtitle: entries[1]?.[1] || '',
  }
}

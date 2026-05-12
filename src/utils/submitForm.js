/**
 * Submit a form to the Uniweb submission endpoint.
 *
 * Form components in a foundation collect field values and call this to
 * deliver them to the platform's submission pipeline. The submission lands
 * keyed by the site's identity (resolved by the platform from the
 * visitor's hostname), so this function takes no siteId — the page's
 * own URL determines the destination.
 *
 * The default `submitPath` is `/_submit`, served on the visitor's hostname
 * by the Uniweb runtime infrastructure. Override only if you're testing
 * against a non-standard endpoint.
 *
 * The `preview` object becomes the {title, subtitle, tag} that the
 * editor's inbox row displays for this submission. If a foundation
 * doesn't pass one, a fallback is derived from the first two non-empty
 * string fields of `formData` so the row is always meaningful.
 *
 * Optional `turnstileToken` is forwarded as-is for bot-protection
 * verification when the platform has Turnstile enabled.
 *
 * @param {object} args
 * @param {Record<string, unknown>} args.formData      — field values
 * @param {object} [args.preview]                       — { title, subtitle, tag? }
 * @param {object} [args.metadata]                      — formId, sectionType, sectionId, pageId, pageLabel, …
 * @param {string} [args.turnstileToken]                — Cloudflare Turnstile token
 * @param {Array<{name:string,size:number,mime?:string}>} [args.fileSlots]
 *                                                       — declared file uploads (multi-step ingestion)
 * @param {string} [args.submitPath='/_submit']         — endpoint override (testing)
 * @param {typeof fetch} [args.fetchFn=fetch]           — fetch override (testing / SSR)
 *
 * @returns {Promise<{ submissionId: string, uploadUrls?: Array }>}
 * @throws {Error} on non-2xx with the server's `error` message when present.
 */
export async function submitForm({
  formData,
  preview,
  metadata = {},
  turnstileToken,
  fileSlots,
  submitPath = '/_submit',
  fetchFn = typeof fetch === 'function' ? fetch : null,
} = {}) {
  if (!formData || typeof formData !== 'object') {
    throw new Error('submitForm: formData object is required')
  }
  if (!fetchFn) {
    throw new Error('submitForm: fetch is unavailable in this environment')
  }

  const finalPreview = preview || derivePreviewFromFormData(formData)

  const body = {
    formData,
    metadata: { ...metadata, preview: finalPreview },
    ...(turnstileToken ? { turnstileToken } : {}),
    ...(Array.isArray(fileSlots) && fileSlots.length ? { fileSlots } : {}),
  }

  const res = await fetchFn(submitPath, {
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
 * Build a default preview from a form's field values: first two non-empty
 * string fields become the title / subtitle. Mirrors the legacy
 * getStandardPreview() convention from the prior Form class.
 *
 * @param {Record<string, unknown>} data
 * @returns {{ title: string, subtitle: string }}
 */
export function derivePreviewFromFormData(data) {
  if (!data || typeof data !== 'object') return { title: 'Submission', subtitle: '' }
  const entries = Object.entries(data).filter(
    ([, v]) => typeof v === 'string' && v.trim().length > 0,
  )
  return {
    title: entries[0]?.[1] || 'Submission',
    subtitle: entries[1]?.[1] || '',
  }
}

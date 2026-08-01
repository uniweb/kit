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
 * @param {Array<File|{file:File,field?:string}>} [args.files]
 *                                                 — attachments to upload. The
 *                                                   manifest is derived from
 *                                                   these; phase two sends the
 *                                                   bytes. The `{file, field}`
 *                                                   form records which field an
 *                                                   attachment came from.
 * @param {Array<{name:string,size:number,mime?:string}>} [args.fileSlots]
 *                                                 — a manifest with no bytes.
 *                                                   Accepted, but ONLY sends the
 *                                                   declaration; prefer `files`
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
  files,
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

  const entries = normalizeFiles(files)

  // A manifest without the files it describes cannot be delivered — the bytes
  // are what phase two sends. Passing `fileSlots` alone declares attachments
  // nobody receives, which is a success that is not one, so say so.
  if (entries.length === 0 && Array.isArray(fileSlots) && fileSlots.length > 0) {
    console.warn(
      `[uniweb] submitForm: ${fileSlots.length} file(s) declared via \`fileSlots\` with no ` +
      '`files` — the manifest is sent and the bytes are NOT. Pass `files` so they upload.',
    )
  }

  const slots = entries.length
    ? entries.map(({ file, field }) => ({
        name: file.name,
        size: file.size,
        mime: file.type || 'application/octet-stream',
        ...(field ? { field } : {}),
      }))
    : fileSlots

  // ── API name → wire name. See the header before "correcting" these. ──
  const body = {
    formData,
    metadata: { ...context, preview: summary || deriveSummary(formData) },
    ...(verificationToken ? { turnstileToken: verificationToken } : {}),
    ...(Array.isArray(slots) && slots.length ? { fileSlots: slots } : {}),
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

  const result = await res.json()

  // A submission with no attachments is COMPLETE at this point — the create
  // call wrote the whole record. Finalizing anyway would re-assert the state it
  // already has: accepted, and pointless.
  if (entries.length === 0) return result

  const report = await uploadFiles(entries, result, target, fetchFn)
  return { ...result, filesUploaded: entries.length, ...report }
}

/**
 * Accept either bare `File`s or `{ file, field }` pairs, and drop anything that
 * is not a file. The pair form exists so a submission can say WHICH field an
 * attachment came from — a form may have more than one file input.
 */
function normalizeFiles(files) {
  if (!Array.isArray(files)) return []
  return files
    .map((f) => (f && typeof f === 'object' && 'file' in f ? f : { file: f }))
    .filter(({ file }) => file && typeof file === 'object' && 'name' in file)
}

/**
 * Phase two — send the bytes.
 *
 * Phase one posts a *manifest* and gets back a submission id; the bytes go
 * separately so they never ride inside the JSON. Two shapes are honoured:
 *
 *  - **`uploadUrls` in the response** — one per slot, in slot order. Used when
 *    present, because an endpoint returning them is telling you where to write.
 *  - **Otherwise `{target}/upload`** — raw body, `X-Submission-Id` and `X-Slot`
 *    headers, then `{target}/finalize`. This is the shape the endpoint
 *    documents, and it is the default rather than a fallback.
 *
 * `X-Slot` is the **0-based index into the manifest sent in phase one** — which
 * is why the entries and the slots are built from one list in one order, and
 * why nothing here reorders them. An endpoint bounds it to the declared count
 * and rejects anything outside the range.
 *
 * The filename is NOT sent as a header. It travels in the manifest, which is
 * the contract; an endpoint takes the name from there.
 *
 * **Failures throw, and the message says what did land.** The submission row
 * already exists at this point, so a silent failure here is the same
 * discarded-attachment bug in a new place — a caller must be able to tell the
 * visitor that their message arrived and their file did not.
 */
async function uploadFiles(entries, result, target, fetchFn) {
  const submissionId = result?.submissionId
  if (!submissionId) {
    throw new Error(
      'submitForm: the submission was recorded but returned no submissionId, so its ' +
      `${entries.length} attachment(s) could not be uploaded.`,
    )
  }

  const base = String(target).replace(/\/+$/, '')
  const urls = Array.isArray(result?.uploadUrls) ? result.uploadUrls : []

  for (const [slot, { file }] of entries.entries()) {
    const url = urls[slot] || `${base}/upload`
    let res
    try {
      res = await fetchFn(url, {
        method: 'POST',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          'X-Submission-Id': submissionId,
          'X-Slot': String(slot),
        },
        body: file,
      })
    } catch (err) {
      throw new Error(
        `submitForm: submission ${submissionId} was recorded, but uploading ` +
        `"${file.name}" failed — ${err.message}`,
      )
    }
    if (!res.ok) {
      throw new Error(
        `submitForm: submission ${submissionId} was recorded, but uploading ` +
        `"${file.name}" failed (HTTP ${res.status}).`,
      )
    }
  }

  // The manifest rides the finalize body as well as the create body. An
  // endpoint may or may not trust it — the one we are built against verifies
  // each slot against storage instead, precisely because a client-supplied
  // count is what a quota or an invoice would otherwise derive from. Sending it
  // costs a few bytes and satisfies the stricter reading of the contract, in
  // which `files` is required and its absence is a malformed call.
  const manifest = entries.map(({ file }, slot) => ({
    slot,
    name: file.name,
    size: file.size,
    mime: file.type || 'application/octet-stream',
  }))

  const done = await fetchFn(`${base}/finalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ submissionId, files: manifest }),
  })
  if (!done.ok) {
    throw new Error(
      `submitForm: submission ${submissionId} and its ${entries.length} attachment(s) ` +
      `were uploaded, but finalizing failed (HTTP ${done.status}).`,
    )
  }

  // Finalize reports what the endpoint actually found in storage, which is not
  // necessarily what we believe we sent. Checking it is the whole point of
  // reading this body: every upload can return 2xx and one can still be absent,
  // and the alternative to catching it here is a support ticket about an
  // attachment nobody received.
  //
  // Only acted on when the endpoint reports a number — an endpoint that returns
  // nothing (or something else) is not thereby claiming a loss.
  let report
  try {
    report = await done.json()
  } catch {
    return undefined // not JSON — nothing to verify against
  }

  const recorded = report?.filesRecorded
  if (typeof recorded === 'number' && recorded < entries.length) {
    throw new Error(
      `submitForm: submission ${submissionId} was recorded, but only ${recorded} of ` +
      `${entries.length} attachment(s) reached storage. The endpoint verifies each upload, ` +
      'so the difference did not arrive.',
    )
  }

  return report && typeof report === 'object' ? report : undefined
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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/**
 * Hold the values of a form an AUTHOR designed, so a foundation only writes the
 * part that is actually its own — the controls.
 *
 * An authored form arrives as content (a ```` ```yaml:form ```` block at
 * `content.data.form`), which makes a form-rendering component the inverse of
 * every other one: it does not declare the fields, it receives them and draws
 * whatever it is given. Everything between "receive a list of controls" and
 * "call submit" is then identical in every such component — seeding defaults,
 * tracking edits, spotting what is still empty, keeping files out of the JSON.
 * That is undifferentiated boilerplate, and it is what this owns.
 *
 * What it deliberately does NOT own is the rendering. Which control a `type`
 * maps to, how it looks, how an error reads — that is the foundation's design
 * and its whole reason for existing. Same split as `useCollectionQueryable`:
 * the kit hands over the metadata and the state, the foundation builds the
 * controls against them.
 *
 * ```jsx
 * const { controls, values, setValue, missing, formData, files } =
 *   useFormValues(content.data.form)
 * const { submit, canSubmit, status } = useFormSubmit({ block })
 *
 * {controls.map((c) => (
 *   <MyControl key={c.path} control={c}
 *              value={valueAt(values, c.path)}
 *              onChange={(v) => setValue(c.path, v)} />
 * ))}
 *
 * <button disabled={!canSubmit || missing.length > 0 || status === 'submitting'}
 *         onClick={() => submit(formData, { files })}>Send</button>
 * ```
 *
 * ## Three returned shapes, because they are three different things
 *
 * `values` is what the UI binds to and holds whatever was set, `File` objects
 * included, so a file input can show its selection. `formData` is what you
 * submit. They differ for one reason that would otherwise be a silent data-
 * shaped failure: `submitForm` sends `formData` through `JSON.stringify`, and a
 * `File` serializes to `{}` — the attachment would appear to have been sent and
 * would arrive empty. So file controls are **omitted from `formData`** and ride
 * in `files` instead, each tagged with the control it came from. That tag is
 * the `{ file, field }` shape `submitForm` accepts precisely so a form with two
 * file inputs can say which is which; hand-rolled callers pass bare `File`s and
 * silently lose the attribution.
 *
 * ## `missing` is computed, not enforced
 *
 * It lists the paths of `required` controls that are still empty. It does not
 * block anything: whether an incomplete form disables the button, shows a
 * message, or submits anyway is a design decision. `useFormSubmit` draws the
 * same line with `canSubmit` / `unavailableReason` — the kit works out the
 * fact, the foundation decides what it looks like.
 *
 * Empty means `undefined`, `null`, `''`, or `[]`. A `false` boolean is a VALUE,
 * so a required checkbox that is unchecked is not "missing" — "must be ticked"
 * is a stronger rule than `required` and belongs to the component that knows it
 * is a consent box.
 *
 * ## Both authored shapes
 *
 * Accepts a list of controls, and also the older map keyed by control name —
 * during a transition both exist in content, and a hook that handled one would
 * be unusable with the other. A map is normalized to a list, taking each key as
 * the control's `name`.
 *
 * @param {Array<object>|object} definition — `content.data.form`
 * @returns {{
 *   controls: Array<object>,
 *   values: object,
 *   setValue: (path: string, value: unknown) => void,
 *   reset: () => void,
 *   missing: string[],
 *   formData: object,
 *   files: Array<{ file: File, field: string }>,
 * }}
 */
export function useFormValues(definition) {
  const controls = useMemo(() => flatten(normalize(definition)), [definition])
  const initial = useMemo(() => seed(controls), [controls])

  const [values, setValues] = useState(initial)

  // Re-seed when the DEFINITION changes, not on every render. An author editing
  // the form in the visual app changes it under a mounted component, and values
  // keyed to controls that no longer exist would linger in the payload.
  const seededFrom = useRef(initial)
  useEffect(() => {
    if (seededFrom.current !== initial) {
      seededFrom.current = initial
      setValues(initial)
    }
  }, [initial])

  const setValue = useCallback((path, value) => {
    setValues((prev) => setIn(prev, String(path).split('.'), value))
  }, [])

  const reset = useCallback(() => setValues(seededFrom.current), [])

  const missing = useMemo(
    () => controls.filter((c) => c.required && isEmpty(valueAt(values, c.path))).map((c) => c.path),
    [controls, values],
  )

  const { formData, files } = useMemo(() => split(controls, values), [controls, values])

  return { controls, values, setValue, reset, missing, formData, files }
}

/**
 * Read a value out of the nested `values` by dotted path — the companion of
 * `setValue`, exported because a component rendering a control needs it and
 * would otherwise write the same three lines.
 */
export function valueAt(values, path) {
  return String(path)
    .split('.')
    .reduce((node, key) => (node == null ? undefined : node[key]), values)
}

// --- internals ---------------------------------------------------------------

// A list as authored, or the older map keyed by control name.
function normalize(definition) {
  if (Array.isArray(definition)) return definition.filter(isRecord)
  if (isRecord(definition)) {
    return Object.entries(definition)
      .filter(([, spec]) => isRecord(spec))
      .map(([name, spec]) => ({ name, ...spec }))
  }
  return []
}

/**
 * Depth-first list of every control, each carrying the dotted `path` its value
 * lives at. A container (`children`) contributes a nested object rather than a
 * value of its own, which is why `group` is the author-facing spelling of
 * `object`: a fieldset's answers nest exactly as the type says they do.
 */
function flatten(list, prefix = '') {
  const out = []
  for (const control of list) {
    const name = control?.name
    if (typeof name !== 'string' || !name) continue // unaddressable — cannot hold a value
    const path = prefix ? `${prefix}.${name}` : name
    const children = Array.isArray(control.children) ? control.children : null
    out.push({ ...control, path, isGroup: !!children })
    if (children) out.push(...flatten(children, path))
  }
  return out
}

function seed(controls) {
  let out = {}
  for (const control of controls) {
    if (control.isGroup) continue // its shape comes from its children
    if (control.default === undefined) continue
    out = setIn(out, control.path.split('.'), control.default)
  }
  return out
}

// Immutable nested set; creates the intermediate objects a group needs.
function setIn(node, [key, ...rest], value) {
  const base = isRecord(node) ? node : {}
  if (rest.length === 0) return { ...base, [key]: value }
  return { ...base, [key]: setIn(base[key], rest, value) }
}

/**
 * Split the held values into what is submitted and what is uploaded.
 *
 * File controls are omitted from `formData` rather than serialized: they would
 * become `{}` and report an attachment nobody received. Their attribution is
 * carried on each file entry's `field`, which is what the endpoint reads.
 */
function split(controls, values) {
  const files = []
  let formData = {}

  for (const control of controls) {
    if (control.isGroup) continue
    const value = valueAt(values, control.path)
    if (value === undefined) continue

    if (control.type === 'file') {
      for (const file of [].concat(value).filter(isFile)) {
        files.push({ file, field: control.path })
      }
      continue
    }
    formData = setIn(formData, control.path.split('.'), value)
  }

  return { formData, files }
}

function isEmpty(value) {
  if (value === undefined || value === null || value === '') return true
  return Array.isArray(value) && value.length === 0
}

function isFile(value) {
  // Duck-typed rather than `instanceof File`: this runs under SSR and in tests
  // where the constructor may not exist, and `submitForm` checks the same way.
  return !!value && typeof value === 'object' && 'name' in value && 'size' in value
}

function isRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

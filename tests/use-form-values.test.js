/**
 * @vitest-environment jsdom
 *
 * `useFormValues` — the state of a form an AUTHOR designed.
 *
 * Two things are worth stating about what these assert, because both are the
 * reason the hook exists rather than incidental behaviour:
 *
 * 1. **`File`s never reach `formData`.** `submitForm` sends it through
 *    `JSON.stringify`, where a `File` becomes `{}` — an attachment that appears
 *    to have been sent and arrives empty. That is a success-shaped failure, the
 *    worst kind, and it is invisible to the component that caused it.
 * 2. **Each file is tagged with the control it came from.** `submitForm` accepts
 *    `{ file, field }` precisely so a form with two file inputs can say which is
 *    which; a hand-rolled component passes bare `File`s and silently loses that.
 */

import { describe, expect, it } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFormValues, valueAt } from '../src/hooks/useFormValues.js'

// A stand-in for a browser File — duck-typed the same way submitForm checks.
const file = (name, size = 10) => ({ name, size, type: 'image/png' })

const CONTROLS = [
  { name: 'email', type: 'string', required: true },
  { name: 'plan', type: 'string', default: 'free' },
  { name: 'agree', type: 'bool', default: false },
  { name: 'photos', type: 'file', multiple: true },
]

const render = (definition) => renderHook(() => useFormValues(definition))

describe('seeding from `default`', () => {
  it('seeds declared defaults and leaves the rest absent', () => {
    const { result } = render(CONTROLS)
    expect(result.current.values).toEqual({ plan: 'free', agree: false })
  })

  it('re-seeds when the DEFINITION changes, dropping values for controls that went away', () => {
    // An author editing the form in the visual app changes it under a mounted
    // component; values keyed to controls that no longer exist would otherwise
    // linger in the payload.
    const { result, rerender } = renderHook(({ d }) => useFormValues(d), {
      initialProps: { d: CONTROLS },
    })
    act(() => result.current.setValue('email', 'a@b.co'))
    expect(result.current.values.email).toBe('a@b.co')

    rerender({ d: [{ name: 'other', type: 'string', default: 'x' }] })
    expect(result.current.values).toEqual({ other: 'x' })
  })

  it('does not re-seed on an unrelated re-render', () => {
    const { result, rerender } = renderHook(({ d }) => useFormValues(d), {
      initialProps: { d: CONTROLS },
    })
    act(() => result.current.setValue('email', 'a@b.co'))
    rerender({ d: CONTROLS })
    expect(result.current.values.email).toBe('a@b.co')
  })
})

describe('editing', () => {
  it('setValue and reset', () => {
    const { result } = render(CONTROLS)
    act(() => result.current.setValue('plan', 'pro'))
    expect(result.current.values.plan).toBe('pro')
    act(() => result.current.reset())
    expect(result.current.values.plan).toBe('free')
  })

  it('does not mutate the previous values object', () => {
    const { result } = render(CONTROLS)
    const before = result.current.values
    act(() => result.current.setValue('plan', 'pro'))
    expect(before.plan).toBe('free')
  })
})

describe('`missing` is computed, not enforced', () => {
  it('lists required controls that are still empty', () => {
    const { result } = render(CONTROLS)
    expect(result.current.missing).toEqual(['email'])
    act(() => result.current.setValue('email', 'a@b.co'))
    expect(result.current.missing).toEqual([])
  })

  it('treats `false` as a value, not as missing', () => {
    // A required checkbox that is unchecked is not "missing" — "must be ticked"
    // is a stronger rule than `required` and belongs to the component that knows
    // it is a consent box.
    const { result } = render([{ name: 'agree', type: 'bool', required: true, default: false }])
    expect(result.current.missing).toEqual([])
  })

  it('treats an empty list as missing', () => {
    const { result } = render([{ name: 'tags', type: 'string', many: true, required: true, default: [] }])
    expect(result.current.missing).toEqual(['tags'])
  })
})

describe('files never reach formData', () => {
  it('extracts them, tagged with the control they came from', () => {
    const { result } = render(CONTROLS)
    const a = file('a.png')
    act(() => result.current.setValue('photos', [a, file('b.png')]))

    expect(result.current.files).toEqual([
      { file: a, field: 'photos' },
      { file: result.current.values.photos[1], field: 'photos' },
    ])
    expect(result.current.formData).not.toHaveProperty('photos')
  })

  it('and formData survives JSON.stringify with nothing hollowed out', () => {
    // The actual failure this prevents: a File in formData serializes to `{}`.
    const { result } = render(CONTROLS)
    act(() => {
      result.current.setValue('email', 'a@b.co')
      result.current.setValue('photos', [file('a.png')])
    })
    const round = JSON.parse(JSON.stringify(result.current.formData))
    expect(round).toEqual({ email: 'a@b.co', plan: 'free', agree: false })
  })

  it('keeps the File in `values` so the input can show its selection', () => {
    const { result } = render(CONTROLS)
    act(() => result.current.setValue('photos', [file('a.png')]))
    expect(result.current.values.photos[0].name).toBe('a.png')
  })

  it('tags two file controls distinctly', () => {
    const { result } = render([
      { name: 'front', type: 'file' },
      { name: 'back', type: 'file' },
    ])
    act(() => {
      result.current.setValue('front', file('f.png'))
      result.current.setValue('back', file('b.png'))
    })
    expect(result.current.files.map((f) => f.field)).toEqual(['front', 'back'])
  })
})

describe('containers nest, as `group` → `object` says they do', () => {
  const NESTED = [
    { name: 'email', type: 'string' },
    {
      name: 'address',
      type: 'group',
      children: [
        { name: 'street', type: 'string', required: true },
        { name: 'city', type: 'string', default: 'Ottawa' },
      ],
    },
  ]

  it('seeds and submits nested values', () => {
    const { result } = render(NESTED)
    expect(result.current.values).toEqual({ address: { city: 'Ottawa' } })
    act(() => result.current.setValue('address.street', 'Main St'))
    expect(result.current.formData).toEqual({ address: { street: 'Main St', city: 'Ottawa' } })
  })

  it('reports a missing nested control by its full path', () => {
    const { result } = render(NESTED)
    expect(result.current.missing).toEqual(['address.street'])
  })

  it('tags a nested file with its full path', () => {
    const { result } = render([
      { name: 'docs', type: 'group', children: [{ name: 'resume', type: 'file' }] },
    ])
    act(() => result.current.setValue('docs.resume', file('cv.pdf')))
    expect(result.current.files[0].field).toBe('docs.resume')
  })

  it('exposes each control with the path its value lives at', () => {
    const { result } = render(NESTED)
    expect(result.current.controls.map((c) => c.path)).toEqual([
      'email',
      'address',
      'address.street',
      'address.city',
    ])
  })
})

describe('both authored shapes', () => {
  it('accepts the older map keyed by control name', () => {
    // During a transition both exist in content, and a hook that handled one
    // would be unusable with the other.
    const { result } = render({
      email: { type: 'string', required: true },
      plan: { type: 'string', default: 'free' },
    })
    expect(result.current.values).toEqual({ plan: 'free' })
    expect(result.current.missing).toEqual(['email'])
  })

  it('survives a definition that is absent or junk', () => {
    // `content.data.form` is absent whenever the author has not added the block.
    for (const junk of [undefined, null, 'nope', 42]) {
      const { result } = render(junk)
      expect(result.current.controls).toEqual([])
      expect(result.current.formData).toEqual({})
      expect(result.current.missing).toEqual([])
    }
  })

  it('skips a control with no name — it could not hold a value', () => {
    const { result } = render([{ type: 'string' }, { name: 'ok', type: 'string' }])
    expect(result.current.controls.map((c) => c.name)).toEqual(['ok'])
  })
})

describe('valueAt', () => {
  it('reads a dotted path, and tolerates an absent branch', () => {
    expect(valueAt({ a: { b: 1 } }, 'a.b')).toBe(1)
    expect(valueAt({}, 'a.b')).toBeUndefined()
  })
})

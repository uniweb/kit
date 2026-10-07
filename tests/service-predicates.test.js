/**
 * The service predicates — one per service, no arguments, named for the service.
 *
 * What is worth pinning is the NAME each one asks for: a predicate bundled into a
 * foundation that asks for a name no host offers draws nothing, silently, on every
 * site. The site's own backend is the `backend` service since 2026-10-07 (it was
 * `api`), so its predicate asks for `backend` and the old one is gone.
 */

import * as entry from '../src/index.js'
import {
  isBackendEnabled,
  isSearchEnabled,
  isSubmitEnabled,
  isTrackingEnabled,
  isAssistantEnabled,
} from '../src/utils/servicePredicates.js'

/** An active website that offers exactly the services named, and records what was asked. */
function withActiveSite(offered, fn) {
  const asked = []
  const previous = globalThis.uniweb
  globalThis.uniweb = {
    activeWebsite: {
      isServiceEnabled: (name) => {
        asked.push(name)
        return offered.includes(name)
      },
    },
  }
  try {
    return { result: fn(), asked }
  } finally {
    globalThis.uniweb = previous
  }
}

describe('service predicates — each asks for its own service', () => {
  it.each([
    [isBackendEnabled, 'backend'],
    [isSearchEnabled, 'search'],
    [isSubmitEnabled, 'submit'],
    [isTrackingEnabled, 'tracking'],
    [isAssistantEnabled, 'assistant'],
  ])('%o asks for %s', (predicate, name) => {
    const { result, asked } = withActiveSite([name], predicate)
    expect(asked).toEqual([name])
    expect(result).toBe(true)
  })

  it('the backend predicate does not answer to the old name', () => {
    const { result, asked } = withActiveSite(['api'], isBackendEnabled)
    expect(asked).toEqual(['backend'])
    expect(result).toBe(false)
  })

  it('is false, not a throw, before the runtime has initialized', () => {
    const previous = globalThis.uniweb
    globalThis.uniweb = undefined
    try {
      expect(isBackendEnabled()).toBe(false)
    } finally {
      globalThis.uniweb = previous
    }
  })
})

describe('the package entry', () => {
  it('exports the backend predicate, and none by the old name', () => {
    expect(typeof entry.isBackendEnabled).toBe('function')
    expect('isApiEnabled' in entry).toBe(false)
  })
})

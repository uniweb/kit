/**
 * @vitest-environment jsdom
 *
 * Overlay — the behaviour that only exists in a DOM.
 *
 * kit's suite is node-environment on purpose (several tests assert what
 * happens when there is no `document`), so this file opts itself into jsdom
 * rather than the config switching globally.
 *
 * Focus containment is why the environment is worth adding. The first version
 * of this component did none of it while every documented example carried
 * `role="dialog" aria-modal="true"` — a promise to assistive technology that
 * everything outside the dialog is unreachable. Without a trap that promise is
 * false in the most literal way: a keyboard user Tabs straight out into the
 * page behind and lands on controls a screen-reader user has been told do not
 * exist. Nothing errors, nothing looks wrong, and the people it fails are the
 * least likely to be in the room when it ships.
 */

import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { Overlay } from '../src/components/Overlay/Overlay.jsx'

afterEach(() => {
  cleanup()
  document.body.style.overflow = ''
  // Undo any inert left behind by a failed assertion, so tests stay isolated.
  Array.from(document.body.children).forEach((el) => el.removeAttribute('inert'))
})

/** A dialog with three tabbables, so wrapping is observable at both ends. */
const Dialog = ({ label = 'Dialog' }) => (
  <div role="dialog" aria-modal="true" aria-label={label}>
    <button>first</button>
    <input aria-label="middle" />
    <button>last</button>
  </div>
)

const tab = (shiftKey = false) =>
  fireEvent.keyDown(document.activeElement || document, { key: 'Tab', shiftKey })

describe('portal', () => {
  it('renders outside the React root, as a direct child of body', () => {
    // The entire reason the component exists: inside the tree it would sit in
    // a layout area's stacking context and paint under the page.
    const { container } = render(<Overlay onClose={() => {}}><Dialog /></Overlay>)
    const dialog = document.body.querySelector('[role="dialog"]')

    expect(dialog).toBeTruthy()
    expect(container.contains(dialog)).toBe(false)
    expect(dialog.closest('body > *').parentElement).toBe(document.body)
  })
})

describe('the scrim', () => {
  const layerOf = (baseElement) => baseElement.querySelector('.fixed.inset-0')

  it('dims the page by default, so a modal looks modal', () => {
    // Without this, `<Overlay onClose={x}>` renders a fully transparent layer
    // — the page stays visually live behind a dialog that has taken over.
    const { baseElement } = render(<Overlay onClose={() => {}}><Dialog /></Overlay>)
    expect(layerOf(baseElement).className).toContain('bg-black/50')
  })

  it('lets a foundation recolour it', () => {
    const { baseElement } = render(
      <Overlay onClose={() => {}} className="bg-white/10"><Dialog /></Overlay>
    )
    const cls = layerOf(baseElement).className
    expect(cls).toContain('bg-white/10')
    expect(cls).not.toContain('bg-black/50')
  })

  it('lets a foundation remove it entirely', () => {
    const { baseElement } = render(
      <Overlay onClose={() => {}} className="bg-transparent"><Dialog /></Overlay>
    )
    const cls = layerOf(baseElement).className
    expect(cls).toContain('bg-transparent')
    expect(cls).not.toContain('bg-black/50')
  })

  it('keeps additive classes alongside the default', () => {
    // Conflict resolution must not be so eager it drops classes that do not
    // conflict — a blur is a different property from a colour.
    const { baseElement } = render(
      <Overlay onClose={() => {}} className="backdrop-blur-sm"><Dialog /></Overlay>
    )
    const cls = layerOf(baseElement).className
    expect(cls).toContain('backdrop-blur-sm')
    expect(cls).toContain('bg-black/50')
  })

  it('lets a foundation re-place the content', () => {
    const { baseElement } = render(
      <Overlay onClose={() => {}} className="items-center"><Dialog /></Overlay>
    )
    const cls = layerOf(baseElement).className
    expect(cls).toContain('items-center')
    expect(cls).not.toContain('items-start')
  })

  it('renders no scrim for a non-modal overlay', () => {
    // A toast must not dim the page it is reporting on.
    const { baseElement } = render(<Overlay modal={false}><Dialog /></Overlay>)
    expect(layerOf(baseElement).className).not.toContain('bg-black/50')
  })
})

describe('focus containment', () => {
  it('moves focus into the overlay on open', () => {
    render(<Overlay onClose={() => {}}><Dialog /></Overlay>)
    expect(document.activeElement.textContent).toBe('first')
  })

  it('honours an explicit initialFocus selector', () => {
    render(
      <Overlay onClose={() => {}} initialFocus="input">
        <Dialog />
      </Overlay>
    )
    expect(document.activeElement.tagName).toBe('INPUT')
  })

  it('leaves focus alone when asked to', () => {
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    trigger.focus()

    render(<Overlay onClose={() => {}} initialFocus={false}><Dialog /></Overlay>)
    expect(document.activeElement).toBe(trigger)
    trigger.remove()
  })

  it('wraps forward from the last element to the first', () => {
    render(<Overlay onClose={() => {}}><Dialog /></Overlay>)
    const [first, , last] = Array.from(document.querySelectorAll('button, input'))

    last.focus()
    tab()
    expect(document.activeElement).toBe(first)
  })

  it('wraps backward from the first element to the last', () => {
    render(<Overlay onClose={() => {}}><Dialog /></Overlay>)
    const buttons = Array.from(document.querySelectorAll('button, input'))
    const first = buttons[0]
    const last = buttons[buttons.length - 1]

    first.focus()
    tab(true)
    expect(document.activeElement).toBe(last)
  })

  it('pulls focus back when it has escaped the overlay', () => {
    // A click on the page behind, or a programmatic focus() call, can move
    // focus out without a Tab. The next Tab must recover rather than continue
    // walking the page underneath.
    const outside = document.createElement('button')
    document.body.appendChild(outside)
    render(<Overlay onClose={() => {}}><Dialog /></Overlay>)

    outside.focus()
    tab()
    expect(document.body.querySelector('[role="dialog"]').contains(document.activeElement)).toBe(true)
    outside.remove()
  })

  it('restores focus to whatever opened it', () => {
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    trigger.focus()

    const { unmount } = render(<Overlay onClose={() => {}}><Dialog /></Overlay>)
    expect(document.activeElement).not.toBe(trigger)

    unmount()
    expect(document.activeElement).toBe(trigger)
    trigger.remove()
  })
})

describe('inert background', () => {
  it('marks the rest of the page unreachable while open, and restores it', () => {
    // The half of `aria-modal` a focus trap cannot deliver: this is what stops
    // a screen-reader virtual cursor, a click, or find-in-page.
    const page = document.createElement('div')
    document.body.appendChild(page)

    const { unmount } = render(<Overlay onClose={() => {}}><Dialog /></Overlay>)
    expect(page.hasAttribute('inert')).toBe(true)

    unmount()
    expect(page.hasAttribute('inert')).toBe(false)
    page.remove()
  })

  it('is not applied by a non-modal overlay', () => {
    const page = document.createElement('div')
    document.body.appendChild(page)

    render(<Overlay modal={false}><Dialog /></Overlay>)
    expect(page.hasAttribute('inert')).toBe(false)
    page.remove()
  })
})

describe('escape and the scrim', () => {
  it('closes on Escape, including from an input inside', () => {
    const onClose = vi.fn()
    render(<Overlay onClose={onClose}><Dialog /></Overlay>)

    const input = document.querySelector('input')
    input.focus()
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on a click on the scrim itself', () => {
    const onClose = vi.fn()
    const { baseElement } = render(<Overlay onClose={onClose}><Dialog /></Overlay>)
    const layer = baseElement.querySelector('.fixed.inset-0')

    fireEvent.click(layer)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not close on a click inside the content', () => {
    // Otherwise every stray click closes it, and a text selection that ends
    // outside the box does too.
    const onClose = vi.fn()
    render(<Overlay onClose={onClose}><Dialog /></Overlay>)

    fireEvent.click(document.querySelector('[role="dialog"]'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('respects closeOnEscape={false}', () => {
    const onClose = vi.fn()
    render(<Overlay onClose={onClose} closeOnEscape={false}><Dialog /></Overlay>)

    fireEvent.keyDown(document.activeElement, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('scroll lock', () => {
  it('locks while open and restores the previous value', () => {
    document.body.style.overflow = 'scroll'
    const { unmount } = render(<Overlay onClose={() => {}}><Dialog /></Overlay>)
    expect(document.body.style.overflow).toBe('hidden')

    unmount()
    expect(document.body.style.overflow).toBe('scroll')
  })

  it('is off for a non-modal overlay', () => {
    render(<Overlay modal={false}><Dialog /></Overlay>)
    expect(document.body.style.overflow).not.toBe('hidden')
  })
})

describe('nesting', () => {
  it('closes only the topmost overlay on Escape', () => {
    // A confirm dialog over a settings dialog: Escape must dismiss one.
    const outer = vi.fn()
    const inner = vi.fn()

    render(
      <>
        <Overlay onClose={outer}><Dialog label="outer" /></Overlay>
        <Overlay onClose={inner}><Dialog label="inner" /></Overlay>
      </>
    )

    fireEvent.keyDown(document.activeElement, { key: 'Escape' })
    expect(inner).toHaveBeenCalledTimes(1)
    expect(outer).not.toHaveBeenCalled()
  })

  it('keeps the page locked while an outer overlay is still open', () => {
    document.body.style.overflow = ''
    const Both = ({ showInner }) => (
      <>
        <Overlay onClose={() => {}}><Dialog label="outer" /></Overlay>
        {showInner && <Overlay onClose={() => {}}><Dialog label="inner" /></Overlay>}
      </>
    )

    const { rerender } = render(<Both showInner />)
    expect(document.body.style.overflow).toBe('hidden')

    rerender(<Both showInner={false} />)
    // The inner one closing must not unlock the page underneath the outer.
    expect(document.body.style.overflow).toBe('hidden')
  })
})

describe('non-modal overlays', () => {
  it('lets pointer events through to the page', () => {
    // A toast must not blanket the page in an invisible click-catcher.
    const { baseElement } = render(<Overlay modal={false}><Dialog /></Overlay>)
    const layer = baseElement.querySelector('.fixed.inset-0')
    expect(layer.className).toContain('pointer-events-none')
  })

  it('does not trap focus', () => {
    const outside = document.createElement('button')
    document.body.appendChild(outside)

    render(<Overlay modal={false}><Dialog /></Overlay>)
    outside.focus()
    tab()

    expect(document.activeElement).toBe(outside)
    outside.remove()
  })
})

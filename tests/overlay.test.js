/**
 * Overlay — the parts that are testable without a DOM.
 *
 * The component exists because of a stacking-context trap that only shows in
 * a browser: the runtime puts a `view-transition-name` on every layout area,
 * which makes that area a stacking context AND a containing block for fixed
 * descendants, so a modal rendered from inside the header can never paint
 * above the body no matter what z-index it carries. Rendering into
 * document.body is the escape.
 *
 * Kit's test environment is Node with no DOM, so what is asserted here is the
 * SSR half — which is the half with a correctness consequence. An overlay that
 * rendered during prerender would bake a full-page scrim into the static HTML
 * of every page, visible to anyone before JS runs and to every crawler.
 */

import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Overlay } from '../src/components/Overlay/Overlay.jsx'
import * as kit from '../src/index.js'

describe('Overlay in a no-DOM environment', () => {
  it('emits nothing when server-rendered', () => {
    // Rendered through react-dom/server rather than called as a plain
    // function: that is the path prerender actually takes, and it is the one
    // where useEffect is a no-op instead of throwing for want of a dispatcher.
    expect(typeof document).toBe('undefined')
    expect(renderToStaticMarkup(createElement(Overlay, null, 'content'))).toBe('')
  })

  it('survives being server-rendered with an onClose handler', () => {
    // The Escape and scroll-lock effects must not run during SSR — if either
    // touched `document` outside useEffect this would throw rather than
    // return empty, and it would take the whole prerender down with it.
    expect(
      renderToStaticMarkup(createElement(Overlay, { onClose: () => {} }, 'x'))
    ).toBe('')
  })
})

describe('barrel wiring', () => {
  it('is exported from the package root', () => {
    // A component missing from src/index.js fails only in a consumer's build.
    expect(typeof kit.Overlay).toBe('function')
  })
})

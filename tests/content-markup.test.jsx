import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Icon } from '../src/components/Icon/Icon.jsx'
import { Scene } from '../src/styled/Scene/index.jsx'
import { stripTags } from '../src/utils/index.js'

/**
 * Markup kit injects that did not come from its own code.
 *
 * An icon's SVG can come from content — an author's file, a pasted SVG — or
 * from any URL, and Icon injects its inner markup so the icon can take the
 * text's colour. Since 2026-10-14 that markup is rebuilt from the SVG
 * allowlist first (`@uniweb/semantic-parser/sanitize`); until then it was
 * injected as fetched, so an SVG carrying a script or a handler ran it.
 *
 * And a parser string's plain text: the parser escapes what it puts in, so
 * stripTags decodes as well as strips — on the server too, where there is no
 * DOMParser (this file runs in node).
 */

describe('Icon', () => {
  test('an SVG from outside the code loses its script and its handlers', () => {
    const html = renderToStaticMarkup(
      <Icon
        svg={
          '<svg viewBox="0 0 24 24" onload="alert(1)"><script>alert(2)</script><image href="x" onerror="alert(3)"/><path d="M0 0h24"/></svg>'
        }
      />,
    )
    expect(html).not.toMatch(/script|onload|onerror|alert/)
    expect(html).toContain('<path d="M0 0h24"/>')
    expect(html).toContain('viewBox="0 0 24 24"')
  })

  test('an ordinary icon is drawn as written', () => {
    const html = renderToStaticMarkup(
      <Icon svg={'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>'} />,
    )
    expect(html).toContain('<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>')
  })
})

describe('Scene', () => {
  // A scene is content — `@std/scene`, composed in an editor — and an svg
  // layer's markup is injected. Until 2026-10-14 kit passed no sanitizer, so
  // the layer below ran both of its scripts on the page.
  const composition = {
    svgs: [
      {
        id: 'mark',
        viewBox: '0 0 10 10" onload="alert(3)',
        content: '<circle cx="5" cy="5" r="4" onclick="alert(1)"/><script>alert(2)</script><path d="M0 0h10"/>',
      },
    ],
  }

  test('an svg layer is rebuilt from the SVG allowlist', () => {
    const html = renderToStaticMarkup(<Scene composition={composition} />)
    expect(html).not.toMatch(/script|onload|onclick|alert/)
    expect(html).toContain('<circle cx="5" cy="5" r="4"/>')
    expect(html).toContain('<path d="M0 0h10"/>')
  })

  test('a sanitizer of the foundation’s own replaces it', () => {
    const html = renderToStaticMarkup(<Scene composition={composition} sanitizeSvg={() => '<svg><rect/></svg>'} />)
    expect(html).toContain('<svg><rect/></svg>')
  })
})

describe('stripTags', () => {
  test('gives the characters of a parser string, without a DOM', () => {
    expect(typeof DOMParser).toBe('undefined')
    expect(stripTags('if a&lt;b then <strong>swap</strong> R&amp;D &#169;')).toBe('if a<b then swap R&D ©')
  })
})

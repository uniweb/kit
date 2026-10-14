import { Scene as SceneRenderer, composeScene } from '@uniweb/scene'
import { sanitizeSVG } from '@uniweb/semantic-parser/sanitize'

// The @uniweb/scene renderer reads `--vc-*` custom properties for its default
// colors (an explicit value in the scene JSON always wins). Text, font, and
// separator already fall back to `currentColor` / `inherit`, so they inherit the
// section's context color and font for free — we only theme the decorative
// defaults (shape + spray/accent fills) from the site's semantic tokens.
const THEME_VARS = {
  '--vc-shape': 'var(--primary, #ffffff)',
  '--vc-accent': 'var(--accent, #ff3300)'
}

/**
 * Scene — themed wrapper around the `@uniweb/scene` renderer (the Scene
 * Composition Format, surfaced to authors as a "Visual Design").
 *
 * Pass `composition` — an SCF document, e.g. `content.data.scene`. For
 * content-driven templates, also pass `overrides` (named-slot, keyed by layer
 * id) and/or `content` (an ordered stream); they run through `composeScene`
 * before rendering so authored content flows into a branded template.
 *
 * Maps the site's `--primary` / `--accent` tokens onto the renderer's decorative
 * defaults so an unstyled scene adopts the theme; text and fonts inherit the
 * section context automatically. All other props (`mobileBreakpoint`,
 * `initialWidth`, `className`, `style`, and the editing hooks) forward straight
 * through.
 *
 * An svg layer's markup is injected, so it is rebuilt from the SVG allowlist
 * first (`sanitizeSVG`, `@uniweb/semantic-parser/sanitize`) — a scene is content,
 * and whoever composed it may not be the person who wrote the foundation. Pass
 * your own `sanitizeSvg` to replace it. ⛔ Until 2026-10-14 nothing was passed by
 * default, so a layer's `<script>` or `onload` ran on the page.
 *
 * @example
 *   <Scene composition={content.data.scene} />
 *   <Scene composition={template} overrides={{ title: { content: content.title } }} />
 */
export function Scene({ composition, overrides, content, style, sanitizeSvg = sanitizeSVG, ...rest }) {
  const data =
    overrides || content
      ? composeScene(composition, { overrides, content })
      : composition

  return (
    <SceneRenderer
      composition={data}
      style={{ ...THEME_VARS, ...style }}
      sanitizeSvg={sanitizeSvg}
      {...rest}
    />
  )
}

export default Scene

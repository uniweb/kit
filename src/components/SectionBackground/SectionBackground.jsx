/**
 * SectionBackground — the background the author set on a section, drawn by the runtime's own
 * renderer, for a component that places it itself.
 *
 * The runtime draws a section's background behind every section, so most components need
 * nothing. A component that paints its own — a hero with a built-in gradient, a background
 * that belongs inside a card — declares `background: 'self'` in its `meta.js`, and the runtime
 * then draws none. With this it can still draw what the author chose, wherever it wants,
 * without rebuilding the image, video, gradient and overlay handling.
 *
 * It fills the nearest positioned ancestor (`position: absolute; inset: 0`), so place it inside
 * an element with `position: relative`, before the content.
 *
 * @param {Object} props
 * @param {Object} props.block - The section's block — its `block.background`, normalized by core
 * @param {string} [props.className] - Classes on the background layer
 *
 * @example
 * function Hero({ content, block }) {
 *   return (
 *     <section className="relative">
 *       <SectionBackground block={block} />
 *       <div className="relative z-10">…</div>
 *     </section>
 *   )
 * }
 */
export function SectionBackground({ block, className }) {
  const background = block?.background
  if (!background?.mode) return null
  const Renderer = globalThis.uniweb?.backgroundRenderer
  if (!Renderer) return null
  return <Renderer {...background} className={className} />
}

export default SectionBackground

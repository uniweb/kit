/**
 * What kit's media components read of a content element — never the element
 * whole.
 *
 * An element's keys are content's words — `placement`, `author`, `role`, `id` —
 * and a component's props are its own. Spreading one into the other passes every
 * key the component does not read on to the DOM, and hands it any key it does
 * read with content's meaning instead of its own: `<Image>`'s `size` is an
 * avatar preset, and a layout size the parser once put on every image arrived
 * there, so a "wide" image drew as a 96px square. ⛔ Until 2026-10-15 `<Visual>`
 * spread an image element into `<Image>`, and `<Render>` a video element into
 * `<Media>`.
 *
 * @module @uniweb/kit/styled/media-props
 */

/**
 * A content image, as `<Image>` takes it.
 *
 * @param {Object} [image] - an image element's attrs, or a `content.images` entry
 * @returns {Object}
 */
export function imageProps({ url, src, alt, caption, href, loading, width, height } = {}) {
  return { src: url || src, alt, caption, href, loading, width, height }
}

/**
 * A content video, as `<Media>` takes it.
 *
 * @param {Object} [video] - a video element's attrs, or a `content.videos` entry
 * @returns {Object}
 */
export function videoProps({ src, url, poster, autoplay, muted, loop, controls } = {}) {
  return { src: src || url, poster, autoplay, muted, loop, controls }
}

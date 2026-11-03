/**
 * How wide a picture opens, or whether opening it is worth offering.
 *
 * It opens as large as the window allows, up to its own size, since a photo wants to be seen
 * whole. Two things change that:
 *
 * - `minScale`, for a picture with words in it: never so small that they can't be read, and past
 *   that the reader scrolls. A diagram's labels are 16px at its own size, so `<Mermaid>` asks for 0.75.
 * - Fitting the window may show nothing new. A photo already fills a phone's width, so there the
 *   picture opens at its own size and the reader pans across it.
 */

/** Opening has to show it at least this much larger than the page does, or nothing is offered. */
const WORTH_OFFERING = 1.2

/**
 * @param {Object} sizes
 * @param {number} sizes.naturalWidth - the picture's own size, 0 until it has loaded
 * @param {number} sizes.naturalHeight
 * @param {number} sizes.shownWidth - its width on the page now
 * @param {number} sizes.availableWidth - the room in the window
 * @param {number} sizes.availableHeight
 * @param {number} [sizes.minScale=0] - the smallest it opens at, against its own size
 * @returns {number|null} the width it opens at, or null when that isn't worth offering
 */
export function enlargedWidth({
  naturalWidth,
  naturalHeight,
  shownWidth,
  availableWidth,
  availableHeight,
  minScale = 0,
}) {
  if (!naturalWidth || !naturalHeight || !shownWidth) return null
  const worthIt = shownWidth * WORTH_OFFERING
  const fit = Math.min(1, availableWidth / naturalWidth, availableHeight / naturalHeight)
  const width = naturalWidth * Math.max(fit, minScale)
  if (width >= worthIt) return Math.round(width)
  return naturalWidth >= worthIt ? naturalWidth : null
}

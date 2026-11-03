/**
 * EnlargeableImage — an image in a page's body that a reader can open larger.
 *
 * What `<Render>` draws for an image, caption and placement included, with `Enlargeable` around the
 * picture. A foundation passes it through `components`, so the choice stays its own:
 *
 *   <Prose content={content} block={block} components={{ image: EnlargeableImage }} />
 *
 * Its own file, so a foundation that draws a diagram and no such image doesn't bring `Render` along.
 */

import React from 'react'
import { ImageElement } from '../Render/index.jsx'
import { Enlargeable } from './index.jsx'

export function EnlargeableImage({ element }) {
  return <ImageElement element={element} frame={Enlargeable} />
}

export default EnlargeableImage

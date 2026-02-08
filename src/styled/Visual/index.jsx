/**
 * Visual Component
 *
 * Renders the first visual element from content: inset > video > image.
 * Used by section types with a visual slot (SplitContent, Showcase, etc.).
 *
 * Section types that declare `visuals: 1` (any type) should use this component.
 * Section types that declare `visuals: 'image'` (media only) should use Media/Image directly.
 *
 * @module @uniweb/kit/styled/Visual
 */

import React from 'react'
import { Media } from '../../components/Media/Media.jsx'
import { Image } from '../../components/Image/index.js'

/**
 * Renders the first visual from content, checking insets first, then video, then image.
 *
 * @param {Object} props
 * @param {Object} props.content - Parsed content from prepare-props
 * @param {Object} props.block - Block instance (provides block.insets)
 * @param {string} [props.className] - CSS classes for the visual container
 * @param {React.ReactNode} [props.fallback] - Fallback when no visual is found
 */
export function Visual({ content, block, className, fallback = null }) {
  // Priority 1: Inset component (from @ComponentName in markdown)
  const inset = block?.insets?.[0]
  if (inset) {
    const Renderer = inset.getChildBlockRenderer?.()
    if (Renderer) {
      return <Renderer blocks={[inset]} as="div" extra={{ className }} />
    }
  }

  // Priority 2: Video
  const video = content?.videos?.[0]
  if (video) {
    return <Media src={video.src || video} className={className} />
  }

  // Priority 3: Image
  const img = content?.images?.[0] || content?.imgs?.[0]
  if (img) {
    return <Image src={img.src} alt={img.alt} className={className} />
  }

  return fallback
}

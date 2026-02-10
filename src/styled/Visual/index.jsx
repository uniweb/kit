/**
 * Visual Component
 *
 * Renders the first non-empty visual from the given candidates.
 * Resolution order: inset > video > image. Only tries what's passed.
 *
 * @module @uniweb/kit/styled/Visual
 */

import React from 'react'
import { Media } from '../../components/Media/Media.jsx'
import { Image } from '../../components/Image/index.js'
import { getChildBlockRenderer } from '../../utils/index.js'

/**
 * Renders the first non-empty visual from the given candidates.
 *
 * @param {Object} props
 * @param {Object} [props.inset] - Inset Block instance (from block.insets or block.getInset())
 * @param {Object} [props.video] - Video object with src property
 * @param {Object} [props.image] - Image object with src and alt properties
 * @param {string} [props.className] - CSS classes for the visual container
 * @param {React.ReactNode} [props.fallback] - Fallback when no visual is found
 *
 * @example
 * // Try inset first, fall back to video, then image
 * <Visual inset={block.insets[0]} video={content.videos[0]} image={content.images[0]} />
 *
 * @example
 * // Specific inset only
 * <Visual inset={block.getInset('chart')} className="rounded-lg" />
 *
 * @example
 * // Image only
 * <Visual image={content.images[1]} className="aspect-video" />
 */
export function Visual({ inset, video, image, className, fallback = null }) {
  if (inset) {
    const Renderer = getChildBlockRenderer()
    return <Renderer blocks={[inset]} as="div" extra={{ className }} />
  }

  if (video) {
    return <Media src={video.src || video} className={className} />
  }

  if (image) {
    return <Image src={image.src || image} alt={image.alt} className={className} />
  }

  return fallback
}

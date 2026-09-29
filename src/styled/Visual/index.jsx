/**
 * Visual Component
 *
 * Renders one visual: a `content.media` item by its kind, or the first non-empty of
 * the candidates it is handed (inset, then video, then image).
 *
 * @module @uniweb/kit/styled/Visual
 */

import React from "react";
import { Media } from "../../components/Media/Media.jsx";
import { Image } from "../../components/Image/index.js";
import { getChildBlockRenderer } from "../../utils/index.js";

/**
 * Renders one visual.
 *
 * ⭐ `media` is a `content.media` item — an image, a video or an embedded component,
 * tagged with its `kind` — rendered by that kind. Handed the whole `content.media`,
 * it renders the first item: a slot of one is the first thing the author placed in
 * it, whatever its kind. An embedded component needs `block`, whose insets it is
 * one of.
 *
 * Without `media`, the first non-empty candidate: inset, then video, then image.
 *
 * @param {Object} props
 * @param {Object|Object[]} [props.media] - A `content.media` item, or the list (its first item)
 * @param {Object} [props.block] - The section's block — resolves an embedded component
 * @param {Object} [props.inset] - Inset Block instance (from block.insets or block.getInset())
 * @param {Object} [props.video] - Video object with src property
 * @param {Object} [props.image] - Image object with src and alt properties
 * @param {string} [props.className] - CSS classes for the visual container
 * @param {React.ReactNode} [props.fallback] - Fallback when no visual is found
 *
 * @example
 * // The slot of one — the author's first image, video or component
 * <Visual media={content.media} block={block} className="rounded-lg" />
 *
 * @example
 * // Every item of a gallery, in the author's order
 * {content.media.map((item, i) => <Visual key={i} media={item} block={block} />)}
 *
 * @example
 * // Try inset first, fall back to video, then image
 * <Visual inset={block.insets[0]} video={content.videos[0]} image={content.images[0]} />
 */
export function Visual({ media, block, inset, video, image, className, fallback = null }) {
    if (media !== undefined) {
        const item = Array.isArray(media) ? media[0] : media;
        return renderItem(item, block, className) ?? fallback;
    }

    if (inset) return renderInset(inset, className);

    if (video) {
        return <Media {...video} className={className} />;
    }

    if (image) {
        const { contentType, viewType, contentId, imgPos, ...imageProps } = image;
        return <Image {...imageProps} className={className} />;
    }

    return fallback;
}

/** A `content.media` item, rendered by its kind — or null when it cannot be. */
function renderItem(item, block, className) {
    if (!item || typeof item !== "object") return null;
    const { kind, ...attrs } = item;
    switch (kind) {
        case "image": {
            const { contentType, viewType, contentId, imgPos, ...imageProps } = attrs;
            return <Image {...imageProps} className={className} />;
        }
        case "video":
            return <Media {...attrs} className={className} />;
        case "inset": {
            const insetBlock = attrs.refId ? block?.getInset?.(attrs.refId) : null;
            return insetBlock ? renderInset(insetBlock, className) : null;
        }
        default:
            return null;
    }
}

function renderInset(inset, className) {
    const Renderer = getChildBlockRenderer();
    if (!Renderer) return null;
    const rendered = <Renderer blocks={[inset]} />;
    return className ? <div className={className}>{rendered}</div> : rendered;
}

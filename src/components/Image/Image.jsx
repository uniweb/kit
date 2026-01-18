/**
 * Image Component
 *
 * Versatile image component supporting:
 * - Profile avatars and banners
 * - Asset-based images
 * - Direct URLs
 * - CSS filters
 * - Responsive sizing
 *
 * @module @uniweb/kit/Image
 */

import React, { useState, useCallback } from "react";
import { Link } from "../Link/index.js";
import { cn } from "../../utils/index.js";

/**
 * Size presets for images
 */
const SIZE_CLASSES = {
  xs: "w-8 h-8",
  sm: "w-12 h-12",
  md: "w-16 h-16",
  lg: "w-24 h-24",
  xl: "w-32 h-32",
  "2xl": "w-48 h-48",
  full: "w-full h-full",
};

/**
 * Build CSS filter string from filter object
 * @param {Object} filter - Filter settings
 * @returns {string} CSS filter value
 */
function buildFilterStyle(filter) {
  if (!filter || typeof filter !== "object") return undefined;

  const filters = [];

  if (filter.blur) filters.push(`blur(${filter.blur}px)`);
  if (filter.brightness) filters.push(`brightness(${filter.brightness}%)`);
  if (filter.contrast) filters.push(`contrast(${filter.contrast}%)`);
  if (filter.grayscale) filters.push(`grayscale(${filter.grayscale}%)`);
  if (filter.saturate) filters.push(`saturate(${filter.saturate}%)`);
  if (filter.sepia) filters.push(`sepia(${filter.sepia}%)`);

  return filters.length > 0 ? filters.join(" ") : undefined;
}

/**
 * Image - Versatile image component
 *
 * @param {Object} props
 * @param {Object} [props.profile] - Profile object for avatar/banner images
 * @param {string} [props.type] - Image type: 'avatar', 'banner', or 'image'
 * @param {string} [props.size] - Size preset: 'xs', 'sm', 'md', 'lg', 'xl', '2xl', 'full'
 * @param {string|Object} [props.value] - Asset identifier or object
 * @param {string} [props.src] - Direct image URL
 * @param {string} [props.url] - Direct image URL (alias)
 * @param {string} [props.alt] - Alt text for accessibility
 * @param {string} [props.href] - Make image a clickable link
 * @param {boolean|string} [props.rounded] - true for full rounding, or custom class
 * @param {Object} [props.filter] - CSS filter settings
 * @param {string} [props.loading='lazy'] - Loading strategy
 * @param {string} [props.className] - Additional CSS classes
 * @param {boolean} [props.ariaHidden] - Hide from screen readers
 * @param {Function} [props.onError] - Error callback
 * @param {Function} [props.onLoad] - Load callback
 *
 * @example
 * // Direct URL
 * <Image src="/images/hero.jpg" alt="Hero image" />
 *
 * @example
 * // Profile avatar
 * <Image profile={profile} type="avatar" size="lg" rounded />
 *
 * @example
 * // With filters
 * <Image src="/photo.jpg" filter={{ grayscale: 100, brightness: 110 }} />
 *
 * @example
 * // Clickable image
 * <Image src="/logo.png" href="/about" alt="Company logo" />
 */
export function Image({
  profile,
  type,
  size,
  value,
  src,
  url,
  alt = "",
  href,
  rounded,
  filter,
  loading = "lazy",
  className,
  ariaHidden,
  onError,
  onLoad,
  ...props
}) {
  const [hasError, setHasError] = useState(false);
  const [imageSrc, setImageSrc] = useState(null);

  // Determine the image source
  let resolvedSrc = src || url || "";
  let resolvedAlt = alt;

  // Handle profile-based images
  if (profile && type) {
    if (type === "avatar" || type === "banner") {
      // Use profile methods if available
      if (typeof profile.getImageInfo === "function") {
        const imageInfo = profile.getImageInfo(type, size);
        resolvedSrc = imageInfo?.url || resolvedSrc;
        resolvedAlt = imageInfo?.alt || resolvedAlt;
      }
    } else if (value && typeof profile.getAssetInfo === "function") {
      const assetInfo = profile.getAssetInfo(value, true, alt);
      resolvedSrc = assetInfo?.src || resolvedSrc;
      resolvedAlt = assetInfo?.alt || resolvedAlt;
    }
  }

  // Handle value as direct source
  if (!resolvedSrc && value) {
    if (typeof value === "string") {
      resolvedSrc = value;
    } else if (value.url || value.src) {
      resolvedSrc = value.url || value.src;
      resolvedAlt = value.alt || resolvedAlt;
    }
  }

  // Build classes
  const sizeClass = size && SIZE_CLASSES[size];
  const roundedClass =
    rounded === true
      ? "rounded-full"
      : typeof rounded === "string"
      ? rounded
      : "";

  const imageClasses = cn("object-cover", sizeClass, roundedClass, className);

  // Build filter style
  const filterStyle = buildFilterStyle(filter);

  // Handle error
  const handleError = useCallback(
    (e) => {
      setHasError(true);
      onError?.(e);
    },
    [onError]
  );

  // Handle load
  const handleLoad = useCallback(
    (e) => {
      onLoad?.(e);
    },
    [onLoad]
  );

  // Don't render if no source or error
  if (!resolvedSrc || hasError) {
    return null;
  }

  const imageElement = (
    <img
      src={resolvedSrc}
      alt={resolvedAlt}
      loading={loading}
      className={imageClasses}
      style={filterStyle ? { filter: filterStyle } : undefined}
      onError={handleError}
      onLoad={handleLoad}
      aria-hidden={ariaHidden}
      {...props}
    />
  );

  // Wrap in link if href provided
  if (href) {
    return (
      <Link to={href} className="inline-block">
        {imageElement}
      </Link>
    );
  }

  return imageElement;
}

export default Image;

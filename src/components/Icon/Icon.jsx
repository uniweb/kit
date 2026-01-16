/**
 * Icon Component
 *
 * Renders SVG icons from various sources:
 * - Direct SVG content
 * - URL to SVG file
 * - Built-in icons
 *
 * @module @uniweb/kit/Icon
 */

import React, { useState, useEffect, useMemo } from 'react'
import { cn } from '../../utils/index.js'

/**
 * Built-in demo icons (simple SVG paths)
 */
const BUILT_IN_ICONS = {
  check: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>',
  alert: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>',
  user: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>',
  heart: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>',
  settings: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>',
  star: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>',
  close: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>',
  menu: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>',
  chevronDown: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>',
  chevronRight: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>',
  externalLink: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>',
  download: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>',
  play: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>'
}

/**
 * Parse SVG content and extract the inner elements
 * @param {string} svgContent - Raw SVG string
 * @returns {Object} { viewBox, content, width, height }
 */
function parseSvg(svgContent) {
  if (!svgContent) return null

  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(svgContent, 'image/svg+xml')
    const svg = doc.querySelector('svg')

    if (!svg) return null

    const viewBox = svg.getAttribute('viewBox') || '0 0 24 24'
    const width = svg.getAttribute('width')
    const height = svg.getAttribute('height')

    // Get inner content
    const content = svg.innerHTML

    return { viewBox, content, width, height }
  } catch (error) {
    console.warn('[Icon] Error parsing SVG:', error)
    return null
  }
}

/**
 * Icon - SVG icon component
 *
 * @param {Object} props
 * @param {string} [props.name] - Built-in icon name or custom name
 * @param {string} [props.svg] - Direct SVG content
 * @param {string} [props.url] - URL to fetch SVG from
 * @param {string} [props.size='24'] - Icon size in pixels
 * @param {string} [props.color] - Icon color (defaults to currentColor)
 * @param {boolean} [props.preserveColors=false] - Keep original SVG colors
 * @param {string} [props.className] - Additional CSS classes
 * @param {React.ReactNode} [props.loadingComponent] - Custom loading UI
 * @param {React.ReactNode} [props.errorComponent] - Custom error UI
 *
 * @example
 * // Built-in icon
 * <Icon name="check" size="20" color="green" />
 *
 * @example
 * // From URL
 * <Icon url="/icons/custom.svg" size="32" />
 *
 * @example
 * // Direct SVG content
 * <Icon svg="<svg>...</svg>" />
 */
export function Icon({
  name,
  svg,
  url,
  icon, // Legacy prop - can be string (URL) or object
  size = '24',
  color,
  preserveColors = false,
  className,
  loadingComponent,
  errorComponent,
  ...props
}) {
  const [fetchedSvg, setFetchedSvg] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  // Handle legacy icon prop
  const iconUrl = url || (typeof icon === 'string' ? icon : icon?.url)
  const iconSvg = svg || (typeof icon === 'object' ? icon.svg : null)
  const iconName = name || (typeof icon === 'object' ? icon.name : null)

  // Fetch SVG from URL
  useEffect(() => {
    if (!iconUrl) return

    setLoading(true)
    setError(false)

    fetch(iconUrl)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch icon')
        return res.text()
      })
      .then((svgText) => {
        setFetchedSvg(svgText)
        setLoading(false)
      })
      .catch((err) => {
        console.warn('[Icon] Error fetching:', err)
        setError(true)
        setLoading(false)
      })
  }, [iconUrl])

  // Determine the SVG content to render
  const svgData = useMemo(() => {
    // Priority: direct SVG > fetched SVG > built-in
    if (iconSvg) {
      return parseSvg(iconSvg)
    }

    if (fetchedSvg) {
      return parseSvg(fetchedSvg)
    }

    // Built-in icons
    const builtInName = iconName || name
    if (builtInName && BUILT_IN_ICONS[builtInName]) {
      return {
        viewBox: '0 0 24 24',
        content: BUILT_IN_ICONS[builtInName],
        isBuiltIn: true
      }
    }

    return null
  }, [iconSvg, fetchedSvg, iconName, name])

  // Loading state
  if (loading) {
    return loadingComponent || (
      <span
        className={cn('inline-block animate-pulse bg-gray-200 rounded', className)}
        style={{ width: size, height: size }}
      />
    )
  }

  // Error state
  if (error) {
    return errorComponent || null
  }

  // No content
  if (!svgData) {
    // Fallback: render URL as img if we have a URL but couldn't parse SVG
    if (iconUrl) {
      return (
        <img
          src={iconUrl}
          alt=""
          width={size}
          height={size}
          className={className}
          aria-hidden="true"
          {...props}
        />
      )
    }
    return null
  }

  // Build style
  const style = {
    width: size,
    height: size,
    ...(color && !preserveColors ? { color } : {})
  }

  return (
    <svg
      viewBox={svgData.viewBox}
      fill={svgData.isBuiltIn ? 'none' : (preserveColors ? undefined : 'currentColor')}
      stroke={svgData.isBuiltIn ? 'currentColor' : undefined}
      className={cn('inline-block', className)}
      style={style}
      role="img"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: svgData.content }}
      {...props}
    />
  )
}

export default Icon

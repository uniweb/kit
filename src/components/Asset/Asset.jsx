/**
 * Asset Component (Plain)
 *
 * File download link with basic functionality.
 * This is the unstyled version - for styled card with preview,
 * use @uniweb/kit/tailwind.
 *
 * @module @uniweb/kit/Asset
 */

import React, { useCallback, forwardRef, useImperativeHandle } from 'react'
import { cn } from '../../utils/index.js'
import { FileLogo } from '../FileLogo/index.js'
import { useWebsite } from '../../hooks/useWebsite.js'

/**
 * Asset - File download component (plain/unstyled)
 *
 * @param {Object} props
 * @param {string|Object} props.value - Asset identifier or object
 * @param {Object} [props.profile] - Profile object for asset resolution
 * @param {boolean} [props.showIcon=true] - Show file type icon
 * @param {string} [props.iconSize='24'] - Icon size
 * @param {string} [props.className] - CSS classes for the link
 * @param {string} [props.iconClassName] - CSS classes for the icon
 * @param {React.ReactNode} [props.children] - Custom content (overrides default filename display)
 *
 * @example
 * <Asset value="document.pdf" className="text-blue-600 hover:underline" />
 *
 * @example
 * <Asset value={{ src: "/files/report.pdf", filename: "report.pdf" }}>
 *   Download Report
 * </Asset>
 */
export const Asset = forwardRef(function Asset(
  { value, profile, showIcon = true, iconSize = '24', className, iconClassName, children, ...props },
  ref
) {
  const { localize } = useWebsite()

  // Resolve asset info
  let src = ''
  let filename = ''

  if (typeof value === 'string') {
    src = value
    filename = value.split('/').pop() || value
  } else if (value && typeof value === 'object') {
    src = value.src || value.url || ''
    filename = value.filename || value.name || src.split('/').pop() || ''
  }

  // Use profile to resolve asset if available
  if (profile && typeof profile.getAssetInfo === 'function') {
    const assetInfo = profile.getAssetInfo(value, true, filename)
    src = assetInfo?.src || src
    filename = assetInfo?.filename || filename
  }

  // Handle download
  const handleDownload = useCallback(async (e) => {
    if (!src) return

    e.preventDefault()

    try {
      const downloadUrl = src.includes('?') ? `${src}&download=true` : `${src}?download=true`
      const response = await fetch(downloadUrl)
      const blob = await response.blob()

      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(link.href)
    } catch (error) {
      // Fallback: open in new tab
      window.open(src, '_blank')
    }
  }, [src, filename])

  // Expose download method via ref
  useImperativeHandle(ref, () => ({
    triggerDownload: handleDownload
  }), [handleDownload])

  if (!src) return null

  return (
    <a
      href={src}
      onClick={handleDownload}
      className={cn('inline-flex items-center gap-2', className)}
      title={localize({
        en: `Download ${filename}`,
        fr: `Télécharger ${filename}`
      })}
      {...props}
    >
      {showIcon && (
        <FileLogo filename={filename} size={iconSize} className={iconClassName} />
      )}
      {children || filename}
    </a>
  )
})

export default Asset

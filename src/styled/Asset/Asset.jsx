/**
 * Asset Component
 *
 * File asset preview with download functionality.
 *
 * @module @uniweb/kit/Asset
 */

import React, { useState, useCallback, forwardRef, useImperativeHandle } from 'react'
import { cn } from '../../utils/index.js'
import { FileLogo } from '../../components/FileLogo/index.js'
import { Image } from '../../components/Image/index.js'
import { useWebsite } from '../../hooks/useWebsite.js'

/**
 * Check if file is an image
 * @param {string} filename
 * @returns {boolean}
 */
function isImageFile(filename) {
  if (!filename) return false
  const ext = filename.toLowerCase().split('.').pop()
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)
}

/**
 * Asset - File preview with download
 *
 * @param {Object} props
 * @param {string|Object} props.value - Asset identifier or object
 * @param {Object} [props.profile] - Profile object for asset resolution
 * @param {boolean} [props.withDownload=true] - Show download button
 * @param {string} [props.className] - Additional CSS classes
 *
 * @example
 * <Asset value="document.pdf" profile={profile} />
 *
 * @example
 * <Asset value={{ src: "/files/report.pdf", filename: "report.pdf" }} />
 */
export const Asset = forwardRef(function Asset(
  { value, profile, withDownload = true, className, ...props },
  ref
) {
  const { localize } = useWebsite()
  const [imageError, setImageError] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  // Resolve asset info
  let src = ''
  let filename = ''
  let alt = ''

  if (typeof value === 'string') {
    src = value
    filename = value.split('/').pop() || value
  } else if (value && typeof value === 'object') {
    src = value.src || value.url || ''
    filename = value.filename || value.name || src.split('/').pop() || ''
    alt = value.alt || filename
  }

  // Use profile to resolve asset if available
  if (profile && typeof profile.getAssetInfo === 'function') {
    const assetInfo = profile.getAssetInfo(value, true, filename)
    src = assetInfo?.src || src
    filename = assetInfo?.filename || filename
    alt = assetInfo?.alt || alt
  }

  const isImage = isImageFile(filename)

  // Handle download
  const handleDownload = useCallback(async () => {
    if (!src) return

    try {
      // Try to trigger download
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

  // Handle image error
  const handleImageError = useCallback(() => {
    setImageError(true)
  }, [])

  if (!src) return null

  return (
    <div
      className={cn(
        'relative inline-block rounded-lg overflow-hidden border border-gray-200',
        'transition-shadow hover:shadow-md',
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      {...props}
    >
      {/* Preview */}
      <div className="w-32 h-32 flex items-center justify-center bg-gray-50">
        {isImage && !imageError ? (
          <Image
            src={src}
            alt={alt}
            className="w-full h-full object-cover"
            onError={handleImageError}
          />
        ) : (
          <FileLogo filename={filename} size="48" className="text-gray-400" />
        )}
      </div>

      {/* Filename */}
      <div className="px-2 py-1 text-xs text-gray-600 truncate max-w-[128px]" title={filename}>
        {filename}
      </div>

      {/* Download overlay */}
      {withDownload && (
        <button
          onClick={handleDownload}
          className={cn(
            'absolute inset-0 flex items-center justify-center',
            'bg-black/50 text-white transition-opacity',
            isHovered ? 'opacity-100' : 'opacity-0'
          )}
          aria-label={localize({
            en: 'Download file',
            fr: 'Télécharger le fichier'
          })}
        >
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </button>
      )}
    </div>
  )
})

export default Asset

/**
 * FileLogo Component
 *
 * Displays file type icons based on filename extension.
 *
 * @module @uniweb/kit/FileLogo
 */

import React from 'react'
import { cn } from '../../utils/index.js'

/**
 * File type to icon mapping
 * Using simple SVG icons for common file types
 */
const FILE_ICONS = {
  // Images
  jpg: 'image',
  jpeg: 'image',
  png: 'image',
  gif: 'image',
  webp: 'image',
  svg: 'image',

  // Documents
  pdf: 'pdf',
  doc: 'word',
  docx: 'word',
  txt: 'text',
  rtf: 'text',

  // Spreadsheets
  xls: 'excel',
  xlsx: 'excel',
  xlsm: 'excel',
  xlsb: 'excel',
  csv: 'excel',

  // Presentations
  ppt: 'powerpoint',
  pptx: 'powerpoint',

  // Code
  html: 'code',
  css: 'code',
  js: 'code',
  json: 'code',
  xml: 'code',

  // Archives
  zip: 'archive',
  rar: 'archive',
  '7z': 'archive',
  tar: 'archive',
  gz: 'archive',

  // Media
  mp3: 'audio',
  wav: 'audio',
  mp4: 'video',
  mov: 'video',
  avi: 'video'
}

/**
 * SVG icons for each file type
 */
const ICONS = {
  image: (
    <path d="M4 5a2 2 0 012-2h12a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm14 0H6v14h12V5zm-3 4a1 1 0 11-2 0 1 1 0 012 0zm-9 10l3-3 2 2 4-4 3 3v2H6v-0z" />
  ),
  pdf: (
    <path d="M7 2a2 2 0 00-2 2v16a2 2 0 002 2h10a2 2 0 002-2V8l-6-6H7zm7 1.5L18.5 8H14V3.5zM9 13h1.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5H10v2H9v-5zm1 2h.5a.5.5 0 000-1H10v1zm3-2h1.75c.69 0 1.25.56 1.25 1.25v2.5c0 .69-.56 1.25-1.25 1.25H13v-5zm1 4h.75a.25.25 0 00.25-.25v-2.5a.25.25 0 00-.25-.25H14v3z" />
  ),
  word: (
    <path d="M7 2a2 2 0 00-2 2v16a2 2 0 002 2h10a2 2 0 002-2V8l-6-6H7zm7 1.5L18.5 8H14V3.5zM8 13h1l1.5 4 1.5-4h1l-2 6h-1l-2-6zm7 0h1v6h-1v-6z" />
  ),
  excel: (
    <path d="M7 2a2 2 0 00-2 2v16a2 2 0 002 2h10a2 2 0 002-2V8l-6-6H7zm7 1.5L18.5 8H14V3.5zM9 12h2l1 2.5 1-2.5h2l-2 3 2 3h-2l-1-2.5-1 2.5H9l2-3-2-3z" />
  ),
  powerpoint: (
    <path d="M7 2a2 2 0 00-2 2v16a2 2 0 002 2h10a2 2 0 002-2V8l-6-6H7zm7 1.5L18.5 8H14V3.5zM9 12h3c1.1 0 2 .9 2 2s-.9 2-2 2h-2v2H9v-6zm1 3h2a1 1 0 000-2h-2v2z" />
  ),
  text: (
    <path d="M7 2a2 2 0 00-2 2v16a2 2 0 002 2h10a2 2 0 002-2V8l-6-6H7zm7 1.5L18.5 8H14V3.5zM8 12h8v1H8v-1zm0 3h8v1H8v-1zm0 3h5v1H8v-1z" />
  ),
  code: (
    <path d="M7 2a2 2 0 00-2 2v16a2 2 0 002 2h10a2 2 0 002-2V8l-6-6H7zm7 1.5L18.5 8H14V3.5zM9.5 12l-2 3 2 3 .7-.7L8.5 15l1.7-2.3-.7-.7zm5 0l-.7.7 1.7 2.3-1.7 2.3.7.7 2-3-2-3z" />
  ),
  archive: (
    <path d="M7 2a2 2 0 00-2 2v16a2 2 0 002 2h10a2 2 0 002-2V8l-6-6H7zm7 1.5L18.5 8H14V3.5zM11 10h2v1h-2v-1zm0 2h2v1h-2v-1zm0 2h2v3h-2v-3z" />
  ),
  audio: (
    <path d="M7 2a2 2 0 00-2 2v16a2 2 0 002 2h10a2 2 0 002-2V8l-6-6H7zm7 1.5L18.5 8H14V3.5zM12 11a3 3 0 100 6 3 3 0 000-6zm0 1a2 2 0 110 4 2 2 0 010-4zm0 1a1 1 0 100 2 1 1 0 000-2z" />
  ),
  video: (
    <path d="M7 2a2 2 0 00-2 2v16a2 2 0 002 2h10a2 2 0 002-2V8l-6-6H7zm7 1.5L18.5 8H14V3.5zM9 12l6 3-6 3v-6z" />
  ),
  default: (
    <path d="M7 2a2 2 0 00-2 2v16a2 2 0 002 2h10a2 2 0 002-2V8l-6-6H7zm7 1.5L18.5 8H14V3.5z" />
  )
}

/**
 * Get file extension from filename
 * @param {string} filename
 * @returns {string}
 */
function getExtension(filename) {
  if (!filename) return ''
  const parts = filename.toLowerCase().split('.')
  return parts.length > 1 ? parts.pop() : ''
}

/**
 * FileLogo - File type icon component
 *
 * @param {Object} props
 * @param {string} props.filename - Filename to determine icon
 * @param {string} [props.size='24'] - Icon size in pixels
 * @param {string} [props.className] - Additional CSS classes
 *
 * @example
 * <FileLogo filename="report.pdf" size="32" />
 *
 * @example
 * <FileLogo filename="data.xlsx" className="text-green-600" />
 */
export function FileLogo({ filename, size = '24', className, ...props }) {
  const ext = getExtension(filename)
  const iconType = FILE_ICONS[ext] || 'default'
  const icon = ICONS[iconType]

  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={cn('inline-block', className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
      {...props}
    >
      {icon}
    </svg>
  )
}

export default FileLogo

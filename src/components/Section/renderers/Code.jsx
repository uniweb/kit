/**
 * Code Block Renderer
 *
 * Renders syntax-highlighted code blocks.
 * Uses CSS classes for highlighting (bring your own Prism/Highlight.js CSS).
 *
 * @module @uniweb/kit/Section/renderers/Code
 */

import React, { useEffect, useRef } from 'react'
import { cn } from '../../../utils/index.js'

/**
 * Attempt to highlight code using Prism if available
 */
function highlightCode(code, language, element) {
  if (typeof window !== 'undefined' && window.Prism && element) {
    try {
      const grammar = window.Prism.languages[language]
      if (grammar) {
        element.innerHTML = window.Prism.highlight(code, grammar, language)
        return true
      }
    } catch (e) {
      console.warn('[Code] Prism highlighting failed:', e)
    }
  }
  return false
}

/**
 * Code - Syntax highlighted code block
 *
 * @param {Object} props
 * @param {string} props.content - Code content
 * @param {string} [props.language='plaintext'] - Programming language
 * @param {string} [props.className] - Additional CSS classes
 */
export function Code({ content, language = 'plaintext', className, ...props }) {
  const codeRef = useRef(null)

  // Normalize language
  const lang = language?.toLowerCase() || 'plaintext'

  // Try to highlight on mount
  useEffect(() => {
    if (codeRef.current && content) {
      highlightCode(content, lang, codeRef.current)
    }
  }, [content, lang])

  return (
    <pre
      className={cn(
        'overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm',
        className
      )}
      {...props}
    >
      <code
        ref={codeRef}
        className={`language-${lang} text-gray-100`}
      >
        {content}
      </code>
    </pre>
  )
}

export default Code

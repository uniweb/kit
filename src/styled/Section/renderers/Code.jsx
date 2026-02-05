/**
 * Code Block Renderer
 *
 * Renders syntax-highlighted code blocks using Shiki.
 * Shiki is lazy-loaded only when code blocks are actually used,
 * and CSS variables are injected at runtime from theme.code.
 *
 * @module @uniweb/kit/Section/renderers/Code
 */

import React, { useEffect, useState, useMemo } from 'react'
import { cn } from '../../../utils/index.js'
import { getUniweb } from '@uniweb/core'

// Module-level state to track CSS injection and Shiki loading
let cssInjected = false
let shikiInstance = null
let shikiLoadPromise = null

/**
 * Map theme.code keys to Shiki CSS variable names
 */
const CSS_VAR_MAP = {
  background: '--shiki-background',
  foreground: '--shiki-foreground',
  keyword: '--shiki-token-keyword',
  string: '--shiki-token-string',
  number: '--shiki-token-constant',
  comment: '--shiki-token-comment',
  function: '--shiki-token-function',
  variable: '--shiki-token-variable',
  operator: '--shiki-token-operator',
  punctuation: '--shiki-token-punctuation',
  type: '--shiki-token-type',
  constant: '--shiki-token-constant',
  property: '--shiki-token-property',
  tag: '--shiki-token-tag',
  attribute: '--shiki-token-attribute',
  lineNumber: '--shiki-line-number',
  selection: '--shiki-selection',
}

/**
 * Inject CSS variables from theme.code into the document
 */
function injectCodeThemeCSS(codeTheme) {
  if (cssInjected || typeof document === 'undefined') return

  const styleId = 'uniweb-code-theme'

  // Check if already injected (e.g., by another component instance)
  if (document.getElementById(styleId)) {
    cssInjected = true
    return
  }

  // Build CSS variables
  const cssVars = []
  for (const [key, value] of Object.entries(codeTheme || {})) {
    const varName = CSS_VAR_MAP[key]
    if (varName && value) {
      cssVars.push(`${varName}: ${value};`)
    }
  }

  // Create and inject style element
  const style = document.createElement('style')
  style.id = styleId
  style.textContent = `
:root {
  ${cssVars.join('\n  ')}
}

/* Code block base styles */
.shiki {
  background-color: var(--shiki-background, #1e1e2e);
  color: var(--shiki-foreground, #cdd6f4);
  padding: 1rem;
  border-radius: 0.5rem;
  overflow-x: auto;
}

/* Ensure proper token colors */
.shiki span {
  color: var(--shiki-token-foreground, inherit);
}

/* Code element inside shiki */
.shiki code {
  display: block;
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace;
}
`
  document.head.appendChild(style)
  cssInjected = true
}

/**
 * Lazy-load Shiki highlighter
 */
async function loadShiki() {
  if (shikiInstance) return shikiInstance
  if (shikiLoadPromise) return shikiLoadPromise

  shikiLoadPromise = (async () => {
    try {
      // Import Shiki and the css-variables theme (not bundled by default in Shiki 3.x)
      const [{ createHighlighter }, cssVariablesTheme] = await Promise.all([
        import('shiki'),
        import('shiki/themes/css-variables.mjs').then(m => m.default)
      ])

      // Create highlighter with CSS variables theme
      // Only load common languages initially, others load on-demand
      shikiInstance = await createHighlighter({
        themes: [cssVariablesTheme],
        langs: [
          'javascript',
          'typescript',
          'jsx',
          'tsx',
          'json',
          'html',
          'css',
          'markdown',
          'yaml',
          'bash',
          'shell',
          'python',
        ],
      })

      return shikiInstance
    } catch (error) {
      console.warn('[Code] Failed to load Shiki:', error)
      shikiLoadPromise = null
      return null
    }
  })()

  return shikiLoadPromise
}

/**
 * Highlight code using Shiki
 */
async function highlightCode(code, language, highlighter) {
  if (!highlighter) return null

  try {
    // Load language if not already loaded
    const loadedLangs = highlighter.getLoadedLanguages()
    const lang = language?.toLowerCase() || 'plaintext'

    if (!loadedLangs.includes(lang) && lang !== 'plaintext') {
      try {
        await highlighter.loadLanguage(lang)
      } catch {
        // Language not available, fall back to plaintext
        return highlighter.codeToHtml(code, {
          lang: 'plaintext',
          theme: 'css-variables',
        })
      }
    }

    return highlighter.codeToHtml(code, {
      lang: lang === 'plaintext' ? 'text' : lang,
      theme: 'css-variables',
    })
  } catch (error) {
    console.warn('[Code] Highlighting failed:', error)
    return null
  }
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
  const [highlightedHtml, setHighlightedHtml] = useState(null)

  // Get theme from website context (getUniweb is a regular function, not a hook)
  const codeTheme = useMemo(() => {
    try {
      const uniweb = getUniweb()
      return uniweb?.activeWebsite?.themeData?.code
    } catch {
      // Not in runtime context (e.g., storybook), use defaults
      return null
    }
  }, [])

  // Normalize language
  const lang = useMemo(() => {
    const l = language?.toLowerCase() || 'plaintext'
    // Common aliases
    const aliases = {
      js: 'javascript',
      ts: 'typescript',
      sh: 'bash',
      yml: 'yaml',
      md: 'markdown',
    }
    return aliases[l] || l
  }, [language])

  // Inject CSS on first render (if in browser)
  useEffect(() => {
    if (typeof document !== 'undefined' && codeTheme) {
      injectCodeThemeCSS(codeTheme)
    }
  }, [codeTheme])

  // Load Shiki and highlight code
  useEffect(() => {
    let cancelled = false

    async function highlight() {
      const highlighter = await loadShiki()
      if (cancelled) return

      if (highlighter && content) {
        const html = await highlightCode(content, lang, highlighter)
        if (!cancelled) {
          setHighlightedHtml(html)
        }
      }
    }

    highlight()

    return () => {
      cancelled = true
    }
  }, [content, lang])

  // Render highlighted code or fallback
  if (highlightedHtml) {
    return (
      <div
        className={cn('overflow-x-auto rounded-lg text-sm', className)}
        dangerouslySetInnerHTML={{ __html: highlightedHtml }}
        {...props}
      />
    )
  }

  // Fallback: plain code block (shown before Shiki loads or if it fails)
  // No loading indicator - the code content is already visible and readable.
  // When Shiki loads, syntax colors will appear smoothly.
  return (
    <pre
      className={cn(
        'overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm',
        className
      )}
      {...props}
    >
      <code className={`language-${lang} text-gray-100`}>
        {content}
      </code>
    </pre>
  )
}

export default Code

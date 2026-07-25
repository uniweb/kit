/**
 * Code Block Renderer
 *
 * Renders syntax-highlighted code blocks using Shiki, lazy-loaded only when a
 * page actually has one. A site's `theme.yml` `code:` block becomes a Shiki
 * theme layered over the default, so the colours a site declares are the
 * colours Shiki writes.
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
let siteThemeLoaded = false

// What a site gets when it declares no `code:` block of its own, and the base
// every declaration layers over.
const DEFAULT_THEME = 'github-dark'

/**
 * Where each documented `theme.code` key lands in TextMate scope terms.
 *
 * Shiki colours by scope, so a declaration only reaches the output by becoming
 * a scope rule. This used to map the same keys onto `--shiki-*` CSS variables,
 * which could never take effect: Shiki writes its theme as an inline style on
 * the <pre> and on every token span, and an inline style outranks any
 * stylesheet. The `code:` block was documented, parsed, and inert.
 *
 * `lineNumber` and `selection` are deliberately absent. They are editor chrome,
 * not token scopes, and Shiki's HTML has neither.
 */
const SCOPE_MAP = {
  comment: ['comment', 'punctuation.definition.comment'],
  string: ['string', 'string.quoted', 'constant.other.symbol'],
  keyword: ['keyword', 'storage', 'storage.type', 'keyword.control'],
  operator: ['keyword.operator'],
  function: ['entity.name.function', 'support.function', 'meta.function-call'],
  variable: ['variable', 'variable.other.readwrite'],
  number: ['constant.numeric'],
  constant: ['constant.language', 'constant.character', 'support.constant'],
  type: ['entity.name.type', 'entity.name.class', 'support.type', 'support.class'],
  property: ['variable.other.property', 'support.type.property-name', 'meta.object-literal.key'],
  tag: ['entity.name.tag'],
  attribute: ['entity.other.attribute-name'],
  punctuation: ['punctuation'],
}

export const SITE_CODE_THEME = 'uniweb-site-code'

/**
 * Build a Shiki theme from a site's `theme.yml` `code:` block, layered over a
 * base theme.
 *
 * Layering rather than replacing is the point. Most sites declare `background:`
 * alone — "the same highlighting, on my surface" — and building a theme from
 * only the declared keys would strip every syntax colour to answer that. So the
 * base supplies everything, and each declared key overrides its own scopes.
 *
 * @param {Object} base - A resolved Shiki theme to layer over
 * @param {Object} code - The site's `theme.code` declaration
 * @returns {Object} A Shiki theme registration
 */
export function buildCodeTheme(base, code) {
  const theme = {
    ...base,
    name: SITE_CODE_THEME,
    colors: { ...base?.colors },
    // Declared scopes go last so they win over the base's own rules.
    settings: [...(base?.settings ?? [])],
  }

  if (code?.background) {
    theme.bg = code.background
    theme.colors['editor.background'] = code.background
  }
  if (code?.foreground) {
    theme.fg = code.foreground
    theme.colors['editor.foreground'] = code.foreground
  }

  for (const [key, scope] of Object.entries(SCOPE_MAP)) {
    if (code?.[key]) theme.settings.push({ scope, settings: { foreground: code[key] } })
  }

  return theme
}

/**
 * Layout for the highlighted block. Colour is not set here — Shiki writes the
 * theme's own inline, and the theme is now the site's (see buildCodeTheme).
 * What is left is spacing and the code face, so a listing is legible before a
 * foundation styles it, without kit deciding what colour anything is.
 */
function injectCodeLayoutCSS() {
  if (cssInjected || typeof document === 'undefined') return

  const styleId = 'uniweb-code-layout'

  // Check if already injected (e.g., by another component instance)
  if (document.getElementById(styleId)) {
    cssInjected = true
    return
  }

  const style = document.createElement('style')
  style.id = styleId
  style.textContent = `
.shiki {
  padding: 1rem;
  border-radius: 0.5rem;
  overflow-x: auto;
}

.shiki code {
  display: block;
  font-family: var(--font-code, ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace);
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
      // Use shiki/bundle/full for access to all themes
      const { createHighlighter } = await import('shiki/bundle/full')

      // Create highlighter with github-dark theme (bundled, looks good for code)
      // Only load common languages initially, others load on-demand
      shikiInstance = await createHighlighter({
        themes: ['github-dark'],
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
 * Register the site's `code:` declaration as a theme, once, and answer with the
 * theme name to highlight against. Sites that declare nothing get the default.
 */
async function resolveThemeName(highlighter, codeTheme) {
  if (!codeTheme || Object.keys(codeTheme).length === 0) return DEFAULT_THEME
  if (siteThemeLoaded) return SITE_CODE_THEME

  try {
    await highlighter.loadTheme(buildCodeTheme(highlighter.getTheme(DEFAULT_THEME), codeTheme))
    siteThemeLoaded = true
    return SITE_CODE_THEME
  } catch (error) {
    console.warn('[Code] Could not apply theme.code, using the default:', error)
    return DEFAULT_THEME
  }
}

/**
 * Highlight code using Shiki
 */
async function highlightCode(code, language, highlighter, codeTheme) {
  if (!highlighter) return null

  try {
    const theme = await resolveThemeName(highlighter, codeTheme)

    // Load language if not already loaded
    const loadedLangs = highlighter.getLoadedLanguages()
    const lang = language?.toLowerCase() || 'plaintext'

    if (!loadedLangs.includes(lang) && lang !== 'plaintext') {
      try {
        await highlighter.loadLanguage(lang)
      } catch {
        // Language not available, fall back to plaintext
        return highlighter.codeToHtml(code, { lang: 'plaintext', theme })
      }
    }

    return highlighter.codeToHtml(code, {
      lang: lang === 'plaintext' ? 'text' : lang,
      theme,
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

  // Inject layout CSS on first render (if in browser). Unlike the colours, this
  // is wanted whether or not the site declared a `code:` block.
  useEffect(() => {
    injectCodeLayoutCSS()
  }, [])

  // Load Shiki and highlight code
  useEffect(() => {
    let cancelled = false

    async function highlight() {
      const highlighter = await loadShiki()
      if (cancelled) return

      if (highlighter && content) {
        const html = await highlightCode(content, lang, highlighter, codeTheme)
        if (!cancelled) {
          setHighlightedHtml(html)
        }
      }
    }

    highlight()

    return () => {
      cancelled = true
    }
  }, [content, lang, codeTheme])

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

  // Fallback: plain code block (shown before Shiki loads or if it fails).
  // No loading indicator — the code is already readable, and the syntax colours
  // arrive when Shiki does. Semantic tokens, so the wait looks like the site
  // rather than like a fixed grey no theme asked for.
  return (
    <pre
      className={cn(
        'overflow-x-auto rounded-lg bg-muted p-4 text-sm text-body',
        className
      )}
      {...props}
    >
      <code className={`language-${lang}`}>
        {content}
      </code>
    </pre>
  )
}

export default Code

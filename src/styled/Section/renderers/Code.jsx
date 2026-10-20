/**
 * Code Block Renderer
 *
 * Renders code blocks, syntax-highlighted by Shiki, which is lazy-loaded only
 * when a page actually has one. A site's `theme.yml` `code:` block becomes a
 * Shiki theme layered over the default, so the colours a site declares are the
 * colours Shiki writes.
 *
 * ⭐ ONE <pre>, BEFORE AND AFTER THE HIGHLIGHTER PAINTS. The prerender and the
 * browser's first render write the code as plain text; when Shiki arrives, the
 * same <pre> and <code> stay, and only the text inside <code> becomes coloured
 * spans — Shiki's tokens (`codeToTokens`) rendered as React children. The box
 * is static classes both states share: kit's padding and corners, the prose
 * step's size and line height inside prose (kit's 14px on 20px lines outside
 * it), and the theme's ground and text colour wherever they are known without
 * loading it (`knownCodeColors`). So nothing on the page moves when the colours
 * arrive. ⛔ Until 2026-10-19 the highlighted block was Shiki's HTML in a
 * wrapper <div>, padded by a stylesheet injected at mount: inside prose the
 * code shrank from 14px to 12.25px (the prose rule's 0.875em of the wrapper's
 * `text-sm`), its margins stopped collapsing with the paragraphs' (the wrapper
 * was a scroll container, so it held them), and each block took 34px more
 * room, plus 1px a line, when Shiki loaded.
 *
 * @module @uniweb/kit/Section/renderers/Code
 */

import React, { useEffect, useState, useMemo } from 'react'
import { loadGrammar, loadThemeByName, isCorpusName } from './shiki-corpus.js'
import { cn } from '../../../utils/index.js'
import { getUniweb } from '@uniweb/core'

// Module-level state to track CSS injection and Shiki loading
let pairCssInjected = false
let shikiInstance = null
let shikiLoadPromise = null
const loadedDerived = new Set()

// What a site gets when it declares no `code:` block of its own, and the base
// every declaration layers over.
const DEFAULT_THEME = 'github-dark'

/**
 * The default theme's ground and text, so a block paints them before the theme
 * has loaded. github-dark's own, as the Shiki release kit loads writes them —
 * kit's tests compare the two, so a Shiki upgrade that moves them fails there
 * rather than on a page.
 */
export const DEFAULT_THEME_COLORS = Object.freeze({ background: '#24292e', foreground: '#e1e4e8' })

/**
 * The block's classes, in both states. The chrome is kit's — padding, corners,
 * scrolling — and a foundation's `className` overrides it. The size and line
 * height read the prose step's variables (`prose-tokens.css` sets them on
 * `.prose`), so a block in prose takes the step's — 14px on 24px lines at the
 * base step — and one outside prose kit's 14px on 20px lines. They are
 * utilities, so they outrank the prose layer's own `pre` rule; reading its
 * variables is what keeps the two in step. The surface classes paint the site's
 * code surface until the theme's colours are known. `shiki` is on the <pre> from
 * the first paint, so a foundation's `.shiki` rules apply in both states.
 */
export const CODE_BLOCK_CLASS =
  'shiki overflow-x-auto rounded-lg p-4 text-[length:var(--_prose-small,0.875rem)] leading-[var(--_prose-pre-leading,1.4285714)] bg-[var(--code-surface,var(--muted))] text-[color:var(--code-text,var(--body))]'

/**
 * The code's face, on the <code> in both states: the site's code role
 * (`--font-code`, which theming always defines — the role's default when the
 * site sets none), else the reset's monospace stack. On the <code>, because the
 * reset gives <code> a family of its own, which a family on the <pre> would not
 * reach. ⛔ Until 2026-10-19 only the highlighted block read `--font-code` (an
 * injected `.shiki code` rule), so the face could change when Shiki loaded.
 */
export const CODE_FACE_CLASS = 'font-[family-name:var(--font-code,var(--default-mono-font-family,monospace))]'

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
 * The rules that read a light/dark pair's colours. A site that named a pair
 * gets CSS variables per token instead of inline colour (`defaultColor: false`),
 * so one rendered block follows the visitor's scheme; these read them. Scoped to
 * `.shiki-themes`, which a block carries only once a pair has highlighted it, so
 * a single-theme listing is untouched. Injected the first time a pair paints —
 * colours only, so injecting them late moves nothing. ⛔ Until 2026-10-19 this
 * stylesheet also held the block's padding, corners and code face, injected at
 * mount and unlayered, so it outranked a foundation's `className` and was
 * missing from the prerendered page.
 */
function injectThemePairCSS() {
  if (pairCssInjected || typeof document === 'undefined') return

  const styleId = 'uniweb-code-theme-pair'

  // Check if already injected (e.g., by another component instance)
  if (document.getElementById(styleId)) {
    pairCssInjected = true
    return
  }

  const style = document.createElement('style')
  style.id = styleId
  style.textContent = `
.shiki-themes {
  background-color: var(--shiki-light-bg);
}
.shiki-themes,
.shiki-themes span {
  color: var(--shiki-light);
}
.scheme-dark .shiki-themes {
  background-color: var(--shiki-dark-bg);
}
.scheme-dark .shiki-themes,
.scheme-dark .shiki-themes span {
  color: var(--shiki-dark);
}
`
  document.head.appendChild(style)
  pairCssInjected = true
}

/**
 * Lazy-load Shiki highlighter
 */
async function loadShiki() {
  if (shikiInstance) return shikiInstance
  if (shikiLoadPromise) return shikiLoadPromise

  shikiLoadPromise = (async () => {
    try {
      // ⭐ THE CORE, NOT A BUNDLE. `shiki/bundle/full` carried 332 languages and
      // 65 themes into the artifact so that a rare language could be lazily
      // highlighted; the core carries none and `shiki-corpus.js` fetches what a
      // page turns out to need. Both are dynamic imports, so a site with no code
      // block still downloads nothing.
      //
      // The JavaScript regex engine replaces the Oniguruma WASM build — 32 KB
      // against 640 KB, and no WASM asset to serve. ⚠️ It does not implement
      // every Oniguruma construct, so a grammar can fail to compile; that lands
      // in the same fallback a missing language does, and the block renders as
      // plaintext rather than not at all.
      const [{ createHighlighterCore }, { createJavaScriptRegexEngine }] = await Promise.all([
        import('shiki/core'),
        import('shiki/engine/javascript'),
      ])

      // Languages are registered on demand. The DEFAULT theme is not: it is what
      // `resolveThemeOptions` falls back to when a site's `theme.code` cannot be
      // applied, and `codeToTokens` throws on a theme name it has not loaded — so
      // the fallback would fail exactly when it is needed. One small fetch, and
      // only once a code block has already asked for a highlighter.
      shikiInstance = await createHighlighterCore({
        themes: [await loadThemeByName(DEFAULT_THEME)],
        langs: [],
        engine: createJavaScriptRegexEngine(),
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
 * Normalize `theme.yml`'s `code:` into the three forms a site can write.
 *
 *   code: dracula                     → one bundled theme
 *   code: { light: …, dark: … }       → a pair, following the visitor's scheme
 *   code: { theme?: …, <colour>: … }  → a base theme with colours overridden
 *
 * The third is the escape hatch. Naming a theme is what most sites want — 65
 * ship inside Shiki — and hand-picking a dozen syntax colours is a job few
 * people can do well. Overrides exist because "that theme, on my background"
 * is a reasonable and common ask.
 *
 * @param {string|Object} [code] - the `code:` declaration
 * @returns {{ light: Side, dark?: Side }} where Side is { base, overrides }
 */
export function parseCodeConfig(code) {
  const side = (value) => {
    if (typeof value === 'string') return { base: value, overrides: {} }
    const { theme, ...overrides } = value || {}
    return { base: theme || DEFAULT_THEME, overrides }
  }

  if (!code) return { light: { base: DEFAULT_THEME, overrides: {} } }
  if (typeof code === 'string') return { light: side(code) }

  if (code.light || code.dark) {
    return {
      light: side(code.light ?? code.dark),
      dark: side(code.dark ?? code.light),
    }
  }

  return { light: side(code) }
}

/**
 * The ground and text colour a block can paint before its theme has loaded —
 * the colours the theme will paint, so its arrival changes neither. Known for
 * the default theme (`DEFAULT_THEME_COLORS`) and for the colours a site
 * declares (`background`, `foreground`); a site that names another theme
 * without its colours, or a light/dark pair, paints its code surface until the
 * theme loads. Both colours or neither: a theme's text colour on a ground it was
 * not made for can be unreadable.
 *
 * @param {string|Object} [code] - the `code:` declaration
 * @returns {{ background: string, foreground: string }|null}
 */
export function knownCodeColors(code) {
  const config = parseCodeConfig(code)
  if (config.dark) return null
  const { base, overrides } = config.light
  const theme = base === DEFAULT_THEME ? DEFAULT_THEME_COLORS : {}
  const background = overrides.background ?? theme.background
  const foreground = overrides.foreground ?? theme.foreground
  return background && foreground ? { background, foreground } : null
}

/**
 * Make sure a side's theme is registered, and answer the name to highlight by.
 * A side with no overrides is just the bundled theme; one with overrides gets a
 * derived theme built from it.
 */
async function registerSide(highlighter, side, name) {
  if (!highlighter.getLoadedThemes().includes(side.base)) {
    // A name, not a theme: the core bundles none, so fetch it.
    await highlighter.loadTheme(await loadThemeByName(side.base))
  }
  if (Object.keys(side.overrides).length === 0) return side.base

  if (!loadedDerived.has(name)) {
    await highlighter.loadTheme({
      ...buildCodeTheme(highlighter.getTheme(side.base), side.overrides),
      name,
    })
    loadedDerived.add(name)
  }
  return name
}

/**
 * Resolve the `code:` declaration into the highlighter's theme options.
 *
 * One theme highlights the same in both schemes — right for a site whose code
 * blocks are a terminal. A pair makes Shiki emit CSS variables per token
 * (`defaultColor: false`) instead of inline colour, so one rendered block can
 * follow the visitor's choice; injectThemePairCSS supplies the rules that read
 * them.
 */
async function resolveThemeOptions(highlighter, code) {
  const config = parseCodeConfig(code)

  try {
    const light = await registerSide(highlighter, config.light, `${SITE_CODE_THEME}-light`)
    if (!config.dark) return { theme: light }

    const dark = await registerSide(highlighter, config.dark, `${SITE_CODE_THEME}-dark`)
    return { themes: { light, dark }, defaultColor: false }
  } catch (error) {
    console.warn('[Code] Could not apply theme.code, using the default:', error)
    return { theme: DEFAULT_THEME }
  }
}

/**
 * A token's own style, as Shiki's HTML renderer writes it — or a pair's per-token
 * variables.
 */
function tokenStyle(token) {
  if (token.htmlStyle) return token.htmlStyle
  const style = {}
  if (token.color) style.color = token.color
  if (token.bgColor) style.backgroundColor = token.bgColor
  const flags = token.fontStyle > 0 ? token.fontStyle : 0
  if (flags & 1) style.fontStyle = 'italic'
  if (flags & 2) style.fontWeight = 'bold'
  const decoration = [flags & 4 && 'underline', flags & 8 && 'line-through'].filter(Boolean).join(' ')
  if (decoration) style.textDecoration = decoration
  return style
}

/** A pair's root style — `--shiki-light:#…;--shiki-dark-bg:#…` — as a style object. */
function parseRootStyle(rootStyle) {
  const style = {}
  for (const declaration of String(rootStyle || '').split(';')) {
    const colon = declaration.indexOf(':')
    if (colon > 0) style[declaration.slice(0, colon).trim()] = declaration.slice(colon + 1).trim()
  }
  return style
}

/**
 * What a highlighted block draws, from `codeToTokens`: its lines of tokens, and
 * the colours the theme puts on the <pre> — inline for one theme, as variables
 * for a pair.
 *
 * @param {Object} result - Shiki's TokensResult
 * @param {boolean} pair - whether it was highlighted with a light/dark pair
 * @returns {{ tokens: Array<Array<Object>>, style: Object, pair: boolean }}
 */
export function toHighlighted(result, pair) {
  const style = pair
    ? parseRootStyle(result.rootStyle)
    : { backgroundColor: result.bg, color: result.fg }
  return { tokens: result.tokens, style, pair }
}

/**
 * Highlight code to tokens, or null when Shiki or the theme cannot.
 */
async function highlightTokens(code, language, highlighter, codeTheme) {
  if (!highlighter) return null

  try {
    const themeOptions = await resolveThemeOptions(highlighter, codeTheme)
    const pair = Boolean(themeOptions.themes)

    // Load language if not already loaded
    const loadedLangs = highlighter.getLoadedLanguages()
    let lang = language?.toLowerCase() || 'plaintext'
    if (lang === 'plaintext') lang = 'text'

    if (lang !== 'text' && !loadedLangs.includes(lang)) {
      try {
        await highlighter.loadLanguage(await loadGrammar(lang))
      } catch {
        // Not in the corpus, not reachable, or not compilable by the JS engine —
        // all three are "cannot highlight this", and a readable block beats none.
        lang = 'text'
      }
    }

    return toHighlighted(highlighter.codeToTokens(code, { lang, ...themeOptions }), pair)
  } catch (error) {
    console.warn('[Code] Highlighting failed:', error)
    return null
  }
}

/**
 * The block, in either state: one <pre> and its <code>, the same element, classes
 * and box before and after the highlighter paints. Before, the code is its text;
 * after, the same text as Shiki's tokens — a `.line` span per line, joined by the
 * line breaks the text has — so the block's size cannot change.
 *
 * @param {Object} props
 * @param {string} props.content - the code
 * @param {string} props.lang - its language, normalized — named in a `language-*`
 *   class only when it is a grammar's name, so a fence's language adds no other class
 * @param {{ background: string, foreground: string }|null} [props.colors] - what to paint before the theme loads
 * @param {{ tokens: Array<Array<Object>>, style: Object, pair: boolean }|null} [props.highlighted]
 * @param {string} [props.className]
 */
export function CodeBlock({ content, lang, colors, highlighted, className, ...props }) {
  const style = highlighted
    ? highlighted.style
    : colors
      ? { backgroundColor: colors.background, color: colors.foreground }
      : undefined

  return (
    <pre
      className={cn(CODE_BLOCK_CLASS, highlighted?.pair && 'shiki-themes', className)}
      style={style}
      tabIndex={0}
      {...props}
    >
      <code className={cn(isCorpusName(lang) && `language-${lang}`, CODE_FACE_CLASS)}>
        {highlighted
          ? highlighted.tokens.map((line, i) => (
              <React.Fragment key={i}>
                {i > 0 && '\n'}
                <span className="line">
                  {line.map((token, j) => (
                    <span key={j} style={tokenStyle(token)}>{token.content}</span>
                  ))}
                </span>
              </React.Fragment>
            ))
          : content}
      </code>
    </pre>
  )
}

/**
 * Code - Syntax highlighted code block
 *
 * @param {Object} props
 * @param {string} props.content - Code content
 * @param {string} [props.language='plaintext'] - Programming language
 * @param {string} [props.className] - Additional CSS classes, on the <pre>
 */
export function Code({ content = '', language = 'plaintext', className, ...props }) {
  const [highlighted, setHighlighted] = useState(null)

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

  // What the block paints before the theme loads: the theme's own colours where
  // they are known without loading it, so their arrival changes nothing.
  const colors = useMemo(() => knownCodeColors(codeTheme), [codeTheme])

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

  // Load Shiki and highlight code
  useEffect(() => {
    let cancelled = false

    async function highlight() {
      const highlighter = await loadShiki()
      if (cancelled) return

      if (highlighter && content) {
        const result = await highlightTokens(content, lang, highlighter, codeTheme)
        if (!cancelled && result) {
          if (result.pair) injectThemePairCSS()
          setHighlighted({ ...result, content, lang })
        }
      }
    }

    highlight()

    return () => {
      cancelled = true
    }
  }, [content, lang, codeTheme])

  // Tokens made for other text — the content changed and its own are on their
  // way — are not drawn: the block shows its text until they arrive.
  const current = highlighted?.content === content && highlighted?.lang === lang ? highlighted : null

  // No loading indicator: the code is readable from the first paint, and the
  // syntax colours arrive when Shiki does.
  return (
    <CodeBlock
      content={content}
      lang={lang}
      colors={colors}
      highlighted={current}
      className={className}
      {...props}
    />
  )
}

export default Code

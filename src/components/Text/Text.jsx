/**
 * Text Component
 *
 * Smart typography component for rendering content from semantic-parser.
 * Handles single strings or arrays of paragraphs with automatic semantic
 * tag selection and empty content filtering.
 *
 * Security Model:
 * - Assumes content is ALREADY SANITIZED at the engine level
 * - Does NOT sanitize HTML (that's the engine's responsibility)
 * - Trusts the data it receives and renders it as-is
 *
 * @module @uniweb/kit/Text
 */

import React, { memo } from 'react'
import { cn } from '../../utils/index.js'

/**
 * Text - Smart typography component
 *
 * @param {Object} props
 * @param {string|string[]} props.text - Content to render (string or array of strings)
 * @param {string} [props.as='p'] - HTML tag: 'h1'-'h6', 'p', 'div', 'span'
 * @param {boolean} [props.html=true] - Render as HTML (true) or plain text (false)
 * @param {string} [props.className] - CSS classes for wrapper/elements
 * @param {string} [props.lineAs] - Tag for each line in array. Defaults: 'div' for headings, 'p' for others
 *
 * @example
 * // Simple paragraph
 * <Text text="Hello World" />
 *
 * @example
 * // Heading
 * <Text text="Welcome" as="h1" />
 *
 * @example
 * // Multi-line heading (wrapped in single h1)
 * <Text text={["Welcome to", "Our Platform"]} as="h1" />
 *
 * @example
 * // Multiple paragraphs (each gets its own <p>)
 * <Text text={["First paragraph", "Second paragraph"]} />
 *
 * @example
 * // Rich HTML content (assumes pre-sanitized)
 * <Text text="Hello <strong>World</strong>" />
 *
 * @example
 * // Plain text (HTML tags shown as text)
 * <Text text="Show <strong>tags</strong>" html={false} />
 */
export const Text = memo(function Text({
  text,
  as = 'p',
  html = true,
  className,
  lineAs,
  ...props
}) {
  const isArray = Array.isArray(text)
  const Tag = as
  const isHeading = /^h[1-6]$/.test(as)

  // Single string input
  if (!isArray) {
    if (!text || (typeof text === 'string' && text.trim() === '')) {
      return null
    }

    if (html) {
      return (
        <Tag
          className={className}
          dangerouslySetInnerHTML={{ __html: text }}
          {...props}
        />
      )
    }

    return (
      <Tag className={className} {...props}>
        {text}
      </Tag>
    )
  }

  // Array input - filter empty content
  const filteredText = text.filter(
    (item) => typeof item === 'string' && item.trim() !== ''
  )

  if (filteredText.length === 0) {
    return null
  }

  // Determine line wrapper tag with smart defaults
  const LineTag = lineAs || (isHeading ? 'div' : 'p')

  // Multi-line heading: wrap all lines in single heading tag
  if (isHeading) {
    return (
      <Tag className={className} {...props}>
        {filteredText.map((line, i) => {
          if (html) {
            return (
              <LineTag
                key={i}
                dangerouslySetInnerHTML={{ __html: line }}
              />
            )
          }
          return <LineTag key={i}>{line}</LineTag>
        })}
      </Tag>
    )
  }

  // Non-heading arrays: render each line as separate element
  return (
    <>
      {filteredText.map((line, i) => {
        if (html) {
          return (
            <LineTag
              key={i}
              className={className}
              dangerouslySetInnerHTML={{ __html: line }}
              {...props}
            />
          )
        }
        return (
          <LineTag key={i} className={className} {...props}>
            {line}
          </LineTag>
        )
      })}
    </>
  )
})

// ============================================================================
// Semantic Wrapper Components
// ============================================================================

/**
 * H1 - Heading level 1
 * @example
 * <H1 text="Main Title" />
 * <H1 text={["Multi-line", "Title"]} />
 */
export const H1 = (props) => <Text {...props} as="h1" />

/**
 * H2 - Heading level 2
 */
export const H2 = (props) => <Text {...props} as="h2" />

/**
 * H3 - Heading level 3
 */
export const H3 = (props) => <Text {...props} as="h3" />

/**
 * H4 - Heading level 4
 */
export const H4 = (props) => <Text {...props} as="h4" />

/**
 * H5 - Heading level 5
 */
export const H5 = (props) => <Text {...props} as="h5" />

/**
 * H6 - Heading level 6
 */
export const H6 = (props) => <Text {...props} as="h6" />

/**
 * P - Paragraph
 * @example
 * <P text="A paragraph of content" />
 * <P text={["First paragraph", "Second paragraph"]} />
 */
export const P = (props) => <Text {...props} as="p" />

/**
 * Span - Inline text
 */
export const Span = (props) => <Text {...props} as="span" />

/**
 * Div - Block container
 * @example
 * <Div text={["Item 1", "Item 2"]} lineAs="span" />
 */
export const Div = (props) => <Text {...props} as="div" />

/**
 * PlainText - Text with HTML rendering disabled
 * @example
 * <PlainText text="Show <strong>tags</strong> as text" />
 */
export const PlainText = (props) => <Text {...props} html={false} />

export default Text

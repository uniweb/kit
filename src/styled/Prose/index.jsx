/**
 * Prose Component
 *
 * Renders the prose (narrative) portions of parsed content from content.sequence.
 * Data blocks (tagged code blocks, dataBlocks) are skipped — they're structured
 * data, not prose. Access them via content.data instead.
 *
 * Also works as a pure typography wrapper when given children instead of content.
 *
 * @module @uniweb/kit/styled/Prose
 */

import React from 'react'
import { cn, getChildBlockRenderer, headingId } from '../../utils/index.js'
import { SafeHtml } from '../../components/SafeHtml/index.js'
import { Image } from '../../components/Image/index.js'
import { Media } from '../../components/Media/index.js'
import { Icon } from '../../components/Icon/index.js'
import { Link } from '../../components/Link/index.js'
import { Code } from '../Section/renderers/Code.jsx'

/**
 * Prose sizes
 */
const SIZE_CLASSES = {
  sm: 'prose-sm',
  base: 'prose-base',
  lg: 'prose-lg',
  xl: 'prose-xl',
  '2xl': 'prose-2xl'
}


const INLINE_INSET_RE = /<uniweb-inset data-ref-id="([^"]+)"><\/uniweb-inset>/g

/**
 * Render an HTML paragraph fragment that contains inline-inset markers
 * (`<uniweb-inset data-ref-id="…">`). The fragment is split at marker
 * boundaries; HTML chunks render via SafeHtml, marker positions render
 * via the framework's child-block renderer (the same path block-level
 * insets use, scoped to a single inset block).
 *
 * Components rendered through this path return an inline element
 * (typically a `<span>`) so the paragraph stays a single line of prose.
 */
function renderParagraphWithInsets(html, block) {
  if (!block) return <SafeHtml value={html} as="span" />
  const InsetRenderer = getChildBlockRenderer()
  const parts = []
  let lastIdx = 0
  INLINE_INSET_RE.lastIndex = 0
  let match
  while ((match = INLINE_INSET_RE.exec(html)) !== null) {
    if (match.index > lastIdx) {
      parts.push(
        <SafeHtml
          key={`t${lastIdx}`}
          value={html.slice(lastIdx, match.index)}
          as="span"
        />
      )
    }
    const refId = match[1]
    const insetBlock = block.getInset?.(refId)
    if (insetBlock && InsetRenderer) {
      parts.push(<InsetRenderer key={`i${refId}`} blocks={[insetBlock]} />)
    }
    lastIdx = match.index + match[0].length
  }
  if (lastIdx < html.length) {
    parts.push(
      <SafeHtml key={`t${lastIdx}`} value={html.slice(lastIdx)} as="span" />
    )
  }
  return parts
}

/**
 * Render a single sequence element to React
 */
function SequenceElement({ element, block }) {
  if (!element) return null

  switch (element.type) {
    case 'heading': {
      const level = Math.min(element.level || 1, 6)
      const Tag = `h${level}`
      const id = headingId(element.text || '')
      return <Tag id={id}><SafeHtml value={element.text} as="span" /></Tag>
    }

    case 'paragraph': {
      if (!element.text) return null
      // Inline insets ride through the paragraph text as
      // `<uniweb-inset data-ref-id="…"></uniweb-inset>` markers (see
      // semantic-parser's getTextContent). When any are present, walk
      // the text once and intersperse React-rendered insets at the
      // marker positions; otherwise stick to the fast SafeHtml path.
      if (/<uniweb-inset/.test(element.text)) {
        return <p>{renderParagraphWithInsets(element.text, block)}</p>
      }
      return <p><SafeHtml value={element.text} as="span" /></p>
    }

    case 'image': {
      const { url, alt, caption, role } = element.attrs || {}
      if (role === 'icon') {
        return <Icon {...element.attrs} />
      }
      return (
        <figure>
          <Image src={url} alt={alt || caption || ''} />
          {caption && <figcaption>{caption}</figcaption>}
        </figure>
      )
    }

    case 'video': {
      // Spread, don't cherry-pick `src`. A markdown-authored video carries
      // `poster` and the playback flags (`{role=video poster=… autoplay muted
      // loop controls}`), and <Media> reads all of them — passing only the src
      // silently discarded every attribute the author wrote.
      return <Media {...element.attrs} />
    }

    case 'codeBlock': {
      return <Code content={element.text || ''} language={element.attrs?.language || ''} />
    }

    case 'dataBlock':
      return null

    case 'math': {
      // Math from $$...$$ on its own line, ```math fence, or inline
      // $...$ (the inline form doesn't reach the sequence walker — it
      // rides inside paragraph HTML — but render the same way for
      // safety in case a future caller surfaces it here). Mathml is
      // pre-compiled at parse time; the browser renders real MathML
      // natively. Foundations that want to style errors can target
      // .temml-error inside this wrapper.
      if (!element.mathml) return null
      const display = element.display !== false
      const Tag = display ? 'div' : 'span'
      return (
        <Tag
          className={display ? 'math-display' : 'math-inline'}
          dangerouslySetInnerHTML={{ __html: element.mathml }}
        />
      )
    }

    case 'list': {
      const Tag = element.style === 'ordered' ? 'ol' : 'ul'
      return (
        <Tag>
          {element.children?.map((itemSeq, i) => (
            <li key={i}>
              {itemSeq.map((el, j) => (
                <SequenceElement key={j} element={el} block={block} />
              ))}
            </li>
          ))}
        </Tag>
      )
    }

    case 'blockquote': {
      return (
        <blockquote>
          {element.children?.map((el, i) => (
            <SequenceElement key={i} element={el} block={block} />
          ))}
        </blockquote>
      )
    }

    case 'concept_block': {
      // A tagged prose fence (```md:faq). Its body is authored prose, so the
      // default branch — which returns null — would DROP it, silently, from a
      // section a foundation renders through <Prose>.
      //
      // kit does not dispatch on the tag, for the same reason it refuses to
      // answer for an `@Component` name: the set of concepts is not the
      // framework's to hold, and a foundation rendering `content.data[tag]`
      // its own way must not be shadowed by whatever kit would have picked.
      //
      // So: a VISIBLE generic box that keeps its body. Never a drop. The tag
      // rides on a data attribute, where a foundation's CSS can reach it
      // without kit having an opinion about what it means.
      const body = element.children?.map((el, i) => (
        <SequenceElement key={i} element={el} block={block} />
      ))

      return (
        <div
          data-concept={element.tag || 'unknown'}
          className="border border-border rounded-md p-4 my-4"
        >
          {body}
        </div>
      )
    }

    case 'inset_block': {
      // A component reference that carries block content — the block form of
      // an inset. Children recurse; flattening them to text is what the
      // sequence's default branch used to do, and it lost the body.
      //
      // Reaching this case means the container was NOT lifted — `@uniweb/core`
      // rewrites `inset_block` to `inset_placeholder` when it builds the render
      // graph, and the `inset` case resolves that against the foundation. This
      // is the fallback for a document rendered without a Block behind it.
      //
      // kit does NOT map the name to one of its own components — see the longer
      // note in Section/Render. A visible generic box; never a drop.
      const body = element.children?.map((el, i) => (
        <SequenceElement key={i} element={el} block={block} />
      ))

      return (
        <div
          data-inset-block={element.component || 'unknown'}
          className="border border-border rounded-md p-4 my-4"
        >
          {body}
        </div>
      )
    }

    case 'link': {
      const { href, label, role } = element.attrs || {}
      // Standalone links promoted from paragraphs
      return <p><Link to={href}>{label}</Link></p>
    }

    case 'button': {
      return <p><Link to={element.attrs?.href}>{element.text}</Link></p>
    }

    case 'divider':
      return <hr />

    case 'inset': {
      if (!block || !element.refId) return null
      const insetBlock = block.getInset(element.refId)
      if (!insetBlock) return null
      const InsetRenderer = getChildBlockRenderer()
      if (!InsetRenderer) return null
      return <InsetRenderer blocks={[insetBlock]} />
    }

    case 'icon': {
      return <Icon {...element.attrs} />
    }

    default:
      return null
  }
}

/**
 * Prose - Renders the narrative content from a parsed content sequence
 *
 * Skips data blocks (tagged code blocks, dataBlocks) — those are structured
 * data accessible via content.data, not prose to render.
 *
 * Pass `content` (the parsed content object from component props).
 * Optionally pass `block` for inset resolution.
 *
 * @param {Object} props
 * @param {Object} [props.content] - Parsed content object (has .sequence)
 * @param {Object} [props.block] - Block instance (needed for inset resolution)
 * @param {string} [props.size='lg'] - Text size: sm, base, lg, xl, 2xl
 * @param {string} [props.as='div'] - HTML element to render as
 * @param {string} [props.className] - Additional CSS classes
 * @param {React.ReactNode} [props.children] - Alternative to content (pure wrapper mode)
 *
 * @example
 * // Typical usage in a section component
 * function Lesson({ content, block }) {
 *   return <Prose content={content} block={block} />
 * }
 *
 * @example
 * // Access data blocks separately
 * <Prose content={content} block={block} />
 * {content.data.quiz && <Quiz data={content.data.quiz} />}
 *
 * @example
 * // Pure typography wrapper (backward compatible)
 * <Prose size="base">
 *   <h2>Title</h2>
 *   <p>Content...</p>
 * </Prose>
 */
export function Prose({
  block,
  content,
  size = 'lg',
  as: Component = 'div',
  className,
  children,
  ...props
}) {
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.lg
  const sequence = content?.sequence

  return (
    <Component
      className={cn('prose', sizeClass, 'max-w-none', className)}
      {...props}
    >
      {sequence
        ? sequence.map((element, i) => (
            <SequenceElement key={i} element={element} block={block} />
          ))
        : children
      }
    </Component>
  )
}

export default Prose

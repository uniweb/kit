/**
 * Render Component
 *
 * Orchestrates rendering of content blocks within a Section.
 * Dispatches to appropriate renderers based on content type.
 *
 * @module @uniweb/kit/Section/Render
 */

import React from 'react'
import { cn, getChildBlockRenderer, headingId } from '../../utils/index.js'
import { SafeHtml } from '../../components/SafeHtml/index.js'
import { Image } from '../../components/Image/index.js'
import { Media } from '../../components/Media/index.js'
import { Icon } from '../../components/Icon/index.js'
import { Link } from '../../components/Link/index.js'
import { Code } from './renderers/Code.jsx'
import { Alert } from './renderers/Alert.jsx'
import { Table } from './renderers/Table.jsx'
import { Details } from './renderers/Details.jsx'
import { Divider } from './renderers/Divider.jsx'

/**
 * Extract text content from a node
 */
function extractText(node) {
  if (!node) return ''
  if (typeof node === 'string') return node
  if (node.text) return node.text
  if (node.content) {
    return node.content.map(extractText).join('')
  }
  return ''
}


/**
 * Render a list (ordered or unordered)
 */
function renderList(items, ordered = false) {
  const Tag = ordered ? 'ol' : 'ul'
  const listClass = ordered ? 'list-decimal' : 'list-disc'

  return (
    <Tag className={cn('pl-6 space-y-1', listClass)}>
      {items?.map((item, i) => (
        <li key={i}>
          {item.content?.map((child, j) => (
            <RenderNode key={j} node={child} />
          ))}
        </li>
      ))}
    </Tag>
  )
}

/**
 * Render a single content node
 */
function RenderNode({ node, block, ...props }) {
  if (!node) return null

  const { type, attrs, content } = node

  switch (type) {
    case 'paragraph': {
      const html = extractText(node)
      if (!html) return null
      return <p><SafeHtml value={html} as="span" /></p>
    }

    case 'heading': {
      const level = attrs?.level || 1
      const text = extractText(node)
      const id = headingId(text)
      const Tag = `h${Math.min(level, 6)}`

      return (
        <Tag id={id} className="scroll-mt-20">
          {text}
        </Tag>
      )
    }

    case 'image': {
      const src = attrs?.src || ''
      const alt = attrs?.alt || ''
      const caption = attrs?.caption || ''
      const role = attrs?.role

      // Dispatch based on role attribute
      if (role === 'video') {
        // Video content - use Media component
        return (
          <Media
            src={src}
            autoplay={attrs?.autoplay}
            muted={attrs?.muted}
            loop={attrs?.loop}
            controls={attrs?.controls}
            className="my-4 rounded-lg overflow-hidden"
          />
        )
      }

      if (role === 'document') {
        // Document/file link with optional preview
        const poster = attrs?.poster
        const preview = attrs?.preview
        const filename = alt || src.split('/').pop() || 'Document'

        return (
          <figure className="my-4">
            <Link
              to={src}
              className="block group border rounded-lg overflow-hidden hover:shadow-md transition-shadow"
              target="_blank"
            >
              {(poster || preview) ? (
                <Image
                  src={poster || preview}
                  alt={filename}
                  className="w-full"
                />
              ) : (
                <div className="flex items-center gap-3 p-4 bg-muted">
                  <Icon name="download" size="24" className="text-subtle" />
                  <span className="text-link group-hover:underline">
                    {filename}
                  </span>
                </div>
              )}
            </Link>
            {caption && (
              <figcaption className="mt-2 text-sm text-subtle text-center">
                {caption}
              </figcaption>
            )}
          </figure>
        )
      }

      if (role === 'icon') {
        // Icon - use Icon component
        // Supports: ![alt](lucide:icon-name){size=24 color=blue}
        //           ![alt](icon:/path/to/icon.svg){size=32}
        const size = attrs?.size || '24'
        const iconName = attrs?.name || alt
        const iconColor = attrs?.color

        return (
          <Icon
            url={src}
            name={iconName}
            size={size}
            color={iconColor}
            className="inline-block"
          />
        )
      }

      // Default: image or banner - use Image component
      return (
        <figure className="my-4">
          <Image src={src} alt={alt} className="rounded-lg" />
          {caption && (
            <figcaption className="mt-2 text-sm text-subtle text-center">
              {caption}
            </figcaption>
          )}
        </figure>
      )
    }

    case 'video': {
      const src = attrs?.src || ''
      return <Media src={src} className="my-4 rounded-lg overflow-hidden" />
    }

    case 'codeBlock': {
      const language = attrs?.language || 'plaintext'
      const code = extractText(node)
      return <Code content={code} language={language} className="my-4" />
    }

    case 'warning':
    case 'alert': {
      const alertType = attrs?.type || 'info'
      const alertContent = content?.map(extractText).join('') || ''
      return <Alert type={alertType} content={alertContent} className="my-4" />
    }

    case 'blockquote': {
      return (
        <blockquote className="border-l-4 border-border pl-4 italic text-subtle my-4">
          {content?.map((child, i) => (
            <RenderNode key={i} node={child} block={block} />
          ))}
        </blockquote>
      )
    }

    case 'bulletList': {
      return renderList(content, false)
    }

    case 'orderedList': {
      return renderList(content, true)
    }

    case 'table': {
      return <Table content={content} className="my-4" />
    }

    // KEEP. Slated for deletion once, and it would have blanked live content.
    //
    // Verified with the frontend 2026-07-29 (channel `framework-frontend-86fd`):
    // `details` is EDITOR-AUTHORED ONLY — it is absent from `content-reader`'s
    // `getBaseSchema()`, so no markdown can produce it — and nothing converts it on
    // the way out (the app does not depend on `@uniweb/content-writer`, and its
    // container boundary mapping is not built). So this case is currently **the only
    // thing that renders an editor-authored container on a published page**, and the
    // same holds for `warning` / `alert` above.
    //
    // The retirement signal is the app's container boundary mapping landing — it
    // makes `details` an in-memory-only shape that never reaches the wire, and the
    // frontend has undertaken to say so in-channel. Until then, deleting this
    // silently blanks published content.
    case 'details': {
      const summary = attrs?.summary || 'Details'
      const detailsContent = content?.map(extractText).join('') || ''
      return (
        <Details
          summary={summary}
          content={detailsContent}
          open={attrs?.open}
          className="my-4"
        />
      )
    }

    case 'concept_block': {
      // A tagged prose fence (```md:faq) — authored prose under a concept name.
      //
      // The `default:` branch below already recurses a node's content, so the
      // body would survive without this case. It is explicit anyway, for two
      // reasons. It gives the block a container a foundation's CSS can target
      // (`[data-concept]`) instead of letting its prose flow into the page as
      // if the fence were not there; and it makes this lane agree with
      // <Prose>, whose own default DROPS an unknown element — the same content
      // rendering in one walker and vanishing in the other is worse than
      // either behaviour on its own.
      //
      // No dispatch on the tag, exactly as below: the set of concepts belongs
      // to whatever is editing or rendering the content, never to kit.
      const body = content?.map((child, i) => (
        <RenderNode key={i} node={child} block={block} />
      ))

      return (
        <div
          data-concept={attrs?.tag || 'unknown'}
          className="border border-border rounded-md p-4 my-4"
        >
          {body}
        </div>
      )
    }

    case 'inset_block': {
      // The block form of an inset: a fenced `@Component{params}` container
      // whose body is real block content, recursed like a blockquote's rather
      // than flattened to a string.
      //
      // NOTE: a container reaching this case means it was NOT lifted.
      // `@uniweb/core`'s Block rewrites every `inset_block` to an
      // `inset_placeholder` when it builds the render graph, so the normal
      // path is the `inset_placeholder` case below — which resolves the
      // component against the FOUNDATION. This branch is what is left for a
      // document rendered without a Block behind it.
      //
      // `@Component` names foundation vocabulary, so kit must not answer for
      // it. kit's own Details and Alert are not reachable through
      // `getInset()` and must not become reachable here, or a foundation
      // shipping its own Alert would be shadowed by ours. (kit still renders
      // `details` / `alert` above — those are the editor's DOCUMENT node
      // types, a different mechanism that happens to share a name.)
      //
      // So: no name dispatch. A VISIBLE generic box that keeps its body.
      // Never a drop — an unmapped node taking its subtree with it is the
      // failure this container exists to fix.
      const component = attrs?.component
      const body = content?.map((child, i) => (
        <RenderNode key={i} node={child} block={block} />
      ))

      return (
        <div
          data-inset-block={component || 'unknown'}
          className="border border-border rounded-md p-4 my-4"
        >
          {body}
        </div>
      )
    }

    case 'horizontalRule':
    case 'divider': {
      return <Divider type={attrs?.type} className="my-6" />
    }

    case 'inset_placeholder': {
      const refId = attrs?.refId
      if (!block || !refId) return null

      const insetBlock = block.getInset(refId)
      if (!insetBlock) return null

      const InsetRenderer = getChildBlockRenderer()
      return <InsetRenderer blocks={[insetBlock]} />
    }

    case 'button': {
      const href = attrs?.href || '#'
      const label = extractText(node) || attrs?.label || 'Button'
      return (
        <Link
          to={href}
          className="inline-block px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary-hover transition-colors my-2"
        >
          {label}
        </Link>
      )
    }

    case 'text': {
      // Handle inline marks (bold, italic, etc.)
      let text = node.text || ''

      if (node.marks) {
        node.marks.forEach((mark) => {
          switch (mark.type) {
            case 'bold':
            case 'strong':
              text = `<strong>${text}</strong>`
              break
            case 'italic':
            case 'em':
              text = `<em>${text}</em>`
              break
            case 'code':
              text = `<code class="px-1 py-0.5 bg-muted rounded text-sm">${text}</code>`
              break
            case 'link':
              text = `<a href="${mark.attrs?.href || '#'}" class="text-link hover:underline">${text}</a>`
              break
          }
        })
      }

      return <SafeHtml value={text} as="span" />
    }

    default:
      // Try to render children if they exist
      if (content && Array.isArray(content)) {
        return (
          <>
            {content.map((child, i) => (
              <RenderNode key={i} node={child} block={block} />
            ))}
          </>
        )
      }
      return null
  }
}

/**
 * Render - Content block renderer
 *
 * @param {Object} props
 * @param {Array|Object} props.content - Content to render (array of nodes or single node)
 * @param {string} [props.className] - Additional CSS classes
 */
export function Render({ content, block, className, ...props }) {
  // Get content from block if not provided directly
  let resolvedContent = content
  if (!resolvedContent && block) {
    resolvedContent = block.rawContent
    if (resolvedContent?.type === 'doc') {
      resolvedContent = resolvedContent.content
    }
  }

  if (!resolvedContent) return null

  const nodes = Array.isArray(resolvedContent) ? resolvedContent : [resolvedContent]

  return (
    <div className={cn('space-y-4', className)} {...props}>
      {nodes.map((node, i) => (
        <RenderNode key={i} node={node} block={block} />
      ))}
    </div>
  )
}

export default Render

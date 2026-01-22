/**
 * Render Component
 *
 * Orchestrates rendering of content blocks within a Section.
 * Dispatches to appropriate renderers based on content type.
 *
 * @module @uniweb/kit/Section/Render
 */

import React from 'react'
import { cn } from '../../utils/index.js'
import { SafeHtml } from '../../components/SafeHtml/index.js'
import { Image } from '../../components/Image/index.js'
import { Media } from '../../components/Media/index.js'
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
 * Generate ID from heading text
 */
function generateId(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
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
function RenderNode({ node, ...props }) {
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
      const id = generateId(text)
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

      return (
        <figure className="my-4">
          <Image src={src} alt={alt} className="rounded-lg" />
          {caption && (
            <figcaption className="mt-2 text-sm text-gray-500 text-center">
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
        <blockquote className="border-l-4 border-gray-300 pl-4 italic text-gray-600 my-4">
          {content?.map((child, i) => (
            <RenderNode key={i} node={child} />
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

    case 'horizontalRule':
    case 'divider': {
      return <Divider type={attrs?.type} className="my-6" />
    }

    case 'button': {
      const href = attrs?.href || '#'
      const label = extractText(node) || attrs?.label || 'Button'
      return (
        <Link
          to={href}
          className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors my-2"
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
              text = `<code class="px-1 py-0.5 bg-gray-100 rounded text-sm">${text}</code>`
              break
            case 'link':
              text = `<a href="${mark.attrs?.href || '#'}" class="text-blue-600 hover:underline">${text}</a>`
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
              <RenderNode key={i} node={child} />
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
export function Render({ content, className, ...props }) {
  if (!content) return null

  const nodes = Array.isArray(content) ? content : [content]

  return (
    <div className={cn('space-y-4', className)} {...props}>
      {nodes.map((node, i) => (
        <RenderNode key={i} node={node} />
      ))}
    </div>
  )
}

export default Render

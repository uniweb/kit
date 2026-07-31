/**
 * Render — the content engine.
 *
 * Walks a parsed content SEQUENCE and emits React. One node table, used by
 * everything in kit that renders authored content: `<Prose>` adds typography on
 * top, `<Article>` adds semantics on top of that, and a foundation can call
 * this directly.
 *
 * ── Why there is one table now ──
 *
 * There were two. This component predated the semantic parser's `sequence` and
 * walked raw ProseMirror by hand; `<Prose>` was written later against the
 * parsed shape. Same job, two implementations, and the older one rotted because
 * nothing exercised it. Measured 2026-07-30, before this rewrite:
 *
 *   - it dropped every inline mark. Its `paragraph` case called `extractText`,
 *     a helper written to extract PLAIN text, which concatenates `node.text`
 *     and discards `marks`. `Hello **world**` rendered as `Hello world`, and
 *     every link in an article vanished.
 *   - it dropped block math entirely — no `math_display` case, so a `$$…$$`
 *     fell to `default:`, which recurses `content`, which math has none of.
 *   - `<Prose>` meanwhile dropped every table, and that one was not even its
 *     fault: the sequence did not carry tables at all until the same day.
 *
 * All three were invisible because each renderer's own tests passed. Going
 * through the parser fixes the marks by construction — inline content arrives
 * already rendered to HTML with marks applied — and one table means math and
 * tables cannot be present in one lane and missing from the other.
 *
 * ── What it does NOT do ──
 *
 * Decorate. The defaults resolve references and supply behaviour — an icon's
 * library, a link's base path, a code block's highlighting, a video's playback
 * attributes — and otherwise emit semantic HTML with no classes. What a
 * blockquote LOOKS like is a foundation's decision and a site's `theme.yml`,
 * the same rule that keeps fixed palettes out of kit (framework CLAUDE.md
 * gotcha #8). The previous version carried 23 hardcoded utility strings,
 * including `italic text-subtle` on blockquote — kit deciding a foundation's
 * design, and unreachable without forking the walker.
 *
 * `components` is the seam instead: pass a component for any element type and
 * it replaces the default, receiving `{ element, block, children }`. That is
 * how a foundation renders a concept block as its own accordion, or a
 * blockquote as its own pull-quote, without kit knowing either exists.
 *
 * @module @uniweb/kit/styled/Render
 */

import React from 'react'
import { parseContent } from '@uniweb/semantic-parser'
import { getChildBlockRenderer, headingId } from '../../utils/index.js'
import { SafeHtml } from '../../components/SafeHtml/index.js'
import { Image } from '../../components/Image/index.js'
import { Media } from '../../components/Media/index.js'
import { Icon } from '../../components/Icon/index.js'
import { Link } from '../../components/Link/index.js'
import { Code } from '../Section/renderers/Code.jsx'
import { Divider } from '../Section/renderers/Divider.jsx'

const INLINE_INSET_RE = /<uniweb-inset data-ref-id="([^"]+)"><\/uniweb-inset>/g

/**
 * Element types this engine knows about and deliberately renders NOTHING for.
 *
 * Listed rather than left to fall through `default:`, so a drop is a decision
 * someone wrote down. `tests/renderer-coverage.test.js` checks this set plus
 * the rendered set against the vocabulary the parser can actually emit, which
 * is what makes a NEW element type fail a test instead of vanishing.
 */
export const NOT_RENDERED = {
  dataBlock:
    'structured data, not prose — a component reads it from content.data[tag]',
  inset_ref:
    'a BUILD-TIME intermediate. The reader emits it for `![](@Component)`; the ' +
    'build\'s content-collector extracts it into the section\'s insets and leaves ' +
    'an `inset_placeholder`, which is what the `inset` case resolves. Its attrs ' +
    'carry a component NAME and no refId, so there is nothing here to look up — ' +
    'and kit answering for the name is the shadowing the inset_block case ' +
    'refuses. Consequence worth knowing: a document rendered straight from ' +
    'markdown without that build step (a collection record body, say) loses its ' +
    'inline component references.',
  form: 'an editor node; its data reaches components as content.data[schemaId]',
  'card-group': 'an editor node, deprecated — maps to content.data[cardType]',
  'document-group': 'an editor node — its documents reach content.links',
}

/**
 * The author's `{#id}`, if they wrote one.
 *
 * Reads the same two places the xref registry reads
 * (`@uniweb/kit/xref/registry.js`), because an id that numbers a figure and an
 * id that anchors it must be the same string — otherwise `[#fig-cells]` would
 * resolve to "Figure 3" and link to nothing.
 *
 * Emitting it matters beyond cross-references: it is what makes
 * `/page#fig-cells` land on the figure, and what gives EPUB and Paged.js real
 * internal links. Until 2026-07-31 nothing emitted it, so an authored id
 * existed only inside the registry and never reached the document.
 */
function authoredId(element) {
  return element?.attrs?.id ?? element?.id ?? undefined
}

/**
 * Normalize whatever a caller passed into a sequence.
 *
 * Accepts a parsed content object (`content.sequence`), a Block (its content is
 * already parsed), a ProseMirror doc, or an array of ProseMirror nodes. A raw
 * document is run through the parser rather than walked directly — that is the
 * whole point of having one table, and it is what makes inline marks work.
 */
function toSequence(content, block) {
  if (Array.isArray(content?.sequence)) return content.sequence

  if (content?.type === 'doc') return parseContent(content).sequence
  if (Array.isArray(content)) return parseContent({ type: 'doc', content }).sequence

  if (block) {
    if (Array.isArray(block.parsedContent?.sequence)) return block.parsedContent.sequence
    const raw = block.rawContent?.doc ?? block.rawContent
    if (raw?.type === 'doc') return parseContent(raw).sequence
  }

  return null
}

/**
 * Render an HTML paragraph fragment containing inline-inset markers
 * (`<uniweb-inset data-ref-id="…">`). HTML chunks render via SafeHtml, marker
 * positions via the framework's child-block renderer — the same path
 * block-level insets take, scoped to one inset.
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
      parts.push(<SafeHtml key={`t${lastIdx}`} value={html.slice(lastIdx, match.index)} as="span" />)
    }
    const refId = match[1]
    const insetBlock = block.getInset?.(refId)
    if (insetBlock && InsetRenderer) {
      parts.push(<InsetRenderer key={`i${refId}`} blocks={[insetBlock]} />)
    }
    lastIdx = match.index + match[0].length
  }
  if (lastIdx < html.length) {
    parts.push(<SafeHtml key={`t${lastIdx}`} value={html.slice(lastIdx)} as="span" />)
  }
  return parts
}

/** Render a list of sequence elements. */
function renderAll(sequence, block, components) {
  return (sequence || []).map((element, i) => (
    <SequenceElement key={i} element={element} block={block} components={components} />
  ))
}

/**
 * A table cell's contents, with a lone block UNWRAPPED.
 *
 * The schema declares `tableCell` as `paragraph+`, so a markdown cell is always
 * exactly one block — and emitting its `<p>` faithfully is what a typography
 * layer then gives paragraph margins to. Measured on a real docs site: 17.5px
 * top and bottom inside every cell, turning a one-line reference row into 75px.
 *
 * TWO shapes reach a cell, which is easy to miss and was: an ordinary paragraph,
 * and a `link` — because the parser PROMOTES a paragraph holding nothing but a
 * link, which is what makes a link on its own line a call to action in prose.
 * A cell whose whole content is a link is the same promotion arriving somewhere
 * it means nothing, so it unwraps too. Fixing only the paragraph left every
 * link-only cell tall, which is how this was found: 17 of them on one page.
 *
 * A cell holding genuinely several blocks still gets them, because that is what
 * it is.
 */
function renderCell(cell, block, components) {
  const children = cell.children || []
  if (children.length !== 1) return renderAll(children, block, components)

  const [only] = children

  if (only?.type === 'paragraph') {
    if (!only.text) return null
    return /<uniweb-inset/.test(only.text) ? (
      renderParagraphWithInsets(only.text, block)
    ) : (
      <SafeHtml value={only.text} as="span" />
    )
  }

  if (only?.type === 'link') {
    const { href, label } = only.attrs || {}
    return <Link to={href}>{label}</Link>
  }

  if (only?.type === 'button') {
    return <Link to={only.attrs?.href}>{only.text}</Link>
  }

  return renderAll(children, block, components)
}

/**
 * One element of a sequence.
 *
 * A `components` entry for the element's type replaces the default entirely and
 * receives `{ element, block, children }` — `children` being the rendered
 * sub-elements for the container types, so an override can rewrap without
 * re-implementing the walk.
 */
export function SequenceElement({ element, block, components }) {
  if (!element) return null

  const Override = components?.[element.type]
  if (Override) {
    const children = element.children ? renderAll(element.children, block, components) : undefined
    return <Override element={element} block={block} children={children} />
  }

  switch (element.type) {
    case 'heading': {
      const level = Math.min(element.level || 1, 6)
      const Tag = `h${level}`
      // The id is the anchor `useHeadings()` and every in-page nav link
      // resolve against, so it is behaviour rather than decoration.
      return (
        <Tag id={authoredId(element) || headingId(element.text || '')}>
          <SafeHtml value={element.text} as="span" />
        </Tag>
      )
    }

    case 'paragraph': {
      if (!element.text) return null
      if (/<uniweb-inset/.test(element.text)) {
        return <p>{renderParagraphWithInsets(element.text, block)}</p>
      }
      return (
        <p>
          <SafeHtml value={element.text} as="span" />
        </p>
      )
    }

    case 'image': {
      const { url, src, alt, caption, role } = element.attrs || {}
      if (role === 'icon') return <Icon {...element.attrs} />
      return (
        <figure id={authoredId(element)}>
          <Image src={url || src} alt={alt || caption || ''} />
          {caption && <figcaption>{caption}</figcaption>}
        </figure>
      )
    }

    // Spread rather than cherry-pick: a markdown video carries poster and the
    // playback flags, and <Media> reads all of them.
    case 'video':
      return <Media {...element.attrs} />

    case 'icon':
      return <Icon {...element.attrs} />

    case 'codeBlock':
      return <Code content={element.text || ''} language={element.attrs?.language || ''} />

    case 'math': {
      // MathML is pre-compiled at parse time; the browser renders it natively,
      // so no runtime math library ships. Missing here until 2026-07-30, which
      // is why math vanished from every <Article>.
      if (!element.mathml) return null
      const display = element.display !== false
      const Tag = display ? 'div' : 'span'
      return (
        <Tag
          id={authoredId(element)}
          className={display ? 'math-display' : 'math-inline'}
          dangerouslySetInnerHTML={{ __html: element.mathml }}
        />
      )
    }

    case 'list': {
      const Tag = element.style === 'ordered' ? 'ol' : 'ul'
      return (
        <Tag>
          {element.children?.map((itemSequence, i) => (
            <li key={i}>{renderAll(itemSequence, block, components)}</li>
          ))}
        </Tag>
      )
    }

    case 'table': {
      // Semantic markup, no decoration: `<thead>` when the first row is
      // headers, `<th>`/`<td>` from each cell's own flag, and alignment and
      // spans carried through. Cells render their nested sequence, so a cell
      // keeps its marks and may hold any block.
      const rows = element.rows || []
      if (!rows.length) return null
      const [first, ...rest] = rows
      const hasHeader = first.cells?.some((cell) => cell.header)

      const renderRow = (row, key) => (
        <tr key={key}>
          {row.cells?.map((cell, i) => {
            const CellTag = cell.header ? 'th' : 'td'
            return (
              <CellTag
                key={i}
                style={cell.align ? { textAlign: cell.align } : undefined}
                colSpan={cell.colspan > 1 ? cell.colspan : undefined}
                rowSpan={cell.rowspan > 1 ? cell.rowspan : undefined}
              >
                {renderCell(cell, block, components)}
              </CellTag>
            )
          })}
        </tr>
      )

      // The one class the engine emits, and it is behaviour rather than
      // decoration: a table wider than its column has to scroll inside its own
      // box or it pushes the whole page sideways. Nothing about how the table
      // LOOKS is decided here — borders, padding and header weight come from
      // the typography layer, which answers to the site's theme.yml.
      //
      // Kept deliberately when the rest of kit's table styling went: a real
      // docs site (uniweb-site) has no table CSS of its own and relied on kit
      // for exactly this, so dropping it would have broken every wide
      // reference table on a phone.
      return (
        <div className="overflow-x-auto">
          <table id={authoredId(element)}>
            {hasHeader && <thead>{renderRow(first, 'h')}</thead>}
            <tbody>{(hasHeader ? rest : rows).map((row, i) => renderRow(row, i))}</tbody>
          </table>
        </div>
      )
    }

    case 'blockquote':
      return <blockquote>{renderAll(element.children, block, components)}</blockquote>

    case 'inset_block': {
      // A container reaching this case was NOT lifted — @uniweb/core rewrites
      // every `inset_block` to an `inset_placeholder` when it builds the render
      // graph, so the normal path is the `inset` case below, which resolves the
      // component against the FOUNDATION. This is what is left for a document
      // rendered without a Block behind it.
      //
      // kit does not map the name to one of its own components. A foundation
      // shipping its own Alert would be shadowed by ours, which inverts who
      // owns a site's vocabulary. A visible container that keeps its body,
      // never a drop.
      return (
        <div data-inset-block={element.component || 'unknown'}>
          {renderAll(element.children, block, components)}
        </div>
      )
    }

    case 'concept_block': {
      // A tagged prose fence (```md:faq). Same rule one layer over: the tag
      // names CONTENT, and the set of concepts belongs to whoever edits or
      // renders it. The tag rides on a data attribute where a foundation's CSS
      // can reach it — or it passes `components={{ concept_block: … }}` and
      // renders the concept itself.
      return (
        <div data-concept={element.tag || 'unknown'}>
          {renderAll(element.children, block, components)}
        </div>
      )
    }

    case 'inset': {
      if (!block || !element.refId) return null
      const insetBlock = block.getInset?.(element.refId)
      if (!insetBlock) return null
      const InsetRenderer = getChildBlockRenderer()
      if (!InsetRenderer) return null
      return <InsetRenderer blocks={[insetBlock]} />
    }

    // A link promoted out of a paragraph — it stood alone on its line, which is
    // how an author writes a call to action.
    case 'link': {
      const { href, label } = element.attrs || {}
      return (
        <p>
          <Link to={href}>{label}</Link>
        </p>
      )
    }

    case 'button':
      return (
        <p>
          <Link to={element.attrs?.href}>{element.text}</Link>
        </p>
      )

    // `type` is content — `---{type=dots}` is a different divider, not a
    // differently-styled one — so this resolves it rather than emitting <hr>.
    case 'divider':
      return <Divider type={element.attrs?.type} />

    default:
      return null
  }
}

/**
 * Render — walk a content sequence and emit React.
 *
 * Returns a FRAGMENT. No wrapper, no classes: spacing and typography are the
 * caller's, which is what makes this usable as an engine. `<Prose>` supplies a
 * typography container; a foundation with its own type system supplies nothing
 * and lays the elements out itself.
 *
 * @param {Object} props
 * @param {Object|Array} [props.content] - Parsed content (`.sequence`), a
 *   ProseMirror doc, or an array of ProseMirror nodes
 * @param {Object} [props.block] - Block instance; supplies content when none is
 *   passed, and resolves insets
 * @param {Object} [props.components] - Per-element-type renderer overrides
 */
export function Render({ content, block, components }) {
  const sequence = toSequence(content, block)
  if (!sequence?.length) return null
  return <>{renderAll(sequence, block, components)}</>
}

export default Render

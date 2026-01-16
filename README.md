# @uniweb/kit

Standard component library for Uniweb foundations.

## Installation

```bash
npm install @uniweb/kit
```

## Quick Start

```jsx
import { Link, Image, Section, useWebsite } from '@uniweb/kit'

function Hero() {
  const { localize } = useWebsite()

  return (
    <Section width="xl" padding="lg">
      <Image src="/hero.jpg" alt="Hero" className="rounded-xl" />
      <h1>{localize({ en: 'Welcome', fr: 'Bienvenue' })}</h1>
      <Link to="/about">Learn More</Link>
    </Section>
  )
}
```

## Components

### Primitives

#### Link

Smart link component with routing, downloads, and auto-generated accessible titles.

```jsx
import { Link } from '@uniweb/kit'

<Link to="/about">About</Link>
<Link href="https://github.com">GitHub</Link>
<Link href="/files/report.pdf">Download Report</Link>
<Link href="mailto:hello@example.com">Contact</Link>
```

| Prop | Type | Description |
|------|------|-------------|
| `to` / `href` | `string` | Destination URL |
| `title` | `string` | Tooltip (auto-generated if not provided) |
| `target` | `string` | Link target |
| `download` | `boolean` | Force download behavior |

#### Image

Versatile image component with filters and profile integration.

```jsx
import { Image } from '@uniweb/kit'

<Image src="/photo.jpg" alt="Photo" />
<Image src="/photo.jpg" filter={{ grayscale: 100 }} />
<Image profile={profile} type="avatar" size="lg" rounded />
```

| Prop | Type | Description |
|------|------|-------------|
| `src` / `url` | `string` | Image URL |
| `alt` | `string` | Alt text |
| `size` | `string` | Size preset: xs, sm, md, lg, xl, 2xl, full |
| `rounded` | `boolean\|string` | Border radius |
| `filter` | `object` | CSS filters: blur, brightness, contrast, grayscale, saturate, sepia |
| `profile` | `object` | Profile for avatar/banner images |
| `type` | `string` | Image type: avatar, banner |

#### SafeHtml

Safely render HTML with topic link resolution.

```jsx
import { SafeHtml } from '@uniweb/kit'

<SafeHtml value="<p>Hello <strong>World</strong></p>" />
<SafeHtml value='<a href="topic:about">About</a>' />
```

#### Icon

SVG icon component with built-in icons and URL loading.

```jsx
import { Icon } from '@uniweb/kit'

<Icon name="check" size="24" color="green" />
<Icon url="/icons/custom.svg" />
<Icon svg="<svg>...</svg>" />
```

Built-in icons: check, alert, user, heart, settings, star, close, menu, chevronDown, chevronRight, externalLink, download, play

### Typography

#### Text

Smart typography component for rendering semantic parser output. Handles strings or arrays with automatic tag selection.

```jsx
import { Text, H1, H2, P, PlainText } from '@uniweb/kit'

// Using semantic aliases (recommended)
<H1 text="Main Title" />
<H2 text={["Multi-line", "Subtitle"]} />
<P text="A paragraph of content" />
<P text={["First paragraph", "Second paragraph"]} />

// Using Text directly
<Text text="Hello" as="h1" />
<Text text={["Line 1", "Line 2"]} as="h2" />

// Plain text (HTML tags shown as text)
<PlainText text="Show <strong>tags</strong> as text" />
```

| Prop | Type | Description |
|------|------|-------------|
| `text` | `string\|string[]` | Content to render |
| `as` | `string` | Tag: 'h1'-'h6', 'p', 'div', 'span' |
| `html` | `boolean` | Render as HTML (default: true) |
| `lineAs` | `string` | Tag for array items |
| `className` | `string` | CSS classes |

**Semantic aliases**: `H1`, `H2`, `H3`, `H4`, `H5`, `H6`, `P`, `Span`, `Div`, `PlainText`

**Key behaviors**:
- Empty strings/arrays return `null` (no empty elements)
- Headings with arrays: all lines wrapped in single heading tag
- Paragraphs with arrays: each line gets its own `<p>` tag

### Media

#### Media

Video player for YouTube, Vimeo, and local videos.

```jsx
import { Media } from '@uniweb/kit'

<Media src="https://youtube.com/watch?v=abc123" />
<Media src="/videos/intro.mp4" controls />
<Media src="https://youtube.com/..." thumbnail="/poster.jpg" facade />
```

| Prop | Type | Description |
|------|------|-------------|
| `src` | `string` | Video URL |
| `thumbnail` | `string` | Poster image URL |
| `autoplay` | `boolean` | Auto-play video |
| `muted` | `boolean` | Mute video |
| `loop` | `boolean` | Loop video |
| `controls` | `boolean` | Show controls |
| `facade` | `boolean` | Show thumbnail with play button |

#### FileLogo

File type icons based on filename.

```jsx
import { FileLogo } from '@uniweb/kit'

<FileLogo filename="report.pdf" size="32" />
<FileLogo filename="data.xlsx" />
```

#### MediaIcon

Social media platform icons.

```jsx
import { MediaIcon } from '@uniweb/kit'

<MediaIcon type="twitter" size="24" />
<MediaIcon type="linkedin" className="text-blue-600" />
```

Supported: facebook, twitter, x, linkedin, instagram, youtube, github, medium, pinterest, email, phone, orcid, researchgate

### Content

#### Section

Rich content section with layout options.

```jsx
import { Section } from '@uniweb/kit'

<Section content={blockContent} width="lg" padding="md" />

<Section width="xl" columns="2" className="bg-gray-50">
  <div>Column 1</div>
  <div>Column 2</div>
</Section>
```

| Prop | Type | Description |
|------|------|-------------|
| `content` | `object\|array` | Content to render |
| `block` | `object` | Block object from runtime |
| `width` | `string` | sm, md, lg, xl, 2xl, full |
| `columns` | `string` | 1, 2, 3, 4 |
| `padding` | `string` | none, sm, md, lg, xl |

#### Render

Content block renderer (used internally by Section).

```jsx
import { Render } from '@uniweb/kit'

<Render content={proseMirrorContent} />
```

#### Content Renderers

Individual content type renderers:

```jsx
import { Code, Alert, Table, Details, Divider } from '@uniweb/kit'

<Code content="const x = 1" language="javascript" />
<Alert type="warning" content="Be careful!" />
<Table content={tableData} />
<Details summary="Click to expand" content="Hidden content" />
<Divider type="dots" />
```

### Utilities

#### Asset

File preview with download functionality.

```jsx
import { Asset } from '@uniweb/kit'

<Asset value="document.pdf" profile={profile} />
<Asset value={{ src: "/files/report.pdf", filename: "report.pdf" }} />
```

#### Disclaimer

Modal disclaimer dialog.

```jsx
import { Disclaimer } from '@uniweb/kit'

<Disclaimer
  title="Terms of Service"
  content="<p>Please read our terms...</p>"
  triggerText="View Terms"
/>
```

## Hooks

### useWebsite

Access website instance and utilities.

```jsx
import { useWebsite } from '@uniweb/kit'

function MyComponent() {
  const {
    website,      // Website instance
    localize,     // Localize multilingual values
    makeHref,     // Transform hrefs
    getLanguage,  // Current language
    getLanguages  // Available languages
  } = useWebsite()

  return <div>{localize({ en: 'Hello', fr: 'Bonjour' })}</div>
}
```

## Utility Functions

```jsx
import { cn, stripTags, isExternalUrl, isFileUrl, detectMediaType } from '@uniweb/kit'

// Merge Tailwind classes
cn('px-4 py-2', 'bg-blue-500', condition && 'opacity-50')

// Strip HTML tags
stripTags('<p>Hello</p>') // "Hello"

// URL utilities
isExternalUrl('https://google.com') // true
isFileUrl('/files/doc.pdf')         // true
detectMediaType('https://youtube.com/...') // 'youtube'
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Foundation (your code)                                     │
│    ├── imports @uniweb/kit (bundled into foundation)        │
│    └── @uniweb/core marked as external                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  @uniweb/runtime (browser)                                  │
│    ├── Loads foundation dynamically                         │
│    ├── Provides @uniweb/core singleton                      │
│    └── Orchestrates React rendering                         │
└─────────────────────────────────────────────────────────────┘
```

## For Foundation Creators

1. **Use kit components** for common UI patterns
2. **Use hooks** like `useWebsite` for localization and routing
3. **Don't access `globalThis.uniweb`** directly - use kit's abstractions
4. **Bundle kit, externalize core** - kit gets tree-shaken into your foundation

```js
// vite.config.js
export default {
  build: {
    rollupOptions: {
      // Kit is bundled (tree-shaken), core is external (provided by runtime)
      external: ['react', 'react-dom', 'react-router-dom', '@uniweb/core']
    }
  }
}
```

This approach lets you:
- Tree-shake unused kit components
- Override or extend kit components
- Bring your own alternative components

## License

Apache-2.0

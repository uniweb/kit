# @uniweb/kit

Standard component library for Uniweb foundations.

## Installation

```bash
npm install @uniweb/kit
```

## Usage

```jsx
import { Link, useWebsite } from '@uniweb/kit'

function MyComponent() {
  const { localize } = useWebsite()

  return (
    <Link to="/about">
      {localize({ en: 'About Us', fr: 'À propos' })}
    </Link>
  )
}
```

## Components

### Link

Smart link component that handles internal navigation, external links, and downloads.

```jsx
import { Link } from '@uniweb/kit'

// Internal navigation
<Link to="/about">About</Link>

// External link (opens in new tab automatically)
<Link href="https://github.com">GitHub</Link>

// File download
<Link href="/files/report.pdf">Download Report</Link>

// Email link
<Link href="mailto:hello@example.com">Contact Us</Link>
```

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `to` | `string` | Destination URL (alias for `href`) |
| `href` | `string` | Destination URL |
| `title` | `string` | Tooltip text (auto-generated if not provided) |
| `target` | `string` | Link target (`_blank`, `_self`, etc.) |
| `download` | `boolean` | Force download behavior |
| `className` | `string` | CSS classes |
| `children` | `ReactNode` | Link content |

## Hooks

### useWebsite

Access the current website instance and common utilities.

```jsx
import { useWebsite } from '@uniweb/kit'

function MyComponent() {
  const {
    website,      // Website instance
    localize,     // Localize multilingual values
    makeHref,     // Transform hrefs (topic: protocol, etc.)
    getLanguage,  // Current language code
    getLanguages  // Available languages
  } = useWebsite()

  return <div>{localize({ en: 'Hello', fr: 'Bonjour' })}</div>
}
```

## Utilities

```jsx
import { cn, stripTags, isExternalUrl, isFileUrl, detectMediaType } from '@uniweb/kit'

// Merge Tailwind classes
cn('px-4 py-2', 'bg-blue-500', condition && 'opacity-50')

// Strip HTML tags
stripTags('<p>Hello <b>World</b></p>') // "Hello World"

// Check URL types
isExternalUrl('https://google.com') // true
isFileUrl('/files/doc.pdf')         // true
detectMediaType('https://youtube.com/...') // 'youtube'
```

## Architecture

Kit components use `@uniweb/core` internally to access runtime state. Foundation creators should use kit components rather than accessing the core directly.

```
Foundation Component
        │
        ▼
   @uniweb/kit (Link, Image, Media, ...)
        │
        ▼
   @uniweb/core (Uniweb, Website, ...)
        │
        ▼
   @uniweb/runtime (React renderers, Vite plugins)
```

## For Foundation Creators

1. **Use kit components** for common UI patterns (links, images, media)
2. **Use hooks** like `useWebsite` for localization and routing
3. **Don't access `globalThis.uniweb`** directly - use kit's abstractions

## License

Apache-2.0

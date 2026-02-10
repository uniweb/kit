# @uniweb/kit

Standard component library for Uniweb foundations. Tree-shakeable utilities, components, and hooks for building foundation components.

## Installation

```bash
npm install @uniweb/kit
```

## Tree-Shaking Benefits

Kit is designed to be bundled into your foundation (not externalized like `@uniweb/core`). This means:

- **Only what you use is bundled** — Import 3 components? Only those 3 end up in your foundation
- **No runtime overhead** — Unused code is eliminated at build time
- **Customizable** — Override or extend any component without carrying dead code
- **Small foundations** — A minimal foundation using just `Link` and `useWebsite` stays tiny

```js
// vite.config.js - Kit is bundled, core is external
export default {
  build: {
    rollupOptions: {
      external: ['react', 'react-dom', 'react-router-dom', '@uniweb/core']
      // Note: @uniweb/kit is NOT in external — it gets tree-shaken
    }
  }
}
```

## Quick Start

```jsx
import { Link, Image, useWebsite } from '@uniweb/kit'

function Hero({ content }) {
  const { localize } = useWebsite()

  return (
    <div>
      <Image src={content.images[0]?.url} alt="Hero" />
      <h1>{localize({ en: 'Welcome', es: 'Bienvenido' })}</h1>
      <Link to="/about">Learn More</Link>
    </div>
  )
}
```

---

## Components

### Link

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
| `title` | `string` | Tooltip (auto-generated if omitted) |
| `target` | `string` | Link target |
| `download` | `boolean` | Force download behavior |

### Image

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
| `size` | `string` | Preset: xs, sm, md, lg, xl, 2xl, full |
| `rounded` | `boolean\|string` | Border radius |
| `filter` | `object` | CSS filters: blur, brightness, contrast, grayscale, saturate, sepia |
| `profile` | `object` | Profile for avatar/banner images |
| `type` | `string` | Image type: avatar, banner |

### SafeHtml

Safely render HTML with topic link resolution.

```jsx
import { SafeHtml } from '@uniweb/kit'

<SafeHtml value="<p>Hello <strong>World</strong></p>" />
<SafeHtml value='<a href="topic:about">About</a>' />
```

### Icon

SVG icon component with built-in icons and URL loading.

```jsx
import { Icon } from '@uniweb/kit'

<Icon name="check" size="24" color="green" />
<Icon url="/icons/custom.svg" />
<Icon svg="<svg>...</svg>" />
```

Built-in: check, alert, user, heart, settings, star, close, menu, chevronDown, chevronRight, externalLink, download, play

### SocialIcon

Social media platform icons with automatic detection.

```jsx
import { SocialIcon, getSocialPlatform, filterSocialLinks } from '@uniweb/kit'

<SocialIcon platform="twitter" size={24} />
<SocialIcon url="https://twitter.com/example" />

// Utilities
getSocialPlatform('https://linkedin.com/in/user')  // 'linkedin'
filterSocialLinks(links)  // Filter to only social links
```

Supported: facebook, twitter, x, linkedin, instagram, youtube, github, medium, pinterest, tiktok, discord, mastodon, bluesky, email, phone, orcid, researchgate, googlescholar

### Typography

Smart typography components for rendering semantic parser output.

```jsx
import { Text, H1, H2, P, PlainText } from '@uniweb/kit'

<H1 text="Main Title" />
<H2 text={["Multi-line", "Subtitle"]} />
<P text="A paragraph of content" />
<P text={["First paragraph", "Second paragraph"]} />

// Plain text (HTML shown as text)
<PlainText text="Show <strong>tags</strong> as text" />
```

| Prop | Type | Description |
|------|------|-------------|
| `text` | `string\|string[]` | Content to render |
| `as` | `string` | Tag: 'h1'-'h6', 'p', 'div', 'span' |
| `html` | `boolean` | Render as HTML (default: true) |
| `lineAs` | `string` | Tag for array items |

Aliases: `H1`, `H2`, `H3`, `H4`, `H5`, `H6`, `P`, `Span`, `Div`, `PlainText`

### Media

Video player for YouTube, Vimeo, and local videos.

```jsx
import { Media } from '@uniweb/kit'

<Media src="https://youtube.com/watch?v=abc123" />
<Media src="/videos/intro.mp4" controls />
<Media src="https://youtube.com/..." thumbnail="/poster.jpg" facade />
```

### FileLogo

File type icons based on filename.

```jsx
import { FileLogo } from '@uniweb/kit'

<FileLogo filename="report.pdf" size="32" />
```

### MediaIcon

Platform icons (YouTube, Vimeo, etc.).

```jsx
import { MediaIcon } from '@uniweb/kit'

<MediaIcon type="youtube" size="24" />
```

### Asset

File preview with download functionality.

```jsx
import { Asset } from '@uniweb/kit'

<Asset value="document.pdf" profile={profile} />
```

---

## Hooks

### useWebsite

Access website instance and utilities.

```jsx
import { useWebsite } from '@uniweb/kit'

function MyComponent() {
  const {
    website,      // Website instance
    localize,     // Localize multilingual values
    makeHref,     // Transform hrefs (topic:, locale prefixes)
    getLanguage,  // Current language code
    getLanguages  // Available languages
  } = useWebsite()

  return <div>{localize({ en: 'Hello', fr: 'Bonjour' })}</div>
}
```

### useActiveRoute

Detect active navigation state.

```jsx
import { useActiveRoute } from '@uniweb/kit'

function NavLink({ page }) {
  const { isActive, isActiveOrAncestor } = useActiveRoute()

  return (
    <Link
      to={page.route}
      className={isActiveOrAncestor(page) ? 'font-bold' : ''}
    >
      {page.title}
    </Link>
  )
}
```

### useScrolled

Detect scroll position for sticky headers.

```jsx
import { useScrolled } from '@uniweb/kit'

function Header() {
  const scrolled = useScrolled(50)  // Threshold in pixels

  return (
    <header className={scrolled ? 'shadow-md' : ''}>
      ...
    </header>
  )
}
```

### useMobileMenu

Mobile menu state management.

```jsx
import { useMobileMenu } from '@uniweb/kit'

function Navbar() {
  const { isOpen, toggle, close } = useMobileMenu()

  return (
    <>
      <button onClick={toggle}>Menu</button>
      {isOpen && <MobileMenu onClose={close} />}
    </>
  )
}
```

### useAccordion

Accordion/FAQ state management.

```jsx
import { useAccordion } from '@uniweb/kit'

function FAQ({ items }) {
  const { isOpen, toggle } = useAccordion()

  return items.map((item, i) => (
    <div key={i}>
      <button onClick={() => toggle(i)}>{item.question}</button>
      {isOpen(i) && <p>{item.answer}</p>}
    </div>
  ))
}
```

### useInView

Viewport intersection detection for lazy loading and animations.

```jsx
import { useInView, useIsInView } from '@uniweb/kit'

function AnimatedSection() {
  const { ref, inView } = useInView({ threshold: 0.2, once: true })

  return (
    <div ref={ref} className={inView ? 'animate-fade-in' : 'opacity-0'}>
      Content appears when scrolled into view
    </div>
  )
}

// Simple boolean version
function LazyImage({ src }) {
  const [ref, isInView] = useIsInView()
  return <div ref={ref}>{isInView && <img src={src} />}</div>
}
```

### useGridLayout

Responsive grid utilities.

```jsx
import { useGridLayout, getGridClasses } from '@uniweb/kit'

function Gallery({ items }) {
  const { columns } = useGridLayout(items.length, { maxColumns: 4 })

  return (
    <div className={getGridClasses(columns)}>
      {items.map(item => <Card key={item.id} {...item} />)}
    </div>
  )
}
```

### Theme Hooks

Access site theming data at runtime.

```jsx
import {
  useThemeData,
  useThemeColor,
  useThemeColorVar,
  useColorContext,
  useAppearance
} from '@uniweb/kit'

function ThemedComponent({ block }) {
  // Full theme access
  const theme = useThemeData()
  const palettes = theme?.getPaletteNames()  // ['primary', 'secondary', ...]

  // Get specific color
  const primaryColor = useThemeColor('primary', 500)  // '#3b82f6'
  const primaryVar = useThemeColorVar('primary', 600)  // 'var(--primary-600)'

  // Context-aware (light/medium/dark sections)
  const context = useColorContext(block)  // 'light' | 'medium' | 'dark'

  // Dark mode
  const { scheme, toggle, canToggle } = useAppearance()

  return (
    <div style={{ color: primaryColor }}>
      {canToggle && (
        <button onClick={toggle}>
          {scheme === 'dark' ? 'Light' : 'Dark'}
        </button>
      )}
    </div>
  )
}
```

---

## Search

Full-text search powered by Fuse.js. Requires `fuse.js` as a peer dependency in your foundation.

```bash
npm install fuse.js
```

### useSearch

Main search hook with debouncing and state management.

```jsx
import { useSearch, useWebsite } from '@uniweb/kit'

function SearchComponent() {
  const { website } = useWebsite()
  const { query, results, isLoading, isEnabled, preload } = useSearch(website)

  if (!isEnabled) return null

  return (
    <div>
      <input onChange={e => query(e.target.value)} placeholder="Search..." />
      {isLoading && <span>Searching...</span>}
      {results.map(r => (
        <a key={r.id} href={r.href}>{r.title}</a>
      ))}
    </div>
  )
}
```

### useSearchWithIntent

Intent-based preloading — loads search index on hover/focus instead of page load.

```jsx
import { useSearchWithIntent, useSearchShortcut } from '@uniweb/kit'

function SearchButton({ onClick }) {
  const { website } = useWebsite()
  const { triggerPreload, intentProps } = useSearchWithIntent(website)

  // Cmd/Ctrl+K shortcut with preload
  useSearchShortcut({
    onOpen: onClick,
    onPreload: triggerPreload,
  })

  return (
    <button onClick={onClick} {...intentProps}>
      Search
    </button>
  )
}
```

This saves bandwidth — the search index only loads when users show intent to search.

### useSearchShortcut

Keyboard shortcut for opening search.

```jsx
import { useSearchShortcut } from '@uniweb/kit'

// Simple
useSearchShortcut(() => setSearchOpen(true))

// With preload on shortcut
useSearchShortcut({
  onOpen: () => setSearchOpen(true),
  onPreload: () => searchClient.preload()
})
```

### createSearchClient

Low-level search client for advanced use.

```jsx
import { createSearchClient } from '@uniweb/kit'

const client = createSearchClient(website, {
  fuseOptions: { threshold: 0.3 },
  defaultLimit: 10
})

// Query
const results = await client.query('authentication', { limit: 5 })

// Preload index
await client.preload()

// Check status
client.isEnabled()
client.getIndexUrl()
```

---

## Styled Components

Pre-styled components with Tailwind CSS.

```jsx
import { Section, SidebarLayout, Disclaimer } from '@uniweb/kit'

<Section width="lg" padding="md" className="bg-gray-50">
  <h1>Welcome</h1>
</Section>

<SidebarLayout sidebar={<Nav />} sidebarPosition="left">
  <main>Content</main>
</SidebarLayout>

<Disclaimer
  title="Terms of Service"
  content="<p>Please read our terms...</p>"
  triggerText="View Terms"
/>
```

---

## Utilities

```jsx
import { cn, stripTags, isExternalUrl, isFileUrl, detectMediaType } from '@uniweb/kit'

// Merge Tailwind classes (uses tailwind-merge)
cn('px-4 py-2', 'bg-blue-500', condition && 'opacity-50')

// Strip HTML tags
stripTags('<p>Hello</p>')  // "Hello"

// URL utilities
isExternalUrl('https://google.com')  // true
isFileUrl('/files/doc.pdf')          // true
detectMediaType('https://youtube.com/...')  // 'youtube'
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Foundation (your code)                                     │
│    ├── imports @uniweb/kit (bundled, tree-shaken)           │
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

### Why bundle kit but externalize core?

- **Kit**: Different foundations may use different subsets of kit. Tree-shaking ensures each foundation only includes what it uses.

- **Core**: Contains the Website, Page, and Block classes that must be singletons. The runtime provides these — foundations reference them via the external import.

## License

Apache-2.0

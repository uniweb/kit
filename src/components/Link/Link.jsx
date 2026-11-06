/**
 * Link Component
 *
 * A smart link wrapper that handles:
 * - Internal navigation via React Router
 * - A relative path, where the browser takes it
 * - External links with appropriate attributes
 * - File downloads
 * - A generated tooltip where a link does something its text may not say:
 *   leaves the site, downloads a file, writes an email, places a call
 *
 * @module @uniweb/kit/Link
 */

import React from 'react'
import { useWebsite } from '../../hooks/useWebsite.js'
import { isExternalUrl, isFileUrl } from '../../utils/index.js'
import { applyBasePath, resolveRoute } from '../../utils/href.js'
import { stepBackOnClick } from '../../utils/go-back.js'

/**
 * Social media platforms for auto-generating link titles
 */
const SOCIAL_PLATFORMS = {
  'twitter.com': 'Twitter',
  'x.com': 'X',
  'facebook.com': 'Facebook',
  'linkedin.com': 'LinkedIn',
  'instagram.com': 'Instagram',
  'youtube.com': 'YouTube',
  'github.com': 'GitHub',
  'medium.com': 'Medium'
}

/**
 * Detect if URL is a social media link
 * @param {string} url
 * @returns {string|null} Platform name or null
 */
function detectSocialPlatform(url) {
  if (!url) return null

  try {
    const urlObj = new URL(url)
    const host = urlObj.hostname.replace('www.', '')

    for (const [domain, name] of Object.entries(SOCIAL_PLATFORMS)) {
      if (host.includes(domain)) return name
    }
  } catch {
    // Invalid URL
  }

  return null
}

/**
 * The tooltip a link gets when its caller gives none: the service, address or number it reaches,
 * which is the same in every language and all a link holding only an icon has for a name. Anything
 * else is left to its text.
 *
 * ⛔ Until 2026-11-02 it was a sentence kit wrote: `Open external link`, `Download file`, `Send email
 * to …`, `View on …`, in up to three languages and English on any other. A screen reader took it over
 * the link's own text on some sites, so a foundation had to work around it [Diego: kit shouldn't force
 * English]. And until 2026-09-30 an internal link got `Go to <its path>` [Diego: "stop adding it to
 * internal links"].
 *
 * @param {string} href - The link URL
 * @returns {string} the tooltip, or '' for none
 */
function generateTitle(href) {
  if (!href) return ''
  const platform = detectSocialPlatform(href)
  if (platform) return platform
  if (href.startsWith('mailto:')) return href.replace('mailto:', '').split('?')[0]
  if (href.startsWith('tel:')) return href.replace('tel:', '')
  return ''
}

/**
 * A relative path — `about`, `../guide`, `deploying.md#setup` — as opposed to a site path
 * (`/about`), a fragment, a query, or anything with a scheme.
 *
 * @param {string} href
 * @returns {boolean}
 */
function isRelativePath(href) {
  return !!href && !/^(?:[a-z][a-z0-9+.-]*:|[/#?])/i.test(href)
}

/**
 * Link - Smart link component for Uniweb foundations
 *
 * @param {Object} props
 * @param {string} [props.to] - Destination URL (alias for href)
 * @param {string} [props.href] - Destination URL
 * @param {string} [props.title] - Custom title/tooltip. Without one, a link to a social
 *   service, an email address or a phone number shows that name, address or number, and any
 *   other link has none
 * @param {string} [props.target] - Where the link opens (_self, _blank, _parent, _top), on
 *   every kind of link. Without one, an external link or a download opens in a new tab
 *   and any other link in this one
 * @param {string} [props.className] - CSS classes
 * @param {boolean} [props.download] - Force download behavior
 * @param {boolean} [props.reload] - Force full page reload (renders <a> with basePath prefix)
 * @param {boolean} [props.back] - A link back to the page the visitor came from: a plain click
 *   steps back to it, where they left it, when the step before this one is that page, and follows
 *   the link otherwise. It renders as any link does (`utils/go-back.js`)
 * @param {Function} [props.onClick] - Called first; a click it prevents goes nowhere
 * @param {React.ReactNode} props.children - Link content
 *
 * @example
 * // Internal link
 * <Link to="/about">About Us</Link>
 *
 * @example
 * // External link (automatically opens in new tab)
 * <Link href="https://github.com">GitHub</Link>
 *
 * @example
 * // Download link
 * <Link href="/files/report.pdf" download>Download Report</Link>
 *
 * @example
 * // Back to the list the visitor came from, scrolled where they left it
 * <Link to="/store" back>All solutions</Link>
 */
export function Link({
  to,
  href,
  title,
  target,
  download,
  className,
  children,
  reload,
  back,
  onClick,
  ...props
}) {
  const { website, getRoutingComponents } = useWebsite()
  const RouterLink = getRoutingComponents()?.Link

  // Normalize href
  const authoredHref = href || to || ''

  // Resolve the authored href to a route: page: internal references,
  // then slug translation and the locale prefix. Shared with prose rendering
  // (utils/href.js) so a link written in markdown and a link passed to <Link>
  // mean the same thing.
  //
  // `reload` opts out of the locale step only — its href comes from
  // getLocaleUrl() and already carries the TARGET locale, which re-resolving
  // against the ACTIVE one would clobber. Internal references still resolve.
  //
  // The base path is applied per-branch below, not here, because a
  // Router-rendered link gets it from the router's basename instead.
  const linkHref = resolveRoute(authoredHref, website, { locale: !reload })

  // Determine if this should be a download
  const isDownload = download || isFileUrl(linkHref)

  // Determine if external
  const isExternal = isExternalUrl(linkHref)

  // A generated tooltip when none is given — none at all rather than an empty one.
  const linkTitle = title || generateTitle(linkHref) || undefined

  // `back`: the click steps back when the visitor came from this page, and nothing else changes.
  // A page load (`reload`) and another tab are what they say.
  const handleClick =
    back && !reload && (!target || target === '_self')
      ? (event) => {
          onClick?.(event)
          stepBackOnClick(event, linkHref, website)
        }
      : onClick

  // Links with reload: render plain <a> for full page navigation
  // Used for locale switches (same-domain or cross-domain)
  if (reload && !isDownload) {
    const basePath = !isExternal ? (website?.basePath || '') : ''
    return (
      <a
        href={applyBasePath(linkHref, basePath)}
        target={target}
        title={linkTitle}
        className={className}
        data-reload="true"
        onClick={handleClick}
        {...props}
      >
        {children}
      </a>
    )
  }

  // File downloads. A site-relative file lives under the deployment base like
  // everything else, so the base applies here too — it used to be omitted,
  // which broke every download link on a subdirectory deploy. applyBasePath
  // leaves an absolute URL alone, so an off-site download is unaffected.
  if (isDownload) {
    return (
      <a
        href={applyBasePath(linkHref, website?.basePath || '')}
        download
        target={target || '_blank'}
        rel="noopener noreferrer"
        title={linkTitle}
        className={className}
        onClick={handleClick}
        {...props}
      >
        {children}
      </a>
    )
  }

  // External links
  if (isExternal) {
    return (
      <a
        href={linkHref}
        target={target || '_blank'}
        rel="noopener noreferrer"
        title={linkTitle}
        className={className}
        onClick={handleClick}
        {...props}
      >
        {children}
      </a>
    )
  }

  // Special protocols (mailto:, tel:)
  if (linkHref.startsWith('mailto:') || linkHref.startsWith('tel:')) {
    return (
      <a
        href={linkHref}
        target={target}
        title={linkTitle}
        className={className}
        onClick={handleClick}
        {...props}
      >
        {children}
      </a>
    )
  }

  // A relative path goes where the browser takes it: resolved against this page's URL, as a
  // link written in prose is — the runtime's link interceptor routes either click the same way.
  // No base path: the page's URL already holds it.
  //
  // ⛔ Until 2026-10-26 it went to React Router, which resolves it against the route instead:
  // `../reference/x` from /docs/getting-started/quickstart was /reference/x in the browser's
  // render and /docs/reference/x in the prerendered page, which has no router. A link-only
  // table cell or a link on its own line, which the parser makes a `link`, reaches the page
  // through here; a link inside a sentence never did.
  if (isRelativePath(linkHref)) {
    return (
      <a
        href={linkHref}
        target={target}
        title={linkTitle}
        className={className}
        onClick={handleClick}
        {...props}
      >
        {children}
      </a>
    )
  }

  // The site's home under a base path is the base itself, `/shop/`: what the prerender writes, and
  // where a static host serves the home. React Router writes its basename without the slash, so
  // the browser's render named the home `/shop`, and a link copied or opened in a new tab took a
  // redirect, or a 404 on a host that makes none. A plain <a> says the same in both renderers; the
  // runtime's link interceptor routes the click (measured 2026-10-26 on a shop built under
  // `/shop/`, where every page's logo link differed).
  if (RouterLink && website?.basePath && linkHref === '/') {
    return (
      <a
        href={applyBasePath(linkHref, website.basePath)}
        target={target}
        title={linkTitle}
        className={className}
        onClick={handleClick}
        {...props}
      >
        {children}
      </a>
    )
  }

  // Internal links - use React Router if available
  if (RouterLink) {
    return (
      <RouterLink
        to={linkHref}
        target={target}
        title={linkTitle}
        className={className}
        onClick={handleClick}
        {...props}
      >
        {children}
      </RouterLink>
    )
  }

  // Fallback to regular anchor (SSG prerender — no React Router)
  const basePath = website?.basePath || ''
  return (
    <a
      href={applyBasePath(linkHref, basePath)}
      target={target}
      title={linkTitle}
      className={className}
      onClick={handleClick}
      {...props}
    >
      {children}
    </a>
  )
}

export default Link

/**
 * Link Component
 *
 * A smart link wrapper that handles:
 * - Internal navigation via React Router
 * - External links with appropriate attributes
 * - File downloads
 * - Auto-generated accessible titles
 *
 * @module @uniweb/kit/Link
 */

import React from 'react'
import { useWebsite } from '../../hooks/useWebsite.js'
import { isExternalUrl, isFileUrl } from '../../utils/index.js'
import { applyBasePath, resolveRoute } from '../../utils/href.js'

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
 * Generate an accessible title for a link
 * @param {string} href - The link URL
 * @param {Function} localize - Localization function
 * @returns {string}
 */
function generateTitle(href, localize) {
  if (!href) return ''

  // Social media links
  const platform = detectSocialPlatform(href)
  if (platform) {
    return localize({
      en: `View on ${platform}`,
      fr: `Voir sur ${platform}`,
      es: `Ver en ${platform}`
    })
  }

  // Email links
  if (href.startsWith('mailto:')) {
    const email = href.replace('mailto:', '').split('?')[0]
    return localize({
      en: `Send email to ${email}`,
      fr: `Envoyer un e-mail à ${email}`,
      es: `Enviar correo a ${email}`
    })
  }

  // Phone links
  if (href.startsWith('tel:')) {
    const phone = href.replace('tel:', '')
    return localize({
      en: `Call ${phone}`,
      fr: `Appeler ${phone}`,
      es: `Llamar a ${phone}`
    })
  }

  // File downloads
  if (isFileUrl(href)) {
    return localize({
      en: 'Download file',
      fr: 'Télécharger le fichier',
      es: 'Descargar archivo'
    })
  }

  // External links
  if (isExternalUrl(href)) {
    return localize({
      en: 'Open external link',
      fr: 'Ouvrir le lien externe',
      es: 'Abrir enlace externo'
    })
  }

  // Internal links - humanize the path
  try {
    const url = new URL(href, window.location.origin)
    const path = decodeURIComponent(url.pathname)
      .replace(/^\/+/, '')
      .replace(/[-_]/g, ' ')
      .replace(/\.\w+$/, '')
      .trim()

    if (path) {
      return localize({
        en: `Go to ${path}`,
        fr: `Aller à ${path}`,
        es: `Ir a ${path}`
      })
    }
  } catch {
    // Invalid URL
  }

  return ''
}

/**
 * Link - Smart link component for Uniweb foundations
 *
 * @param {Object} props
 * @param {string} [props.to] - Destination URL (alias for href)
 * @param {string} [props.href] - Destination URL
 * @param {string} [props.title] - Custom title/tooltip (auto-generated if not provided)
 * @param {string} [props.target] - Link target (_blank, _self, etc.)
 * @param {string} [props.className] - CSS classes
 * @param {boolean} [props.download] - Force download behavior
 * @param {boolean} [props.reload] - Force full page reload (renders <a> with basePath prefix)
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
  ...props
}) {
  const { website, localize, getRoutingComponents } = useWebsite()
  const RouterLink = getRoutingComponents()?.Link

  // Normalize href
  const authoredHref = href || to || ''

  // Resolve the authored href to a route: page:/topic: internal references,
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

  // Auto-generate title if not provided
  const linkTitle = title || generateTitle(linkHref, localize)

  // Links with reload: render plain <a> for full page navigation
  // Used for locale switches (same-domain or cross-domain)
  if (reload && !isDownload) {
    const basePath = !isExternal ? (website?.basePath || '') : ''
    return (
      <a
        href={applyBasePath(linkHref, basePath)}
        title={linkTitle}
        className={className}
        data-reload="true"
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
        target="_blank"
        rel="noopener noreferrer"
        title={linkTitle}
        className={className}
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
        title={linkTitle}
        className={className}
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
        title={linkTitle}
        className={className}
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
      title={linkTitle}
      className={className}
      {...props}
    >
      {children}
    </a>
  )
}

export default Link

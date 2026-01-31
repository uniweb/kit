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
  const { website, localize, makeHref, getRoutingComponents } = useWebsite()
  const RouterLink = getRoutingComponents()?.Link

  // Normalize href
  let linkHref = href || to || ''

  // Handle internal reference protocols
  // - topic: legacy internal reference
  // - page: stable page reference (page:pageId#sectionId)
  if (linkHref.startsWith('topic:') || linkHref.startsWith('page:')) {
    linkHref = makeHref(linkHref)
  }

  // Add locale prefix for internal links in non-default locales
  // Skip when reload is true — the caller provides a fully-resolved URL
  // (e.g., getLocaleUrl() already includes the target locale prefix)
  if (!reload && linkHref.startsWith('/') && !isExternalUrl(linkHref)) {
    if (website?.hasMultipleLocales?.()) {
      const activeLocale = website.getActiveLocale()
      const defaultLocale = website.getDefaultLocale()
      if (activeLocale && activeLocale !== defaultLocale) {
        // Translate route slug for current locale (e.g., /about → /acerca-de)
        if (website.translateRoute) {
          linkHref = website.translateRoute(linkHref, activeLocale)
        }
        const prefix = `/${activeLocale}`
        if (!linkHref.startsWith(`${prefix}/`) && linkHref !== prefix) {
          linkHref = linkHref === '/' ? `${prefix}/` : `${prefix}${linkHref}`
        }
      }
    }
  }

  // Determine if this should be a download
  const isDownload = download || isFileUrl(linkHref)

  // Determine if external
  const isExternal = isExternalUrl(linkHref)

  // Auto-generate title if not provided
  const linkTitle = title || generateTitle(linkHref, localize)

  // Internal links with reload: render <a> with basePath prefix
  // Used for locale switches that need a full page reload
  if (reload && !isExternal && !isDownload) {
    const basePath = website?.basePath || ''
    return (
      <a
        href={basePath + linkHref}
        title={linkTitle}
        className={className}
        {...props}
      >
        {children}
      </a>
    )
  }

  // File downloads
  if (isDownload) {
    return (
      <a
        href={linkHref}
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
      href={basePath + linkHref}
      title={linkTitle}
      className={className}
      {...props}
    >
      {children}
    </a>
  )
}

export default Link

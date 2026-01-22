import React, { useEffect } from 'react'
import { cn } from '../../utils/index.js'
import { useMobileMenu } from '../../hooks/useMobileMenu.js'

/**
 * SidebarLayout Component
 *
 * A flexible layout with a single sidebar that works on both desktop and mobile.
 * On desktop, the sidebar is always visible. On mobile, it's hidden behind a
 * floating action button (FAB) that opens a slide-out drawer.
 *
 * The layout is "sandwiched" - header and footer span the full width,
 * with the sidebar and content area between them.
 *
 * @example
 * // In foundation's src/exports.js
 * import { SidebarLayout } from '@uniweb/kit'
 *
 * export default {
 *   Layout: SidebarLayout,
 * }
 *
 * @example
 * // With custom configuration
 * import { SidebarLayout } from '@uniweb/kit'
 *
 * function CustomLayout(props) {
 *   return (
 *     <SidebarLayout
 *       {...props}
 *       side="right"
 *       sidebarWidth="w-72"
 *       stickyHeader={false}
 *     />
 *   )
 * }
 *
 * export default { Layout: CustomLayout }
 */

/**
 * Hamburger menu icon
 */
function MenuIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}

/**
 * Close (X) icon
 */
function CloseIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

/**
 * Mobile drawer component
 */
function MobileDrawer({ isOpen, onClose, side, width, stickyHeader, children }) {
  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = ''
      }
    }
  }, [isOpen])

  const isLeft = side === 'left'

  // Position below header if sticky, otherwise from top
  const topOffset = stickyHeader ? 'top-16' : 'top-0'
  const height = stickyHeader ? 'h-[calc(100vh-4rem)]' : 'h-screen'

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 bg-black/50 z-40 transition-opacity duration-300',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className={cn(
          'fixed bg-white z-50 shadow-xl',
          topOffset,
          height,
          width,
          isLeft ? 'left-0' : 'right-0',
          'transform transition-transform duration-300 ease-in-out',
          isOpen
            ? 'translate-x-0'
            : isLeft
              ? '-translate-x-full'
              : 'translate-x-full'
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Sidebar navigation"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className={cn(
            'absolute top-4 p-1.5 rounded-md hover:bg-gray-100 transition-colors',
            isLeft ? 'right-4' : 'left-4'
          )}
          aria-label="Close sidebar"
        >
          <CloseIcon className="w-5 h-5 text-gray-500" />
        </button>

        {/* Drawer content */}
        <div className="h-full overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
    </>
  )
}

/**
 * Floating action button for mobile menu
 */
function FloatingMenuButton({ onClick, side }) {
  const isLeft = side === 'left'

  return (
    <button
      onClick={onClick}
      className={cn(
        'fixed bottom-4 z-30',
        'p-3 bg-primary text-white rounded-full shadow-lg',
        'hover:bg-primary/90 active:scale-95 transition-all',
        'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
        isLeft ? 'left-4' : 'right-4'
      )}
      aria-label="Open navigation menu"
    >
      <MenuIcon className="w-6 h-6" />
    </button>
  )
}

/**
 * SidebarLayout main component
 *
 * @param {Object} props
 * @param {React.ReactNode} props.header - Header content (from @header sections)
 * @param {React.ReactNode} props.body - Main body content (page sections)
 * @param {React.ReactNode} props.footer - Footer content (from @footer sections)
 * @param {React.ReactNode} props.left - Left panel content (from @left sections)
 * @param {React.ReactNode} props.right - Right panel content (from @right sections)
 * @param {React.ReactNode} props.leftPanel - Alias for left (backwards compatibility)
 * @param {React.ReactNode} props.rightPanel - Alias for right (backwards compatibility)
 * @param {'left'|'right'} [props.side='left'] - Which side the sidebar appears on
 * @param {string} [props.sidebarWidth='w-64'] - Tailwind width class for sidebar
 * @param {string} [props.drawerWidth='w-72'] - Tailwind width class for mobile drawer
 * @param {string} [props.breakpoint='md'] - Breakpoint for showing sidebar inline
 * @param {boolean} [props.stickyHeader=true] - Whether header sticks to top
 * @param {boolean} [props.stickySidebar=true] - Whether sidebar sticks below header
 * @param {string} [props.maxWidth='max-w-7xl'] - Max width of content area
 * @param {string} [props.contentPadding='px-4 py-8 sm:px-6 lg:px-8'] - Padding for main content
 * @param {string} [props.className] - Additional classes for the root element
 */
export function SidebarLayout({
  // Pre-rendered layout areas from runtime
  header,
  body,
  footer,
  left,
  right,
  leftPanel,
  rightPanel,
  // Configuration
  side = 'left',
  sidebarWidth = 'w-64',
  drawerWidth = 'w-72',
  breakpoint = 'md',
  stickyHeader = true,
  stickySidebar = true,
  maxWidth = 'max-w-7xl',
  contentPadding = 'px-4 py-8 sm:px-6 lg:px-8',
  className,
}) {
  const { isOpen, open, close } = useMobileMenu()

  // Determine sidebar content based on configured side
  const sidebarContent = side === 'left'
    ? (left || leftPanel)
    : (right || rightPanel)

  // Breakpoint classes for showing/hiding sidebar
  const showSidebarClass = {
    sm: 'sm:block',
    md: 'md:block',
    lg: 'lg:block',
    xl: 'xl:block',
  }[breakpoint] || 'md:block'

  const hideFabClass = {
    sm: 'sm:hidden',
    md: 'md:hidden',
    lg: 'lg:hidden',
    xl: 'xl:hidden',
  }[breakpoint] || 'md:hidden'

  const hideDrawerClass = hideFabClass

  // Sticky positioning
  const headerClasses = stickyHeader
    ? 'sticky top-0 z-30'
    : ''

  const sidebarClasses = stickySidebar && stickyHeader
    ? 'sticky top-16 h-[calc(100vh-4rem)]'
    : stickySidebar
      ? 'sticky top-0 h-screen'
      : ''

  return (
    <div className={cn('min-h-screen flex flex-col bg-white', className)}>
      {/* Header */}
      {header && (
        <header className={cn(
          'w-full border-b border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80',
          headerClasses
        )}>
          {header}
        </header>
      )}

      {/* Mobile Drawer */}
      {sidebarContent && (
        <div className={hideDrawerClass}>
          <MobileDrawer
            isOpen={isOpen}
            onClose={close}
            side={side}
            width={drawerWidth}
            stickyHeader={stickyHeader}
          >
            {sidebarContent}
          </MobileDrawer>
        </div>
      )}

      {/* Main Content Area */}
      <div className={cn('flex-1 w-full mx-auto', maxWidth)}>
        <div className="flex">
          {/* Left Sidebar (desktop) */}
          {side === 'left' && sidebarContent && (
            <aside className={cn(
              'hidden flex-shrink-0 overflow-y-auto border-r border-gray-200',
              showSidebarClass,
              sidebarWidth,
              sidebarClasses
            )}>
              {sidebarContent}
            </aside>
          )}

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            <div className={contentPadding}>
              {body}
            </div>
          </main>

          {/* Right Sidebar (desktop) */}
          {side === 'right' && sidebarContent && (
            <aside className={cn(
              'hidden flex-shrink-0 overflow-y-auto border-l border-gray-200',
              showSidebarClass,
              sidebarWidth,
              sidebarClasses
            )}>
              {sidebarContent}
            </aside>
          )}
        </div>
      </div>

      {/* Footer */}
      {footer && (
        <footer className="w-full border-t border-gray-200">
          {footer}
        </footer>
      )}

      {/* Mobile FAB */}
      {sidebarContent && (
        <div className={hideFabClass}>
          <FloatingMenuButton onClick={open} side={side} />
        </div>
      )}
    </div>
  )
}

export default SidebarLayout

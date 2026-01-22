/**
 * Disclaimer Component
 *
 * Modal disclaimer dialog for terms, privacy notices, etc.
 *
 * @module @uniweb/kit/Disclaimer
 */

import React, { useState, useCallback, useEffect } from 'react'
import { cn } from '../../utils/index.js'
import { useWebsite } from '../../hooks/useWebsite.js'
import { SafeHtml } from '../../components/SafeHtml/index.js'

/**
 * Disclaimer Modal
 */
function DisclaimerModal({ isOpen, onClose, title, content, className }) {
  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose()
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className={cn(
            'relative w-full max-w-lg transform overflow-hidden rounded-lg',
            'bg-white shadow-xl transition-all',
            className
          )}
          role="dialog"
          aria-modal="true"
          aria-labelledby="disclaimer-title"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <h3 id="disclaimer-title" className="text-lg font-medium text-gray-900">
              {title}
            </h3>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="px-4 py-4 max-h-96 overflow-y-auto">
            {typeof content === 'string' ? (
              <SafeHtml value={content} className="prose prose-sm" />
            ) : (
              content
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 px-4 py-3 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Disclaimer - Disclaimer trigger and modal
 *
 * @param {Object} props
 * @param {string} [props.type='link'] - Trigger type: 'link', 'button', 'popup'
 * @param {string} props.title - Disclaimer title
 * @param {string|React.ReactNode} props.content - Disclaimer content
 * @param {string} [props.triggerText] - Text for the trigger element
 * @param {string} [props.className] - Additional CSS classes
 * @param {React.ReactNode} [props.children] - Custom trigger element
 *
 * @example
 * <Disclaimer
 *   title="Terms of Service"
 *   content="<p>Please read our terms...</p>"
 *   triggerText="View Terms"
 * />
 *
 * @example
 * <Disclaimer title="Privacy Policy" content={<PrivacyContent />}>
 *   <button className="underline">Privacy Policy</button>
 * </Disclaimer>
 */
export function Disclaimer({
  type = 'link',
  title,
  content,
  triggerText,
  className,
  children,
  ...props
}) {
  const [isOpen, setIsOpen] = useState(false)
  const { localize } = useWebsite()

  const handleOpen = useCallback(() => setIsOpen(true), [])
  const handleClose = useCallback(() => setIsOpen(false), [])

  // Auto-open for popup type
  useEffect(() => {
    if (type === 'popup') {
      setIsOpen(true)
    }
  }, [type])

  // Localized title and content
  const localizedTitle = typeof title === 'object' ? localize(title) : title
  const localizedContent = typeof content === 'object' && !React.isValidElement(content)
    ? localize(content)
    : content
  const localizedTriggerText = typeof triggerText === 'object'
    ? localize(triggerText)
    : (triggerText || localizedTitle)

  // Render trigger
  const trigger = children ? (
    React.cloneElement(React.Children.only(children), {
      onClick: handleOpen,
      role: 'button',
      'aria-haspopup': 'dialog'
    })
  ) : type === 'button' ? (
    <button
      onClick={handleOpen}
      className={cn(
        'inline-flex items-center px-3 py-1.5 text-sm font-medium',
        'text-blue-600 hover:text-blue-700',
        'border border-blue-600 rounded-md hover:bg-blue-50',
        className
      )}
      {...props}
    >
      {localizedTriggerText}
    </button>
  ) : (
    <button
      onClick={handleOpen}
      className={cn(
        'text-blue-600 hover:text-blue-700 underline text-sm',
        className
      )}
      {...props}
    >
      {localizedTriggerText}
    </button>
  )

  return (
    <>
      {type !== 'popup' && trigger}
      <DisclaimerModal
        isOpen={isOpen}
        onClose={handleClose}
        title={localizedTitle}
        content={localizedContent}
      />
    </>
  )
}

export default Disclaimer

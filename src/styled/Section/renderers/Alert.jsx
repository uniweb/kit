/**
 * Alert/Warning Renderer
 *
 * Renders alert boxes for warnings, info, success, and error messages.
 *
 * @module @uniweb/kit/Section/renderers/Alert
 */

import React from 'react'
import { cn } from '../../../utils/index.js'
import { SafeHtml } from '../../../components/SafeHtml/index.js'

/**
 * Alert type configurations
 */
const ALERT_STYLES = {
  info: {
    container: 'bg-blue-50 border-blue-200 text-blue-800',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    ),
    iconColor: 'text-blue-500'
  },
  success: {
    container: 'bg-green-50 border-green-200 text-green-800',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    ),
    iconColor: 'text-green-500'
  },
  warning: {
    container: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    ),
    iconColor: 'text-yellow-500'
  },
  danger: {
    container: 'bg-red-50 border-red-200 text-red-800',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    ),
    iconColor: 'text-red-500'
  },
  error: {
    container: 'bg-red-50 border-red-200 text-red-800',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    ),
    iconColor: 'text-red-500'
  }
}

/**
 * Alert - Alert/warning box
 *
 * @param {Object} props
 * @param {string} [props.type='info'] - Alert type: info, success, warning, danger, error
 * @param {string|React.ReactNode} props.content - Alert content
 * @param {string} [props.title] - Optional title
 * @param {string} [props.className] - Additional CSS classes
 */
export function Alert({ type = 'info', content, title, className, ...props }) {
  const styles = ALERT_STYLES[type] || ALERT_STYLES.info

  return (
    <div
      className={cn(
        'flex gap-3 rounded-lg border p-4',
        styles.container,
        className
      )}
      role="alert"
      {...props}
    >
      {/* Icon */}
      <div className={cn('flex-shrink-0', styles.iconColor)}>
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          {styles.icon}
        </svg>
      </div>

      {/* Content */}
      <div className="flex-1">
        {title && (
          <h4 className="font-medium mb-1">{title}</h4>
        )}
        {typeof content === 'string' ? (
          <SafeHtml value={content} className="text-sm" />
        ) : (
          <div className="text-sm">{content}</div>
        )}
      </div>
    </div>
  )
}

// Alias for backwards compatibility
export const Warning = Alert

export default Alert

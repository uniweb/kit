/**
 * useInView Hook
 *
 * Detects when an element enters or leaves the viewport using IntersectionObserver.
 * Useful for lazy loading, animations on scroll, and infinite scroll.
 *
 * @example
 * // Basic usage - trigger animation when element enters viewport
 * function AnimatedSection() {
 *   const { ref, inView } = useInView()
 *   return (
 *     <div ref={ref} className={inView ? 'animate-fade-in' : 'opacity-0'}>
 *       Content appears when scrolled into view
 *     </div>
 *   )
 * }
 *
 * @example
 * // Lazy load image when near viewport
 * function LazyImage({ src, alt }) {
 *   const { ref, inView } = useInView({
 *     triggerOnce: true,
 *     rootMargin: '200px',  // Load 200px before entering viewport
 *   })
 *   return (
 *     <div ref={ref}>
 *       {inView ? <img src={src} alt={alt} /> : <div className="placeholder" />}
 *     </div>
 *   )
 * }
 *
 * @example
 * // Threshold for partial visibility
 * const { ref, inView } = useInView({
 *   threshold: 0.5,  // Trigger when 50% visible
 * })
 */

import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * Default options for IntersectionObserver
 */
const DEFAULT_OPTIONS = {
  threshold: 0,
  rootMargin: '0px',
  triggerOnce: false,
  root: null,
}

/**
 * Hook to detect when an element enters/leaves the viewport.
 *
 * @param {Object} options - Configuration options
 * @param {number|number[]} options.threshold - Visibility ratio(s) to trigger (0-1). Default: 0
 * @param {string} options.rootMargin - Margin around root. Default: '0px'
 * @param {boolean} options.triggerOnce - Only trigger once, then stop observing. Default: false
 * @param {Element|null} options.root - Scroll container (null = viewport). Default: null
 * @param {boolean} options.initialInView - Initial inView state for SSR. Default: false
 *
 * @returns {Object} { ref, inView, entry }
 * @returns {Function} ref - Callback ref to attach to the target element
 * @returns {boolean} inView - Whether element is currently in viewport
 * @returns {IntersectionObserverEntry|null} entry - Latest IntersectionObserver entry
 */
export function useInView(options = {}) {
  const {
    threshold = DEFAULT_OPTIONS.threshold,
    rootMargin = DEFAULT_OPTIONS.rootMargin,
    triggerOnce = DEFAULT_OPTIONS.triggerOnce,
    root = DEFAULT_OPTIONS.root,
    initialInView = false,
  } = options

  const [inView, setInView] = useState(initialInView)
  const [entry, setEntry] = useState(null)

  // Track if we've already triggered (for triggerOnce)
  const hasTriggered = useRef(false)

  // Store the observer instance
  const observerRef = useRef(null)

  // Store the current element
  const elementRef = useRef(null)

  /**
   * Callback ref that handles element changes
   */
  const ref = useCallback(
    (node) => {
      // Clean up previous observer
      if (observerRef.current) {
        observerRef.current.disconnect()
        observerRef.current = null
      }

      // Store the new element
      elementRef.current = node

      // Don't observe if:
      // - No element
      // - SSR (no IntersectionObserver)
      // - Already triggered and triggerOnce is true
      if (!node) return
      if (typeof IntersectionObserver === 'undefined') return
      if (triggerOnce && hasTriggered.current) return

      // Create new observer
      const observer = new IntersectionObserver(
        ([observerEntry]) => {
          const isIntersecting = observerEntry.isIntersecting

          setInView(isIntersecting)
          setEntry(observerEntry)

          // Handle triggerOnce
          if (isIntersecting && triggerOnce) {
            hasTriggered.current = true
            observer.disconnect()
            observerRef.current = null
          }
        },
        {
          threshold,
          rootMargin,
          root,
        }
      )

      observer.observe(node)
      observerRef.current = observer
    },
    [threshold, rootMargin, root, triggerOnce]
  )

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [])

  return { ref, inView, entry }
}

/**
 * Simpler hook that just returns inView state for a ref'd element.
 * Use when you don't need the entry details.
 *
 * @example
 * const ref = useRef()
 * const inView = useIsInView(ref, { triggerOnce: true })
 *
 * @param {React.RefObject} targetRef - Ref to the target element
 * @param {Object} options - Same options as useInView
 * @returns {boolean} Whether element is in viewport
 */
export function useIsInView(targetRef, options = {}) {
  const {
    threshold = DEFAULT_OPTIONS.threshold,
    rootMargin = DEFAULT_OPTIONS.rootMargin,
    triggerOnce = DEFAULT_OPTIONS.triggerOnce,
    root = DEFAULT_OPTIONS.root,
    initialInView = false,
  } = options

  const [inView, setInView] = useState(initialInView)
  const hasTriggered = useRef(false)

  useEffect(() => {
    const element = targetRef.current
    if (!element) return
    if (typeof IntersectionObserver === 'undefined') return
    if (triggerOnce && hasTriggered.current) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isIntersecting = entry.isIntersecting
        setInView(isIntersecting)

        if (isIntersecting && triggerOnce) {
          hasTriggered.current = true
          observer.disconnect()
        }
      },
      { threshold, rootMargin, root }
    )

    observer.observe(element)

    return () => observer.disconnect()
  }, [targetRef, threshold, rootMargin, root, triggerOnce])

  return inView
}

export default useInView

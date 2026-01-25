/**
 * React Hooks for Search
 *
 * Provides hooks for easily integrating search into React components.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createSearchClient, loadSearchIndex } from './client.js'

/**
 * Hook to create and use a search client
 *
 * @param {Object} website - Website instance from @uniweb/core
 * @param {Object} options - Options passed to createSearchClient
 * @returns {Object} Search state and methods
 *
 * @example
 * function SearchComponent() {
 *   const { query, results, isLoading, error } = useSearch(website)
 *
 *   return (
 *     <div>
 *       <input onChange={e => query(e.target.value)} />
 *       {isLoading && <span>Searching...</span>}
 *       {results.map(r => <SearchResult key={r.id} result={r} />)}
 *     </div>
 *   )
 * }
 */
export function useSearch(website, options = {}) {
  const { debounceMs = 150, ...clientOptions } = options

  const [results, setResults] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lastQuery, setLastQuery] = useState('')

  // Create search client (memoized)
  const client = useMemo(() => {
    if (!website) return null
    return createSearchClient(website, clientOptions)
  }, [website]) // eslint-disable-line react-hooks/exhaustive-deps

  // Track pending search for debounce/cancellation
  const pendingRef = useRef(null)
  const timeoutRef = useRef(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  /**
   * Execute a search query
   */
  const query = useCallback(async (searchQuery, queryOptions = {}) => {
    const trimmed = searchQuery?.trim() || ''
    setLastQuery(trimmed)

    // Clear pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    // Empty query - clear results immediately
    if (!trimmed) {
      setResults([])
      setIsLoading(false)
      setError(null)
      return []
    }

    // Check if search is enabled
    if (!client?.isEnabled()) {
      setError(new Error('Search is not enabled'))
      return []
    }

    // Mark this search as pending
    const searchId = Symbol('search')
    pendingRef.current = searchId

    // Debounce the actual search
    return new Promise((resolve) => {
      timeoutRef.current = setTimeout(async () => {
        // Skip if a newer search was started
        if (pendingRef.current !== searchId) {
          resolve([])
          return
        }

        setIsLoading(true)
        setError(null)

        try {
          const searchResults = await client.query(trimmed, queryOptions)

          // Skip if a newer search was started
          if (pendingRef.current !== searchId) {
            resolve([])
            return
          }

          setResults(searchResults)
          setIsLoading(false)
          resolve(searchResults)
        } catch (err) {
          // Skip if a newer search was started
          if (pendingRef.current !== searchId) {
            resolve([])
            return
          }

          setError(err)
          setResults([])
          setIsLoading(false)
          resolve([])
        }
      }, debounceMs)
    })
  }, [client, debounceMs])

  /**
   * Clear search results
   */
  const clear = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    pendingRef.current = null
    setResults([])
    setLastQuery('')
    setError(null)
    setIsLoading(false)
  }, [])

  /**
   * Preload the search index
   */
  const preload = useCallback(async () => {
    if (!client) return
    try {
      await client.preload()
    } catch (err) {
      console.warn('Failed to preload search index:', err)
    }
  }, [client])

  return {
    // State
    results,
    isLoading,
    error,
    lastQuery,
    isEnabled: client?.isEnabled() ?? false,

    // Actions
    query,
    clear,
    preload,

    // Client access (for advanced use)
    client
  }
}

/**
 * Hook to load and access the raw search index
 *
 * Useful for custom search implementations or displaying index stats.
 *
 * @param {Object} website - Website instance
 * @param {Object} options - Options
 * @param {boolean} [options.autoLoad=true] - Automatically load on mount
 * @returns {Object} Index state and methods
 *
 * @example
 * function SearchStats() {
 *   const { index, isLoading } = useSearchIndex(website)
 *
 *   if (isLoading) return <span>Loading...</span>
 *   return <span>{index?.count || 0} searchable items</span>
 * }
 */
export function useSearchIndex(website, options = {}) {
  const { autoLoad = true } = options

  const [index, setIndex] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!website?.isSearchEnabled()) {
      setError(new Error('Search is not enabled'))
      return null
    }

    setIsLoading(true)
    setError(null)

    try {
      const indexUrl = website.getSearchIndexUrl()
      const data = await loadSearchIndex(indexUrl)
      setIndex(data)
      setIsLoading(false)
      return data
    } catch (err) {
      setError(err)
      setIsLoading(false)
      return null
    }
  }, [website])

  // Auto-load on mount if enabled
  useEffect(() => {
    if (autoLoad && website?.isSearchEnabled()) {
      load()
    }
  }, [autoLoad, website, load])

  return {
    index,
    isLoading,
    error,
    isEnabled: website?.isSearchEnabled() ?? false,
    load,
    entries: index?.entries || [],
    count: index?.count || 0,
    locale: index?.locale || null
  }
}

/**
 * Hook for Cmd/Ctrl+K keyboard shortcut to open search
 *
 * @param {Function|Object} callbacks - Either onOpen function, or { onOpen, onPreload }
 *
 * @example
 * // Simple usage
 * useSearchShortcut(() => setSearchOpen(true))
 *
 * // With preload
 * useSearchShortcut({
 *   onOpen: () => setSearchOpen(true),
 *   onPreload: () => search.preload()
 * })
 */
export function useSearchShortcut(callbacks) {
  const { onOpen, onPreload } = typeof callbacks === 'function'
    ? { onOpen: callbacks, onPreload: null }
    : callbacks

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        onPreload?.()
        onOpen()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onOpen, onPreload])
}

/**
 * Hook that wraps useSearch with intent-based preloading
 *
 * Provides handlers to trigger preload on user intent (hover, focus, touch)
 * rather than on component mount. This saves bandwidth for users who never search.
 *
 * @param {Object} website - Website instance from @uniweb/core
 * @param {Object} options - Options passed to useSearch
 * @returns {Object} Search state, methods, and intent handlers
 *
 * @example
 * function SearchButton({ onClick }) {
 *   const { intentProps, triggerPreload } = useSearchWithIntent(website)
 *
 *   useSearchShortcut({
 *     onOpen: onClick,
 *     onPreload: triggerPreload,
 *   })
 *
 *   return (
 *     <button onClick={onClick} {...intentProps}>
 *       Search
 *     </button>
 *   )
 * }
 */
export function useSearchWithIntent(website, options = {}) {
  const search = useSearch(website, options)
  const hasPreloaded = useRef(false)

  const triggerPreload = useCallback(() => {
    if (hasPreloaded.current) return
    hasPreloaded.current = true
    search.preload()
  }, [search])

  // Intent handlers - spread onto interactive elements
  const intentProps = useMemo(() => ({
    onMouseEnter: triggerPreload,
    onFocus: triggerPreload,
    onTouchStart: triggerPreload,
  }), [triggerPreload])

  return {
    ...search,
    triggerPreload,
    intentProps,
  }
}

export default useSearch

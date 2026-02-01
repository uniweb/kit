/**
 * useDataLoading Hook
 *
 * Provides data loading state from a block's runtime fetch.
 * Components use this to show loading UI while data is being fetched.
 *
 * @example
 * function ArticleList({ content, block }) {
 *   const { loading } = useDataLoading(block)
 *   if (loading) return <DataPlaceholder />
 *   return <ArticleGrid articles={content.data.articles} />
 * }
 *
 * @param {Block} block - The block instance
 * @returns {{ loading: boolean }} Loading state
 */
import { useState, useEffect } from 'react'

export function useDataLoading(block) {
  // Re-render when dataLoading changes (block.dataLoading is set by BlockRenderer)
  const [loading, setLoading] = useState(block?.dataLoading ?? false)

  useEffect(() => {
    setLoading(block?.dataLoading ?? false)
  }, [block?.dataLoading])

  return { loading }
}

export default useDataLoading

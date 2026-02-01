/**
 * DataPlaceholder
 *
 * Default loading UI for components waiting on runtime data.
 * Renders an animated pulse placeholder.
 *
 * @example
 * import { DataPlaceholder, useDataLoading } from '@uniweb/kit'
 *
 * function ArticleList({ content, block }) {
 *   const { loading } = useDataLoading(block)
 *   if (loading) return <DataPlaceholder />
 *   return <ArticleGrid articles={content.data.articles} />
 * }
 */
export function DataPlaceholder({ lines = 3, className = '' }) {
  return (
    <div className={`animate-pulse space-y-4 py-8 ${className}`} role="status" aria-label="Loading">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="h-4 rounded" style={{
          backgroundColor: 'var(--border, #e5e7eb)',
          width: i === lines - 1 ? '60%' : '100%',
        }} />
      ))}
    </div>
  )
}

export default DataPlaceholder

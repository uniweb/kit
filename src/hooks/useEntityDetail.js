/**
 * useEntityDetail — fetch the full record for a deferred-field collection.
 *
 * When a collection declares `deferred: [...]` in `site.yml`, the cascade
 * payload omits the deferred fields. The full record (with deferred
 * fields included) lives in a per-record file at
 * `/data/<collection>/<slug>.json`. On dynamic-route pages, the framework
 * routes the singular detail there automatically. Anywhere else (a card
 * grid that wants to show a hover-card preview, a modal that opens an
 * article body) — use this hook.
 *
 * Returns `{ data, error, loading }` like `useFetched`. Shares the same
 * cache. Pass null/undefined to skip without subscribing.
 *
 * @example
 * function ArticleCard({ article }) {
 *   const [open, setOpen] = useState(false)
 *   const { data: full, loading } = useEntityDetail(open ? article : null, {
 *     collection: 'articles',
 *   })
 *   return (
 *     <div>
 *       <h3>{article.title}</h3>
 *       <p>{article.excerpt}</p>
 *       <button onClick={() => setOpen(true)}>Read more</button>
 *       {open && (loading ? <Spinner /> : <ArticleBody html={full.body} />)}
 *     </div>
 *   )
 * }
 */

import { useFetched } from './useFetched.js'

/**
 * @param {Object|null} record - A record from a cascade-delivered collection.
 *   Must have a `slug` field. Pass null/undefined to skip the fetch.
 * @param {Object} [options]
 * @param {string} options.collection - The collection name (e.g., 'articles').
 *   Required when record is non-null. Used to build the per-record file URL
 *   `/data/<collection>/<slug>.json`.
 * @returns {{ data: any, error: string|null, loading: boolean }}
 */
export function useEntityDetail(record, options = {}) {
  const collection = options?.collection
  const request = (record && record.slug && collection)
    ? { path: `/data/${collection}/${record.slug}.json`, schema: collection }
    : null
  return useFetched(request)
}

export default useEntityDetail

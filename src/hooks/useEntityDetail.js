/**
 * useEntityDetail — fetch the full record for a deferred-field collection.
 *
 * When a collection declares `deferred: [...]` in `site.yml`, the cascade
 * payload omits the deferred fields. The full record (with deferred
 * fields included) lives somewhere — either at a per-record file the
 * build emits, or at an author-declared API endpoint. This hook fetches
 * that full record on demand.
 *
 * Two source patterns, picked automatically from the collection's
 * declaration:
 *
 *   - Markdown-backed collections (declared with `path:` in site.yml).
 *     The build emits `/data/<collection>/<slug>.json` per record. The
 *     hook fetches that path.
 *
 *   - API-backed collections (declared with `url:` in site.yml plus a
 *     `detailUrl:` pattern). The hook substitutes `{slug}` in the
 *     pattern and fetches that URL.
 *
 * On dynamic-route pages the framework routes the singular detail to
 * the same source automatically (entity-store auto-injection). This
 * hook is for the elsewhere case — a hover-card preview, a modal that
 * opens an article body, a related-items strip that wants summaries
 * everywhere except the one being highlighted.
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

import { getUniweb } from '@uniweb/core'
import { useFetched } from './useFetched.js'

/**
 * @param {Object|null} record - A record from a cascade-delivered collection.
 *   Must have a `slug` field. Pass null/undefined to skip the fetch.
 * @param {Object} [options]
 * @param {string} options.collection - The collection name (e.g., 'articles').
 *   Required when record is non-null. Used to look up the collection's
 *   `detailUrl:` (if declared) or fall back to the static-file default
 *   `/data/<collection>/<slug>.json`.
 * @returns {{ data: any, error: string|null, loading: boolean }}
 */
export function useEntityDetail(record, options = {}) {
  const collection = options?.collection
  const request = buildDetailRequest(record, collection)
  return useFetched(request)
}

function buildDetailRequest(record, collection) {
  const slug = record?.slug
  if (!slug || !collection) return null

  // Look up the collection's per-record source pattern. Authors with
  // API-backed collections declare `detailUrl:` in site.yml; markdown
  // collections leave it null and use the static-file default.
  const website = getUniweb()?.activeWebsite
  const collConfig = website?.config?.collections?.[collection]
  const detailUrl = (collConfig && typeof collConfig.detailUrl === 'string')
    ? collConfig.detailUrl
    : null

  if (detailUrl) {
    // Substitute {slug} into the author-declared pattern and use url:
    // (the source is remote).
    const url = detailUrl.replace(/\{slug\}/g, encodeURIComponent(slug))
    return { url, schema: collection }
  }

  // Static-file default — the build emitted per-record JSON files.
  // Phase 5 of the CDN migration moved storage from /data/ to /_data/;
  // the site router accepts both URL shapes during the transition.
  return { path: `/_data/${collection}/${slug}.json`, schema: collection }
}

export default useEntityDetail

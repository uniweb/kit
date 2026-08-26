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

import { getUniweb, resolveFetchConfigs, buildDetailConfig } from '@uniweb/core'
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
  const result = useFetched(request)

  // No separate detail source for this collection — nothing was stripped from
  // the cascade, so the record the caller already holds IS the whole record.
  // Returning it beats both alternatives: `null` makes every caller null-check
  // a case that cannot fail, and requesting the per-record file anyway is a
  // guaranteed 404, because that file is only written for a `deferred:`
  // collection. `useFetched` is still called above — unconditionally, as the
  // rules of hooks require — and simply skips on a null request.
  if (record && collection && !request) {
    return { data: record, error: null, loading: false }
  }
  return result
}

/**
 * Build the fetch request for one record's full payload.
 *
 * ⛔ THIS MUST NOT DECIDE THE ADDRESS ITSELF, and it used to. It read
 * `config.collections[name].detailUrl` directly and otherwise composed
 * `/data/<name>/<slug>.json` by hand, which was wrong three ways: it 404'd on
 * any collection without `deferred:` (that file is only written for one), it
 * could not see a host's live record lane at all, and its hand-rolled `{slug}`
 * replace ignored a route whose param is named anything else.
 *
 * Every one of those is already solved once, in the resolution the runtime and
 * the prerenderer share. So this hands the collection to that resolution and
 * asks it the same question they ask: `resolveFetchConfigs` decides where the
 * collection lives (a host's lane, or the compiled artifact) and what its
 * per-record source is, then `buildDetailConfig` turns that plus a param into a
 * request. A fourth answer computed here is a fourth thing to drift.
 *
 * Returns null when the collection has no separate detail source — the common
 * case, and not a failure. The caller's record is already whole.
 *
 * Exported for tests only — not re-exported from the package index.
 *
 * @param {Object|null} record
 * @param {string} collection
 * @returns {{path?: string, url?: string, endpoint?: string, schema: string}|null}
 */
export function buildDetailRequest(record, collection) {
  const slug = record?.slug
  if (!slug || !collection) return null

  const website = getUniweb()?.activeWebsite
  const config = website?.config

  // One synthetic source, resolved by the shared rule — same inputs the
  // EntityStore passes, so the hook cannot disagree with the page it sits on.
  const resolved = resolveFetchConfigs([{ collection, schema: collection }], {
    collections: config?.collections ?? null,
    records: config?.records ?? null,
    locale: website?.getActiveLocale?.() ?? null,
    defaultLocale: website?.getDefaultLocale?.() ?? null,
  }).get(collection)

  if (!resolved) return null

  // `slug` is this hook's contract with its caller (the record must carry one).
  // The `{param}` alias means a host-written record pattern resolves too.
  return buildDetailConfig(resolved, { paramName: 'slug', paramValue: slug })
}

export default useEntityDetail

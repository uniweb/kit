/**
 * useEntityDetail — fetch the full record for a query with deferred fields.
 *
 * When a query declares `deferred: [...]`, the cascade
 * payload omits the deferred fields. The full record (with deferred
 * fields included) lives somewhere — either at a per-record file the
 * build emits, or at an author-declared API endpoint. This hook fetches
 * that full record on demand.
 *
 * Two source patterns, picked automatically from the query's
 * declaration:
 *
 *   - File-backed records (a query over `entities/{schema}/`).
 *     The build emits `/data/<query>/<slug>.json` per record. The
 *     hook fetches that path.
 *
 *   - Remote sources (a query declaring `url:` plus a
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
 *     query: 'articles',
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
 * @param {Object|null} record - A record from a cascade-delivered query.
 *   Must carry the field the site routes this query's records by — `slug`
 *   unless the site's `[param]` folder or `options.param` says otherwise.
 *   Pass null/undefined to skip the fetch.
 * @param {Object} [options]
 * @param {string} options.query - The query name (e.g., 'articles').
 *   Required when record is non-null. Used to look up the query's
 *   `detailUrl:` (if declared) or fall back to the static-file default
 *   `/data/<collection>/<slug>.json`.
 * @param {string} [options.param] - The record field a detail address is
 *   built on. Defaults to the param of the site's own `[param]` template for
 *   this query (`website.detailTemplateFor`), else `slug`.
 * @returns {{ data: any, error: string|null, loading: boolean }}
 */
export function useEntityDetail(record, options = {}) {
  const query = options?.query
  const request = buildDetailRequest(record, query, { param: options?.param })
  const result = useFetched(request)

  // No separate detail source for this collection — nothing was stripped from
  // the cascade, so the record the caller already holds IS the whole record.
  // Returning it beats both alternatives: `null` makes every caller null-check
  // a case that cannot fail, and requesting the per-record file anyway is a
  // guaranteed 404, because that file is only written for a `deferred:`
  // collection. `useFetched` is still called above — unconditionally, as the
  // rules of hooks require — and simply skips on a null request.
  if (record && query && !request) {
    return { data: record, error: null, loading: false }
  }
  return result
}

/**
 * Build the fetch request for one record's full payload.
 *
 * ⛔ THIS MUST NOT DECIDE THE ADDRESS ITSELF, and it used to. It read
 * `config.queries[name].detailUrl` directly and otherwise composed
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
 * @param {string} query
 * @returns {{path?: string, url?: string, endpoint?: string, as: string}|null}
 */
export function buildDetailRequest(record, query, { param = null } = {}) {
  if (!record || typeof record !== 'object' || !query) return null

  const website = getUniweb()?.activeWebsite
  const config = website?.config

  // ⛔ THE PARAM IS THE SITE'S, NOT THIS HOOK'S. It hardcoded `slug` until
  // 2026-09-04, so on a site routing `[id]` a hover card addressed a record by a
  // field the page it links to never uses (open-work U5). The order: the
  // caller's explicit `param`, else the param of the site's own template page
  // for this query — the same field `entity-store` matches on — else `slug`,
  // which is the file lane's per-record key and the documented default.
  const paramName = param || website?.detailTemplateFor?.(query)?.paramName || 'slug'
  const paramValue = record[paramName]
  if (paramValue === undefined || paramValue === null || paramValue === '') return null

  // One synthetic source, resolved by the shared rule — same inputs the
  // EntityStore passes, so the hook cannot disagree with the page it sits on.
  const resolved = resolveFetchConfigs([{ query, as: query }], {
    queries: config?.queries ?? null,
    records: config?.records ?? null,
    locale: website?.getActiveLocale?.() ?? null,
    defaultLocale: website?.getDefaultLocale?.() ?? null,
  }).get(query)

  if (!resolved) return null

  // The record is in hand, so `{slug}` in a per-record file pattern resolves to
  // ITS slug whatever the route's param is; `{param}` means a host-written
  // record pattern resolves too.
  return buildDetailConfig(resolved, { paramName, paramValue: String(paramValue), record })
}

export default useEntityDetail

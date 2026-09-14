/**
 * useWholeRecord — the whole of a record whose query delivers less of it.
 *
 * When a query's list carries less than a record — a `deferred: [...]` query, a
 * host's records service answering briefs, an external query that declares
 * `record:` — the whole record lives at its own address. This hook fetches that
 * record on demand, from the source the query's declaration picks:
 *
 *   - a query over `entities/{schema}/` with `deferred:` — the per-record file the
 *     build emits;
 *   - a host's records service — the query's question narrowed to the record,
 *     asked `whole`;
 *   - an external query — its `record:` request, `{slug}` substituted.
 *
 * It was `useEntityDetail` until 2026-09-14 [Diego]: a component holds a record a
 * query delivered, not a stored entity, and what the hook returns is that record
 * whole — as the records service's question asks for it, with `whole`.
 *
 * On a parametric page the page's own record is already asked from that same
 * source (entity-store auto-injection). This hook is for the elsewhere case —
 * a hover-card preview, a modal that opens an article body, a related-items
 * strip that wants summaries everywhere except the one being highlighted.
 *
 * Returns `{ data, error, loading }` like `useFetched`. Shares the same
 * cache. Pass null/undefined to skip without subscribing.
 *
 * @example
 * function ArticleCard({ article }) {
 *   const [open, setOpen] = useState(false)
 *   const { data: full, loading } = useWholeRecord(open ? article : null, {
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

import { getUniweb, resolveFetchConfigs, buildDetailConfig, routeParamValue } from '@uniweb/core'
import { useFetched } from './useFetched.js'

/**
 * @param {Object|null} record - A record from a cascade-delivered query.
 *   Must carry the field the site routes this query's records by — `slug`
 *   unless the site's `[param]` folder or `options.param` says otherwise.
 *   Pass null/undefined to skip the fetch.
 * @param {Object} [options]
 * @param {string} options.query - The query name (e.g., 'articles').
 *   Required when record is non-null. Used to look up where the query's
 *   records live and what its per-record source is.
 * @param {string} [options.param] - The record field a detail address is
 *   built on. Defaults to the param of the page that shows one record of this
 *   query (`website.recordPageFor`), else `slug`.
 * @returns {{ data: any, error: string|null, loading: boolean }}
 */
export function useWholeRecord(record, options = {}) {
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
 * `config.queries[name].detailUrl` (retired since) directly and otherwise composed
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
  // caller's explicit `param`, else the param of the page that shows one record of
  // this query — the page the record's `$route` links to, and the field
  // `entity-store` matches on — else `slug`, the file lane's per-record key and the
  // documented default.
  const paramName = param || website?.recordPageFor?.(query)?.paramName || 'slug'
  const paramValue = routeParamValue(record, paramName)
  if (paramValue === undefined || paramValue === null || paramValue === '') return null

  // One synthetic source, resolved by the shared rule — same inputs the
  // EntityStore passes, so the hook cannot disagree with the page it sits on.
  const resolved = resolveFetchConfigs([{ query, as: query }], {
    queries: config?.queries ?? null,
    services: config?.services ?? null,
    locale: website?.getActiveLocale?.() ?? null,
    defaultLocale: website?.getDefaultLocale?.() ?? null,
  }).get(query)

  if (!resolved) return null

  // The record is in hand, so `{slug}` in a per-record file pattern resolves to
  // ITS slug whatever the route's param is; `{param}` means a host-written
  // record pattern resolves too.
  return buildDetailConfig(resolved, { paramName, paramValue: String(paramValue), record })
}

export default useWholeRecord

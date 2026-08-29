/**
 * useCollectionQueryable — read the queryable-surface metadata for a
 * collection.
 *
 * ⚠️ THE HOOK KEEPS ITS NAME. `collection` stays an identifier in our own code —
 * renaming a published kit hook would break every foundation that calls it, for
 * no author-facing benefit. What an AUTHOR writes is what moved.
 *
 * Authors declare the queryable surface on a named QUERY, in `queries.yml`
 * (or under `queries:` in `site.yml`):
 *
 *   members:
 *     schema: '@std/person'
 *     queryable:
 *       department:
 *         type: enum
 *         label: Department
 *         options: [biology, physics, chemistry, geology]
 *       tenured:
 *         type: boolean
 *         label: Tenured
 *       start_year:
 *         type: range
 *         label: Start year
 *         min: 1800
 *         max: 2025
 *
 * Foundations consume this hook to render filter UIs and compose
 * where-objects from user interactions. The kit doesn't ship UI
 * components for the controls (different foundations have different
 * vocabularies); foundations build their own controls against the
 * metadata returned here.
 *
 * @example
 * function MemberFilters({ onChange }) {
 *   const queryable = useCollectionQueryable('members')
 *   const [values, setValues] = useState({})
 *   if (!queryable) return null
 *   return (
 *     <div>
 *       {Object.entries(queryable).map(([field, def]) => (
 *         <FilterControl
 *           key={field}
 *           field={field}
 *           def={def}
 *           value={values[field]}
 *           onChange={(v) => {
 *             const next = { ...values, [field]: v }
 *             setValues(next)
 *             onChange(composeWhereObject(next))
 *           }}
 *         />
 *       ))}
 *     </div>
 *   )
 * }
 *
 * Returns null when the collection has no `queryable:` declared.
 *
 * @param {string} collectionName - Name of the collection to read queryable
 *   metadata for. Pass null/undefined to skip (returns null).
 * @returns {Object|null} The queryable metadata object, or null.
 */

import { getUniweb } from '@uniweb/core'

export function useCollectionQueryable(queryName) {
  if (!queryName) return null
  const website = getUniweb()?.activeWebsite
  if (!website) return null
  const config = website.config?.queries?.[queryName]
  if (!config || typeof config !== 'object') return null
  const queryable = config.queryable
  if (!queryable || typeof queryable !== 'object') return null
  return queryable
}

export default useCollectionQueryable

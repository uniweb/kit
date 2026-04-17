/**
 * useBlockFetchMeta — expose `block.fetchMeta` to the section component.
 *
 * Fetchers can return `{ data, meta }`. The framework stores `meta` alongside
 * the cache entry and surfaces it to components through this hook. Typical
 * uses: fetch timestamps, pagination cursors, whether the response was served
 * from a backend cache, provenance info for debugging.
 *
 * Lazy by design — components that don't call this hook pay nothing. Returns
 * `null` when no meta was delivered for the block's active data.
 *
 * Under the current data-transport contract the dispatcher stamps
 * `block.fetchMeta` onto the block when the EntityStore assembles its data,
 * so reading `block.fetchMeta` directly inside a render is already safe. This
 * hook exists so future refactors (e.g., making `fetchMeta` reactive via an
 * observable) can change implementation without touching consuming components.
 *
 * @param {Object} block - The block instance passed into the section.
 * @returns {Object|null}
 */
export function useBlockFetchMeta(block) {
  return block?.fetchMeta ?? null
}

export default useBlockFetchMeta

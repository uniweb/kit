/**
 * useGoBack — for a button that means "back to …", such as a close ✕ on a detail view.
 *
 * The function it returns steps back when the visitor came from `to`, so the page comes back where
 * they left it, and goes to `to` otherwise, as a link would. For a link, `<Link to back>` does the
 * same, and stays a link (`utils/go-back.js`).
 *
 * @param {string} to - the page, as a `Link`'s `to`: a route or a `page:` reference
 * @returns {(event?: Event) => void}
 *
 * @example
 * function Detail({ block }) {
 *   const close = useGoBack('/store')
 *   return <button onClick={close} aria-label={block.properties.closeLabel}>✕</button>
 * }
 */

import { useWebsite } from './useWebsite.js'
import { useRouting } from './useRouting.js'
import { resolveRoute } from '../utils/href.js'
import { stepBackTo } from '../utils/go-back.js'

export function useGoBack(to) {
  const { website } = useWebsite()
  const navigate = useRouting().useNavigate()

  return (event) => {
    if (event?.defaultPrevented) return
    const route = resolveRoute(to, website)
    event?.preventDefault?.()
    if (!stepBackTo(route, website)) navigate(route)
  }
}

export default useGoBack

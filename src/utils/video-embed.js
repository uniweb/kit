/**
 * The address a YouTube or Vimeo video is embedded from — one place, for both `Media` components.
 *
 * `playlist` is how YouTube loops a single video: it names the video again. So it is sent only for
 * a video that loops. ⛔ Until 2026-11-06 each `Media` built the address itself, and both sent an
 * empty `playlist=` on every video that didn't loop. YouTube answers that with "This video is
 * unavailable", so no YouTube video played through kit unless it looped (reported by a site's
 * developer, with two frames side by side identical but for that parameter).
 *
 * YouTube is embedded from its privacy-enhanced host, which sets no cookie until the visitor
 * plays, as Vimeo is asked not to track (`dnt=1`): a site serving visitors anywhere should not
 * have to opt into either.
 *
 * @module @uniweb/kit/utils/video-embed
 */

const YOUTUBE_HOST = /(^|\.)(youtube\.com|youtube-nocookie\.com)$/

/**
 * A YouTube video's id, from any address that names one: `watch?v=`, `youtu.be/`, `embed/`,
 * `shorts/` or `live/`. Null for anything else.
 *
 * @param {string} url
 * @returns {string|null}
 */
export function youTubeId(url) {
  if (!url || typeof url !== 'string') return null
  let address
  try {
    address = new URL(url, 'https://www.youtube.com')
  } catch {
    return null
  }
  if (address.hostname === 'youtu.be') return address.pathname.split('/')[1] || null
  if (!YOUTUBE_HOST.test(address.hostname)) return null
  const named = address.searchParams.get('v')
  if (named) return named
  const [, kind, id] = address.pathname.split('/')
  return id && ['embed', 'shorts', 'live'].includes(kind) ? id : null
}

/**
 * A Vimeo video's id. Null for anything else.
 *
 * @param {string} url
 * @returns {string|null}
 */
export function vimeoId(url) {
  if (!url || typeof url !== 'string') return null
  return url.match(/vimeo\.com\/(?:video\/)?(\d+)/)?.[1] || null
}

/**
 * The address to embed a YouTube video from.
 *
 * @param {string} id - the video's id (`youTubeId`)
 * @param {{ autoplay?: boolean, muted?: boolean, loop?: boolean }} [options]
 * @returns {string}
 */
export function youTubeEmbedUrl(id, { autoplay = false, muted = false, loop = false } = {}) {
  const params = new URLSearchParams({ enablejsapi: '1', rel: '0' })
  if (autoplay) params.set('autoplay', '1')
  if (muted) params.set('mute', '1')
  if (loop) {
    params.set('loop', '1')
    params.set('playlist', id)
  }
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?${params}`
}

/**
 * The address to embed a Vimeo video from.
 *
 * @param {string} id - the video's id (`vimeoId`)
 * @param {{ autoplay?: boolean, muted?: boolean, loop?: boolean }} [options]
 * @returns {string}
 */
export function vimeoEmbedUrl(id, { autoplay = false, muted = false, loop = false } = {}) {
  const params = new URLSearchParams({ dnt: '1' })
  if (autoplay) params.set('autoplay', '1')
  if (muted) params.set('muted', '1')
  if (loop) params.set('loop', '1')
  return `https://player.vimeo.com/video/${encodeURIComponent(id)}?${params}`
}

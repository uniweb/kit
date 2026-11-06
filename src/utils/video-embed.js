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

/** The characters a video's id is made of: what follows them in a pasted address (`?t=30`) is not the id. */
const VIDEO_ID = /^[\w-]+/

/**
 * An address as an author wrote it, made absolute: a pasted `youtu.be/…` or `www.youtube.com/…`
 * often has no scheme. Null for a path on the site itself, which names no video of YouTube's.
 *
 * @param {string} url
 * @returns {URL|null}
 */
function absolute(url) {
  const written = url.trim()
  let address = written
  if (written.startsWith('//')) address = `https:${written}`
  else if (written.startsWith('/')) return null
  else if (!/^[a-z][a-z\d+.-]*:/i.test(written)) address = `https://${written}`
  try {
    return new URL(address)
  } catch {
    return null
  }
}

/**
 * A YouTube video's id, from any address that names one: `watch?v=`, `youtu.be/`, `embed/`,
 * `shorts/` or `live/`, with or without a scheme. Null for anything else.
 *
 * ⛔ For part of 2026-11-06 an address with no scheme was read as a path on youtube.com, and
 * `youtu.be/ID` or `www.youtube.com/embed/ID` named no video: the old pattern had found the id in
 * the text, and those videos stopped playing.
 *
 * @param {string} url
 * @returns {string|null}
 */
export function youTubeId(url) {
  if (!url || typeof url !== 'string') return null
  const address = absolute(url)
  if (!address) return null
  let id = null
  if (address.hostname === 'youtu.be') {
    id = address.pathname.split('/')[1]
  } else if (YOUTUBE_HOST.test(address.hostname)) {
    const [, kind, segment] = address.pathname.split('/')
    id = address.searchParams.get('v') || (['embed', 'shorts', 'live'].includes(kind) ? segment : null)
  }
  return id?.match(VIDEO_ID)?.[0] || null
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

/**
 * The address a YouTube or Vimeo video is embedded from — `src/utils/video-embed.js`, which both
 * `Media` components read.
 *
 * ⛔ Until 2026-11-06 both sent YouTube an empty `playlist=` on every video that didn't loop, and
 * YouTube answers that with "This video is unavailable".
 */

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { youTubeId, vimeoId, youTubeEmbedUrl, vimeoEmbedUrl } from '../src/utils/video-embed.js'
import { detectMediaType } from '../src/utils/index.js'
import { Media } from '../src/components/Media/Media.jsx'
import { Media as StyledMedia } from '../src/styled/Media/Media.jsx'

const query = (url) => Object.fromEntries(new URL(url).searchParams)

describe('youTubeEmbedUrl', () => {
  it('⭐ sends no playlist for a video that does not loop', () => {
    const url = youTubeEmbedUrl('aqz-KE-bpKQ')
    expect(url).not.toContain('playlist')
    expect(query(url)).toEqual({ enablejsapi: '1', rel: '0' })
  })

  it('loops one video by naming it again as its playlist', () => {
    expect(query(youTubeEmbedUrl('aqz-KE-bpKQ', { loop: true }))).toMatchObject({ loop: '1', playlist: 'aqz-KE-bpKQ' })
  })

  it('autoplays muted when asked, and says nothing it was not asked', () => {
    expect(query(youTubeEmbedUrl('x', { autoplay: true, muted: true }))).toEqual({ enablejsapi: '1', rel: '0', autoplay: '1', mute: '1' })
  })

  it('embeds from the privacy-enhanced host', () => {
    expect(new URL(youTubeEmbedUrl('x')).origin).toBe('https://www.youtube-nocookie.com')
  })
})

describe('youTubeId', () => {
  it.each([
    ['https://www.youtube.com/watch?v=aqz-KE-bpKQ', 'aqz-KE-bpKQ'],
    ['https://www.youtube.com/watch?feature=share&v=aqz-KE-bpKQ', 'aqz-KE-bpKQ'],
    ['https://youtu.be/aqz-KE-bpKQ?t=30', 'aqz-KE-bpKQ'],
    ['https://www.youtube.com/embed/aqz-KE-bpKQ', 'aqz-KE-bpKQ'],
    ['https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ', 'aqz-KE-bpKQ'],
    ['https://www.youtube.com/shorts/aqz-KE-bpKQ', 'aqz-KE-bpKQ'],
    ['https://m.youtube.com/watch?v=aqz-KE-bpKQ', 'aqz-KE-bpKQ'],
  ])('reads %s', (url, id) => {
    expect(youTubeId(url)).toBe(id)
  })

  it.each([
    ['youtu.be/aqz-KE-bpKQ'],
    ['youtu.be/aqz-KE-bpKQ?t=30'],
    ['www.youtube.com/embed/aqz-KE-bpKQ'],
    ['youtube.com/embed/aqz-KE-bpKQ'],
    ['youtube.com/watch?v=aqz-KE-bpKQ'],
    ['//www.youtube.com/embed/aqz-KE-bpKQ'],
    ['  https://youtu.be/aqz-KE-bpKQ  '],
  ])('⭐ reads an address pasted without its scheme: %s', (url) => {
    expect(youTubeId(url)).toBe('aqz-KE-bpKQ')
  })

  it.each([
    ['https://www.youtube.com/watch?v=aqz-KE-bpKQ?t=30'],
    ['https://www.youtube.com/embed/aqz-KE-bpKQ&list=x'],
  ])('keeps only the id from a pasted address that runs on: %s', (url) => {
    expect(youTubeId(url)).toBe('aqz-KE-bpKQ')
  })

  it.each([
    ['https://vimeo.com/76979871'],
    ['https://example.com/watch?v=x'],
    ['https://notyoutube.com/watch?v=x'],
    ['/embed/aqz-KE-bpKQ'],
    ['https://www.youtube.com/channel/UC123'],
    [''],
    [null],
  ])('CONTROL — no id in %s', (url) => {
    expect(youTubeId(url)).toBeNull()
  })
})

describe('detectMediaType', () => {
  it.each([
    ['https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ'],
    ['youtu.be/aqz-KE-bpKQ'],
  ])('a YouTube address, the privacy-enhanced host included, is YouTube: %s', (url) => {
    expect(detectMediaType(url)).toBe('youtube')
  })
})

describe('Vimeo', () => {
  it('reads the id, and asks Vimeo not to track', () => {
    expect(vimeoId('https://vimeo.com/76979871')).toBe('76979871')
    expect(query(vimeoEmbedUrl('76979871'))).toEqual({ dnt: '1' })
    expect(query(vimeoEmbedUrl('76979871', { autoplay: true, muted: true, loop: true }))).toEqual({ dnt: '1', autoplay: '1', muted: '1', loop: '1' })
  })
})

describe('both Media components embed by these rules', () => {
  const srcOf = (html) => html.match(/<iframe[^>]*\ssrc="([^"]*)"/)?.[1]?.replaceAll('&amp;', '&')

  it.each([
    ['components/Media', Media],
    ['styled/Media', StyledMedia],
  ])('⭐ %s plays a YouTube video that does not loop', (_, Component) => {
    const src = srcOf(renderToStaticMarkup(<Component src="https://www.youtube.com/watch?v=aqz-KE-bpKQ" />))
    expect(src).toBe(youTubeEmbedUrl('aqz-KE-bpKQ'))
    expect(src).not.toContain('playlist')
  })

  it.each([
    ['components/Media', Media],
    ['styled/Media', StyledMedia],
  ])('%s plays an address written without its scheme, and one on the privacy-enhanced host', (_, Component) => {
    for (const written of ['youtu.be/aqz-KE-bpKQ', 'https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ']) {
      expect(srcOf(renderToStaticMarkup(<Component src={written} />))).toBe(youTubeEmbedUrl('aqz-KE-bpKQ'))
    }
  })
})

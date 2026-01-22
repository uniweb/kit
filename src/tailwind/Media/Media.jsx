/**
 * Media Component
 *
 * Video player supporting:
 * - YouTube embeds
 * - Vimeo embeds
 * - Local/direct video files
 * - Thumbnail facades
 * - Playback tracking
 *
 * @module @uniweb/kit/Media
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { cn } from '../../utils/index.js'
import { detectMediaType } from '../../utils/index.js'

/**
 * Extract YouTube video ID from URL
 * @param {string} url
 * @returns {string|null}
 */
function getYouTubeId(url) {
  if (!url) return null
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^&?/]+)/)
  return match?.[1] || null
}

/**
 * Extract Vimeo video ID from URL
 * @param {string} url
 * @returns {string|null}
 */
function getVimeoId(url) {
  if (!url) return null
  const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  return match?.[1] || null
}

/**
 * Get thumbnail URL for a video
 * @param {string} src - Video URL
 * @param {string} type - Media type
 * @returns {string|null}
 */
function getVideoThumbnail(src, type) {
  if (type === 'youtube') {
    const id = getYouTubeId(src)
    return id ? `https://img.youtube.com/vi/${id}/maxresdefault.jpg` : null
  }
  // Vimeo requires API call, return null for now
  return null
}

/**
 * YouTube Player Component
 */
function YouTubePlayer({ videoId, autoplay, muted, loop, onReady, onStateChange, className }) {
  const iframeRef = useRef(null)

  const params = new URLSearchParams({
    enablejsapi: '1',
    autoplay: autoplay ? '1' : '0',
    mute: muted ? '1' : '0',
    loop: loop ? '1' : '0',
    playlist: loop ? videoId : '',
    rel: '0',
    modestbranding: '1'
  })

  return (
    <iframe
      ref={iframeRef}
      src={`https://www.youtube.com/embed/${videoId}?${params}`}
      className={cn('w-full h-full', className)}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
      title="YouTube video"
    />
  )
}

/**
 * Vimeo Player Component
 */
function VimeoPlayer({ videoId, autoplay, muted, loop, className }) {
  const params = new URLSearchParams({
    autoplay: autoplay ? '1' : '0',
    muted: muted ? '1' : '0',
    loop: loop ? '1' : '0',
    dnt: '1'
  })

  return (
    <iframe
      src={`https://player.vimeo.com/video/${videoId}?${params}`}
      className={cn('w-full h-full', className)}
      allow="autoplay; fullscreen; picture-in-picture"
      allowFullScreen
      title="Vimeo video"
    />
  )
}

/**
 * Local/Direct Video Player Component
 */
function LocalVideo({ src, autoplay, muted, loop, controls, poster, onProgress, className }) {
  const videoRef = useRef(null)
  const [milestones, setMilestones] = useState({ 25: false, 50: false, 75: false, 95: false })

  useEffect(() => {
    const video = videoRef.current
    if (!video || !onProgress) return

    const handleTimeUpdate = () => {
      const percent = (video.currentTime / video.duration) * 100

      Object.entries({ 25: 25, 50: 50, 75: 75, 95: 95 }).forEach(([key, threshold]) => {
        if (percent >= threshold && !milestones[key]) {
          setMilestones((prev) => ({ ...prev, [key]: true }))
          onProgress({ milestone: key, percent, currentTime: video.currentTime })
        }
      })
    }

    video.addEventListener('timeupdate', handleTimeUpdate)
    return () => video.removeEventListener('timeupdate', handleTimeUpdate)
  }, [milestones, onProgress])

  return (
    <video
      ref={videoRef}
      src={src}
      autoPlay={autoplay}
      muted={muted}
      loop={loop}
      controls={controls}
      poster={poster}
      playsInline
      className={cn('w-full h-full object-cover', className)}
    />
  )
}

/**
 * Play Button Overlay
 */
function PlayButton({ onClick, className }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'absolute inset-0 flex items-center justify-center',
        'bg-black/30 hover:bg-black/40 transition-colors',
        'group cursor-pointer',
        className
      )}
      aria-label="Play video"
    >
      <div className="w-16 h-16 rounded-full bg-white/90 group-hover:bg-white flex items-center justify-center transition-colors">
        <svg className="w-8 h-8 text-gray-900 ml-1" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
      </div>
    </button>
  )
}

/**
 * Media - Video player component
 *
 * @param {Object} props
 * @param {string|Object} props.src - Video URL or media object
 * @param {Object} [props.media] - Media object with src/caption
 * @param {string} [props.thumbnail] - Thumbnail URL
 * @param {boolean} [props.autoplay=false] - Auto-play video
 * @param {boolean} [props.muted=false] - Mute video
 * @param {boolean} [props.loop=false] - Loop video
 * @param {boolean} [props.controls=true] - Show controls
 * @param {boolean} [props.facade=false] - Show thumbnail with play button
 * @param {string} [props.aspectRatio='16/9'] - Aspect ratio
 * @param {string} [props.className] - Additional CSS classes
 * @param {Function} [props.onProgress] - Progress callback for tracking
 * @param {Object} [props.block] - Block object for event tracking
 *
 * @example
 * // YouTube video
 * <Media src="https://youtube.com/watch?v=abc123" />
 *
 * @example
 * // With thumbnail facade
 * <Media
 *   src="https://youtube.com/watch?v=abc123"
 *   thumbnail="/images/video-poster.jpg"
 *   facade
 * />
 *
 * @example
 * // Local video
 * <Media src="/videos/intro.mp4" controls autoplay={false} />
 */
export function Media({
  src,
  media,
  thumbnail,
  autoplay = false,
  muted = false,
  loop = false,
  controls = true,
  facade = false,
  aspectRatio = '16/9',
  className,
  onProgress,
  block,
  ...props
}) {
  const [showVideo, setShowVideo] = useState(!facade)

  // Normalize source
  const videoSrc = typeof src === 'string' ? src : (src?.src || media?.src || '')
  const caption = media?.caption || src?.caption || ''

  // Detect video type
  const mediaType = detectMediaType(videoSrc)

  // Get thumbnail
  const thumbnailSrc = thumbnail || getVideoThumbnail(videoSrc, mediaType)

  // Handle play click (for facade mode)
  const handlePlay = useCallback(() => {
    setShowVideo(true)
  }, [])

  // Handle progress tracking
  const handleProgress = useCallback((data) => {
    onProgress?.(data)

    // Track via block if available
    if (block?.trackEvent && typeof window !== 'undefined' && window.uniweb?.analytics?.initialized) {
      block.trackEvent(`video_milestone_${data.milestone}`, {
        milestone: `${data.milestone}%`,
        src: videoSrc
      })
    }
  }, [onProgress, block, videoSrc])

  // Render facade (thumbnail with play button)
  if (facade && !showVideo && thumbnailSrc) {
    return (
      <div
        className={cn('relative overflow-hidden', className)}
        style={{ aspectRatio }}
        {...props}
      >
        <img
          src={thumbnailSrc}
          alt={caption || 'Video thumbnail'}
          className="w-full h-full object-cover"
        />
        <PlayButton onClick={handlePlay} />
      </div>
    )
  }

  // Render video player
  const videoContent = (() => {
    switch (mediaType) {
      case 'youtube': {
        const videoId = getYouTubeId(videoSrc)
        if (!videoId) return null
        return (
          <YouTubePlayer
            videoId={videoId}
            autoplay={autoplay || (facade && showVideo)}
            muted={muted}
            loop={loop}
          />
        )
      }

      case 'vimeo': {
        const videoId = getVimeoId(videoSrc)
        if (!videoId) return null
        return (
          <VimeoPlayer
            videoId={videoId}
            autoplay={autoplay || (facade && showVideo)}
            muted={muted}
            loop={loop}
          />
        )
      }

      case 'video':
      default:
        return (
          <LocalVideo
            src={videoSrc}
            autoplay={autoplay || (facade && showVideo)}
            muted={muted}
            loop={loop}
            controls={controls}
            poster={thumbnailSrc}
            onProgress={handleProgress}
          />
        )
    }
  })()

  return (
    <div
      className={cn('relative overflow-hidden bg-black', className)}
      style={{ aspectRatio }}
      {...props}
    >
      {videoContent}
    </div>
  )
}

export default Media

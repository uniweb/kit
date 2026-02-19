/**
 * Media Component (Plain)
 *
 * Video player supporting YouTube, Vimeo, and local video files.
 * This is the unstyled version - for styled facade with play button,
 * use @uniweb/kit/tailwind.
 *
 * @module @uniweb/kit/Media
 */

import React, { useState, useEffect, useRef } from "react";
import { cn } from "../../utils/index.js";
import { detectMediaType } from "../../utils/index.js";

/**
 * Extract YouTube video ID from URL
 */
function getYouTubeId(url) {
    if (!url) return null;
    const match = url.match(
        /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^&?/]+)/,
    );
    return match?.[1] || null;
}

/**
 * Extract Vimeo video ID from URL
 */
function getVimeoId(url) {
    if (!url) return null;
    const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    return match?.[1] || null;
}

/**
 * YouTube Player Component
 */
function YouTubePlayer({ videoId, autoplay, muted, loop, className }) {
    const params = new URLSearchParams({
        enablejsapi: "1",
        autoplay: autoplay ? "1" : "0",
        mute: muted ? "1" : "0",
        loop: loop ? "1" : "0",
        playlist: loop ? videoId : "",
        rel: "0",
        modestbranding: "1",
    });

    return (
        <iframe
            src={`https://www.youtube.com/embed/${videoId}?${params}`}
            className={className}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title="YouTube video"
        />
    );
}

/**
 * Vimeo Player Component
 */
function VimeoPlayer({ videoId, autoplay, muted, loop, className }) {
    const params = new URLSearchParams({
        autoplay: autoplay ? "1" : "0",
        muted: muted ? "1" : "0",
        loop: loop ? "1" : "0",
        dnt: "1",
    });

    return (
        <iframe
            src={`https://player.vimeo.com/video/${videoId}?${params}`}
            className={className}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            title="Vimeo video"
        />
    );
}

/**
 * Local/Direct Video Player Component
 */
function LocalVideo({
    src,
    autoplay,
    muted,
    loop,
    controls,
    poster,
    onProgress,
    className,
}) {
    const videoRef = useRef(null);
    const [milestones, setMilestones] = useState({
        25: false,
        50: false,
        75: false,
        95: false,
    });

    useEffect(() => {
        const video = videoRef.current;
        if (!video || !onProgress) return;

        const handleTimeUpdate = () => {
            const percent = (video.currentTime / video.duration) * 100;

            Object.entries({ 25: 25, 50: 50, 75: 75, 95: 95 }).forEach(
                ([key, threshold]) => {
                    if (percent >= threshold && !milestones[key]) {
                        setMilestones((prev) => ({ ...prev, [key]: true }));
                        onProgress({
                            milestone: key,
                            percent,
                            currentTime: video.currentTime,
                        });
                    }
                },
            );
        };

        video.addEventListener("timeupdate", handleTimeUpdate);
        return () => video.removeEventListener("timeupdate", handleTimeUpdate);
    }, [milestones, onProgress]);

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
            className={className}
        />
    );
}

/**
 * Media - Video player component (plain/unstyled)
 *
 * @param {Object} props
 * @param {string|Object} props.src - Video URL or media object
 * @param {Object} [props.media] - Media object with src/caption
 * @param {string} [props.poster] - Poster/thumbnail URL for local video
 * @param {boolean} [props.autoplay=false] - Auto-play video
 * @param {boolean} [props.muted=false] - Mute video
 * @param {boolean} [props.loop=false] - Loop video
 * @param {boolean} [props.controls=true] - Show controls
 * @param {string} [props.aspectRatio='16/9'] - Aspect ratio
 * @param {string} [props.className] - CSS classes for the container
 * @param {string} [props.videoClassName] - CSS classes for the video element
 * @param {Function} [props.onProgress] - Progress callback for tracking
 *
 * @example
 * <Media src="https://youtube.com/watch?v=abc123" className="rounded-lg" />
 *
 * @example
 * <Media src="/videos/intro.mp4" controls className="w-full" />
 */
export function Media({
    src,
    media,
    poster,
    autoplay = false,
    muted = false,
    loop = false,
    controls = true,
    aspectRatio = "16/9",
    className,
    videoClassName,
    onProgress,
    ...props
}) {
    // Normalize source
    const videoSrc =
        typeof src === "string" ? src : src?.src || media?.src || "";

    // Detect video type
    const mediaType = detectMediaType(videoSrc);

    // Render video player
    const videoContent = (() => {
        const playerClass = cn("w-full h-full", videoClassName);

        switch (mediaType) {
            case "youtube": {
                const videoId = getYouTubeId(videoSrc);
                if (!videoId) return null;
                return (
                    <YouTubePlayer
                        videoId={videoId}
                        autoplay={autoplay}
                        muted={muted}
                        loop={loop}
                        className={playerClass}
                    />
                );
            }

            case "vimeo": {
                const videoId = getVimeoId(videoSrc);
                if (!videoId) return null;
                return (
                    <VimeoPlayer
                        videoId={videoId}
                        autoplay={autoplay}
                        muted={muted}
                        loop={loop}
                        className={playerClass}
                    />
                );
            }

            case "video":
            default:
                return (
                    <LocalVideo
                        src={videoSrc}
                        autoplay={autoplay}
                        muted={muted}
                        loop={loop}
                        controls={controls}
                        poster={poster}
                        onProgress={onProgress}
                        className={playerClass}
                    />
                );
        }
    })();

    return (
        <div
            className={cn("relative overflow-hidden", className)}
            style={{ aspectRatio }}
            {...props}
        >
            {videoContent}
        </div>
    );
}

export default Media;

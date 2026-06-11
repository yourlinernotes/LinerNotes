"use client";

import { useEffect, useState, useRef } from "react";
import type { Review } from "@/lib/types";
import { FastAverageColor } from "fast-average-color";
import { Waveform } from "./Waveform";
import { StarRating } from "./StarRating";

interface ReviewCardProps {
  review: Review;
  className?: string;
}

interface CardColors {
  background: string;
  text: string;
  accent: string;
}

export function ReviewCard({ review, className = "" }: ReviewCardProps) {
  const [colors, setColors] = useState<CardColors>({
    background: "#1a1a1a",
    text: "#ffffff",
    accent: "#ffffff",
  });
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!imgRef.current) return;

    const fac = new FastAverageColor();
    const img = imgRef.current;

    img.crossOrigin = "Anonymous";

    const extractColors = async () => {
      try {
        const avgColor = await fac.getColorAsync(img);
        const isDark = avgColor.isDark;

        setColors({
          background: avgColor.hex,
          text: isDark ? "#ffffff" : "#1a1a1a",
          accent: isDark ? "#ffffff" : avgColor.hex,
        });
      } catch (error) {
        console.error("Color extraction failed:", error);
      }
    };

    if (img.complete) {
      extractColors();
    } else {
      img.addEventListener("load", extractColors);
      return () => img.removeEventListener("load", extractColors);
    }
  }, [review.track.artworkUrl]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getSpotifyLink = (trackId: string, momentSeconds?: number) => {
    // Try Spotify deep link first (works on mobile)
    const spotifyUri = `spotify:track:${trackId}`;

    // Fallback to web link
    const webLink = momentSeconds
      ? `https://open.spotify.com/track/${trackId}#${formatTime(momentSeconds)}`
      : `https://open.spotify.com/track/${trackId}`;

    return webLink;
  };

  return (
    <div
      className={`review-card relative overflow-hidden rounded-xl shadow-2xl ${className}`}
      style={{
        backgroundColor: colors.background,
        color: colors.text,
        maxWidth: "500px",
        width: "100%",
      }}
    >
      {/* Album Art */}
      <div className="relative aspect-square w-full">
        <img
          ref={imgRef}
          src={review.track.artworkUrl}
          alt={`${review.track.album} by ${review.track.artist}`}
          className="w-full h-full object-cover"
        />

        {/* Rating overlay - top right */}
        <div
          className="absolute top-4 right-4 px-3 py-2 rounded-lg backdrop-blur-md"
          style={{
            backgroundColor: `${colors.background}cc`,
          }}
        >
          <StarRating rating={review.rating} color={colors.text} size={20} />
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-4">
        {/* Track info */}
        <div className="space-y-1">
          <h2 className="text-2xl font-bold leading-tight">
            {review.track.name}
          </h2>
          <p className="text-lg opacity-75">{review.track.artist}</p>
          {review.track.album && (
            <p className="text-sm opacity-60">{review.track.album}</p>
          )}
        </div>

        {/* Waveform with moment */}
        {review.moment && (
          <div className="space-y-2">
            <Waveform
              momentSeconds={review.moment.seconds}
              duration={30}
              accentColor={colors.accent}
              baseColor={`${colors.text}40`}
            />
            <a
              href={getSpotifyLink(review.track.trackId, review.moment.seconds)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm opacity-75 hover:opacity-100 transition-opacity cursor-pointer"
            >
              <svg
                className="w-4 h-4"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
              </svg>
              {formatTime(review.moment.seconds)} · {review.moment.label || "marked moment"}
            </a>
          </div>
        )}

        {/* Take */}
        {review.take && (
          <blockquote
            className="text-xl italic leading-relaxed border-l-4 pl-4"
            style={{ borderColor: colors.accent }}
          >
            "{review.take}"
          </blockquote>
        )}

        {/* Jump in link - opens song on Spotify */}
        <a
          href={getSpotifyLink(review.track.trackId)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm opacity-75 hover:opacity-100 transition-opacity"
        >
          <svg
            className="w-4 h-4"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
              clipRule="evenodd"
            />
          </svg>
          listen on Spotify
        </a>

        {/* Footer */}
        <div className="pt-4 border-t flex items-center justify-between text-sm opacity-60"
          style={{ borderColor: `${colors.text}20` }}
        >
          <span>made on LinerNotes</span>
          {review.user && <span>@{review.user.handle}</span>}
        </div>
      </div>
    </div>
  );
}

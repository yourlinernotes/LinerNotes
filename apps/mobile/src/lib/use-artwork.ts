/**
 * Resolve album artwork via Odesli (Song.link) by artist + title.
 *
 * Results are cached in-memory per session so repeated cards/renders don't
 * refetch. `fallback` (e.g. the API's track.artworkUrl) is shown immediately
 * and while resolving.
 *
 * NOTE: the Odesli public API is rate-limited, so resolving per-card on the
 * client is best-effort. The robust long-term fix is to resolve + cache
 * artwork on the backend and return it with the review.
 */

import { useEffect, useState } from 'react';
import { odesli } from '../services/odesli';

const cache = new Map<string, string | null>();

export function useArtwork(
  artist?: string,
  title?: string,
  fallback?: string,
): string | undefined {
  const key = artist && title ? `${artist}|${title}` : '';

  const [url, setUrl] = useState<string | undefined>(() =>
    key && cache.has(key) ? cache.get(key) ?? fallback : fallback,
  );

  useEffect(() => {
    if (!key || cache.has(key)) return;
    let active = true;

    odesli
      .resolve(artist as string, title as string)
      .then((res) => {
        const art = res ? odesli.getMetadata(res)?.thumbnailUrl ?? null : null;
        cache.set(key, art);
        if (active && art) setUrl(art);
      })
      .catch(() => {
        cache.set(key, null);
      });

    return () => {
      active = false;
    };
  }, [key]);

  return url;
}

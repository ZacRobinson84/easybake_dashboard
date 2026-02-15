import type { AlbumRelease } from './types.ts';

const cache = new Map<string, number | null>();
const requestTimestamps: number[] = [];

async function rateLimit(): Promise<void> {
  const now = Date.now();
  while (requestTimestamps.length > 0 && requestTimestamps[0]! < now - 1000) {
    requestTimestamps.shift();
  }
  if (requestTimestamps.length >= 5) {
    const oldest = requestTimestamps[0]!;
    const waitMs = oldest + 1000 - now;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  requestTimestamps.push(Date.now());
}

async function fetchArtistListeners(apiKey: string, artist: string): Promise<number | null> {
  const cacheKey = artist.toLowerCase();
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }

  try {
    await rateLimit();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(
      `http://ws.audioscrobbler.com/2.0/?method=artist.getinfo&api_key=${apiKey}&artist=${encodeURIComponent(artist)}&format=json`,
      { signal: controller.signal },
    );
    clearTimeout(timeout);

    if (!res.ok) {
      cache.set(cacheKey, null);
      return null;
    }

    const data = (await res.json()) as {
      artist?: { stats?: { listeners?: string } };
    };

    const listeners = data.artist?.stats?.listeners;
    const count = listeners ? parseInt(listeners, 10) : null;
    const result = count !== null && !isNaN(count) ? count : null;
    cache.set(cacheKey, result);
    return result;
  } catch {
    cache.set(cacheKey, null);
    return null;
  }
}

export async function fetchAllArtistPopularity(
  apiKey: string,
  albums: AlbumRelease[],
): Promise<Map<string, number>> {
  const seen = new Set<string>();
  const uniqueArtists: string[] = [];
  for (const album of albums) {
    const key = album.artist.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      uniqueArtists.push(album.artist);
    }
  }

  const results = await Promise.allSettled(
    uniqueArtists.map(async (artist) => {
      const listeners = await fetchArtistListeners(apiKey, artist);
      return { artist, listeners };
    }),
  );

  const map = new Map<string, number>();
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.listeners !== null) {
      map.set(result.value.artist, result.value.listeners);
    }
  }
  return map;
}

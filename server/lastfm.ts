import type { AlbumRelease } from './types.ts';

interface ArtistInfo {
  listeners: number | null;
  genre: string | null;
}

const cache = new Map<string, ArtistInfo>();
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

async function fetchArtistInfo(apiKey: string, artist: string): Promise<ArtistInfo> {
  const cacheKey = artist.toLowerCase();
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }

  const nullResult: ArtistInfo = { listeners: null, genre: null };

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
      cache.set(cacheKey, nullResult);
      return nullResult;
    }

    const data = (await res.json()) as {
      artist?: {
        stats?: { listeners?: string };
        tags?: { tag?: Array<{ name?: string }> };
      };
    };

    const listeners = data.artist?.stats?.listeners;
    const count = listeners ? parseInt(listeners, 10) : null;
    const listenersResult = count !== null && !isNaN(count) ? count : null;

    const topTag = data.artist?.tags?.tag?.[0]?.name ?? null;

    const result: ArtistInfo = { listeners: listenersResult, genre: topTag };
    cache.set(cacheKey, result);
    return result;
  } catch {
    cache.set(cacheKey, nullResult);
    return nullResult;
  }
}

export async function fetchAllArtistPopularity(
  apiKey: string,
  albums: AlbumRelease[],
): Promise<Map<string, { listeners: number | null; genre: string | null }>> {
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
      const info = await fetchArtistInfo(apiKey, artist);
      return { artist, info };
    }),
  );

  const map = new Map<string, { listeners: number | null; genre: string | null }>();
  for (const result of results) {
    if (result.status === 'fulfilled') {
      map.set(result.value.artist, result.value.info);
    }
  }
  return map;
}

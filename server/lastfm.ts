import type { AlbumRelease, ChartTrack, ChartAlbum, ChartArtist, TopChartsResponse } from './types.ts';

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

// --- iTunes artwork lookup ---

interface ITunesResult {
  artworkUrl100?: string;
  releaseDate?: string;
}

async function fetchITunesArtwork(query: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=1`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { results?: ITunesResult[] };
    const art = data.results?.[0]?.artworkUrl100;
    if (!art) return null;
    return art.replace('100x100', '300x300');
  } catch {
    return null;
  }
}

async function fetchITunesAlbumInfo(artist: string, album: string): Promise<{ artwork: string | null; releaseDate: string | null }> {
  const nullResult = { artwork: null, releaseDate: null };
  const queries = [
    `${artist} ${album}`,
    album,
    `${artist} ${album.replace(/\s*\(.*?\)/g, '')}`,
  ];
  for (const query of queries) {
    try {
      const res = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=album&limit=1`,
      );
      if (!res.ok) continue;
      const data = (await res.json()) as { results?: ITunesResult[] };
      const result = data.results?.[0];
      if (!result) continue;
      const artwork = result.artworkUrl100?.replace('100x100', '300x300') ?? null;
      const releaseDate = result.releaseDate?.slice(0, 10) ?? null;
      if (releaseDate) return { artwork, releaseDate };
    } catch {
      continue;
    }
  }
  return nullResult;
}

// --- Top Charts ---

let chartsCache: { data: TopChartsResponse; timestamp: number } | null = null;
const CHARTS_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

async function fetchTopTracks(apiKey: string, limit = 20): Promise<ChartTrack[]> {
  await rateLimit();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(
      `http://ws.audioscrobbler.com/2.0/?method=chart.gettoptracks&api_key=${apiKey}&limit=${limit}&format=json`,
      { signal: controller.signal },
    );
    clearTimeout(timeout);
    if (!res.ok) return [];
    const data = (await res.json()) as {
      tracks?: {
        track?: Array<{
          name?: string;
          artist?: { name?: string };
          playcount?: string;
          listeners?: string;
          url?: string;
          image?: Array<{ '#text'?: string; size?: string }>;
        }>;
      };
    };
    return (data.tracks?.track ?? []).map((t) => ({
      name: t.name ?? '',
      artist: t.artist?.name ?? '',
      playcount: parseInt(t.playcount ?? '0', 10) || 0,
      listeners: parseInt(t.listeners ?? '0', 10) || 0,
      url: t.url ?? '',
      imageUrl: t.image?.find((i) => i.size === 'medium')?.['#text'] || null,
    }));
  } catch {
    clearTimeout(timeout);
    return [];
  }
}

async function fetchTopAlbumsForTag(apiKey: string, tag: string, limit = 10): Promise<ChartAlbum[]> {
  await rateLimit();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(
      `http://ws.audioscrobbler.com/2.0/?method=tag.gettopalbums&tag=${encodeURIComponent(tag)}&api_key=${apiKey}&limit=${limit}&format=json`,
      { signal: controller.signal },
    );
    clearTimeout(timeout);
    if (!res.ok) return [];
    const data = (await res.json()) as {
      albums?: {
        album?: Array<{
          name?: string;
          artist?: { name?: string };
          url?: string;
          image?: Array<{ '#text'?: string; size?: string }>;
        }>;
      };
    };
    return (data.albums?.album ?? []).map((a) => ({
      name: a.name ?? '',
      artist: a.artist?.name ?? '',
      url: a.url ?? '',
      imageUrl: a.image?.find((i) => i.size === 'extralarge')?.['#text'] || a.image?.find((i) => i.size === 'large')?.['#text'] || null,
      genre: tag,
      releaseDate: null,
    }));
  } catch {
    clearTimeout(timeout);
    return [];
  }
}

async function fetchTopArtists(apiKey: string, limit = 20): Promise<ChartArtist[]> {
  await rateLimit();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(
      `http://ws.audioscrobbler.com/2.0/?method=chart.gettopartists&api_key=${apiKey}&limit=${limit}&format=json`,
      { signal: controller.signal },
    );
    clearTimeout(timeout);
    if (!res.ok) return [];
    const data = (await res.json()) as {
      artists?: {
        artist?: Array<{
          name?: string;
          playcount?: string;
          listeners?: string;
          url?: string;
          image?: Array<{ '#text'?: string; size?: string }>;
        }>;
      };
    };
    return (data.artists?.artist ?? []).map((a) => ({
      name: a.name ?? '',
      playcount: parseInt(a.playcount ?? '0', 10) || 0,
      listeners: parseInt(a.listeners ?? '0', 10) || 0,
      url: a.url ?? '',
      imageUrl: a.image?.find((i) => i.size === 'medium')?.['#text'] || null,
    }));
  } catch {
    clearTimeout(timeout);
    return [];
  }
}

export async function fetchTopCharts(apiKey: string): Promise<TopChartsResponse> {
  if (chartsCache && Date.now() - chartsCache.timestamp < CHARTS_CACHE_TTL) {
    return chartsCache.data;
  }

  const genres = ['rock', 'electronic', 'hip-hop', 'metal', 'pop', 'indie', 'punk', 'jazz'];

  const [topTracks, topArtists, ...genreResults] = await Promise.all([
    fetchTopTracks(apiKey),
    fetchTopArtists(apiKey),
    ...genres.map((g) => fetchTopAlbumsForTag(apiKey, g)),
  ]);

  const topAlbumsByGenre: Record<string, ChartAlbum[]> = {};
  genres.forEach((genre, i) => {
    const albums = genreResults[i];
    if (albums.length > 0) {
      topAlbumsByGenre[genre] = albums;
    }
  });

  // Derive top 20 albums by round-robin across genres for a diverse mix
  const seen = new Set<string>();
  const topAlbums: ChartAlbum[] = [];
  const maxPerGenre = Math.max(...genreResults.map((r) => r.length));
  for (let rank = 0; rank < maxPerGenre && topAlbums.length < 20; rank++) {
    for (const albums of genreResults) {
      if (rank >= albums.length) continue;
      const album = albums[rank];
      const key = `${album.name.toLowerCase()}|${album.artist.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        topAlbums.push({ ...album, genre: '', releaseDate: null });
        if (topAlbums.length >= 20) break;
      }
    }
  }

  // Backfill artwork from iTunes for tracks and artists missing images,
  // and fetch release dates for top 20 albums
  const backfillPromises: Promise<void>[] = [];

  for (const track of topTracks) {
    if (!track.imageUrl || track.imageUrl.includes('2a96cbd8b46e442fc41c2b86b821562f')) {
      backfillPromises.push(
        fetchITunesArtwork(`${track.artist} ${track.name}`).then((url) => {
          if (url) track.imageUrl = url;
        }),
      );
    }
  }

  for (const artist of topArtists) {
    if (!artist.imageUrl || artist.imageUrl.includes('2a96cbd8b46e442fc41c2b86b821562f')) {
      backfillPromises.push(
        fetchITunesArtwork(artist.name).then((url) => {
          if (url) artist.imageUrl = url;
        }),
      );
    }
  }

  for (const album of topAlbums) {
    backfillPromises.push(
      fetchITunesAlbumInfo(album.artist, album.name).then((info) => {
        if (info.releaseDate) album.releaseDate = info.releaseDate;
      }),
    );
  }

  await Promise.allSettled(backfillPromises);

  const result: TopChartsResponse = { topTracks, topAlbums, topArtists, topAlbumsByGenre };
  chartsCache = { data: result, timestamp: Date.now() };
  return result;
}

export interface AlbumSearchResult {
  id: string; // composite "artist::albumName"
  title: string;
  subtitle: string; // artist name
  imageUrl: string | null;
  releaseDate: string;
}

export async function searchAlbums(apiKey: string, query: string): Promise<AlbumSearchResult[]> {
  await rateLimit();
  const url = `http://ws.audioscrobbler.com/2.0/?method=album.search&album=${encodeURIComponent(query)}&api_key=${apiKey}&format=json&limit=10`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Last.fm album search failed: ${res.status}`);
  const data = (await res.json()) as {
    results?: {
      albummatches?: {
        album?: Array<{
          name?: string;
          artist?: string;
          image?: Array<{ '#text'?: string; size?: string }>;
        }>;
      };
    };
  };

  const albums = data.results?.albummatches?.album ?? [];
  return albums.map((a): AlbumSearchResult => {
    const artist = a.artist ?? '';
    const name = a.name ?? '';
    // Pick largest available image
    const imageSizes = ['extralarge', 'large', 'medium', 'small'];
    let imageUrl: string | null = null;
    for (const size of imageSizes) {
      const img = a.image?.find((i) => i.size === size)?.['#text'];
      if (img && !img.includes('2a96cbd8b46e442fc41c2b86b821562f')) {
        imageUrl = img;
        break;
      }
    }
    return {
      id: `${artist}::${name}`,
      title: name,
      subtitle: artist,
      imageUrl,
      releaseDate: '',
    };
  });
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

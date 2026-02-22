import 'dotenv/config';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { fetchTodayReleases } from './igdb.ts';
import { fetchAllSteamReviews, fetchAllSteamDescriptions, backfillSteamAppIds } from './steam.ts';
import { fetchUpcomingFridayMovies, fetchNowPlayingMovies, fetchDirectorFilmography, searchMovies, searchTV } from './tmdb.ts';
import fs from 'fs';
import path from 'path';
import { fetchUpcomingFridayAlbums } from './musicbrainz.ts';
import { fetchAllArtistPopularity, fetchTopCharts, searchAlbums } from './lastfm.ts';
import { searchBooks } from './openlibrary.ts';
import {
  getAuthUrl,
  exchangeCodeForTokens,
  ensureValidToken,
  fetchSpotifyArtistNames,
  isAuthenticated,
  clearTokens,
  fetchArtistTopPreview,
} from './spotify.ts';
import { initDb, hasDatabase, dbGetWatchedItems, dbInsertWatchedItem, dbDeleteWatchedItem, dbUpdateWatchedItemRating, dbGetDismissedCards, dbDismissCard } from './db.ts';
import type { WatchedItem } from './db.ts';
import type { GameReleaseWithReviews } from './types.ts';

const clientId = process.env['TWITCH_CLIENT_ID'];
const clientSecret = process.env['TWITCH_CLIENT_SECRET'];
const tmdbApiKey = process.env['TMDB_API_KEY'];
const lastfmApiKey = process.env['LASTFM_CLIENT_ID'];
const spotifyClientId = process.env['SPOTIFY_CLIENT_ID'];
const spotifyClientSecret = process.env['SPOTIFY_CLIENT_SECRET'];
const openweatherApiKey = process.env['OPENWEATHER_API_KEY'];

const jwtSecret = process.env['JWT_SECRET'];
const dashboardPasswordHash = process.env['DASHBOARD_PASSWORD_HASH'];

if (!clientId || !clientSecret) {
  console.error('Missing required environment variables: TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET');
  console.error('Copy .env.example to .env and fill in your Twitch credentials.');
  process.exit(1);
}

if (!jwtSecret || !dashboardPasswordHash) {
  console.error('Missing required environment variables: JWT_SECRET and DASHBOARD_PASSWORD_HASH');
  process.exit(1);
}

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());

// --- Auth routes & middleware ---

const PUBLIC_PATHS = ['/api/health', '/api/auth/login', '/api/spotify/login', '/api/spotify/callback'];

app.post('/api/auth/login', async (req: Request, res: Response) => {
  const { password } = req.body;
  if (!password || typeof password !== 'string') {
    res.status(400).json({ error: 'Password is required' });
    return;
  }
  const valid = await bcrypt.compare(password, dashboardPasswordHash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid password' });
    return;
  }
  const token = jwt.sign({}, jwtSecret, { expiresIn: '7d' });
  res.json({ token });
});

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

app.use((req: Request, res: Response, next: NextFunction) => {
  if (PUBLIC_PATHS.includes(req.path)) {
    next();
    return;
  }
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid token' });
    return;
  }
  const token = authHeader.slice(7);
  try {
    jwt.verify(token, jwtSecret);
    next();
  } catch {
    res.status(401).json({ error: 'Token expired or invalid' });
  }
});

// --- Spotify OAuth routes ---

let pendingSpotifyState: string | null = null;

app.get('/api/spotify/login', (_req, res) => {
  if (!spotifyClientId) {
    res.status(500).json({ error: 'SPOTIFY_CLIENT_ID not configured' });
    return;
  }
  const { url, state } = getAuthUrl(spotifyClientId);
  pendingSpotifyState = state;
  res.redirect(url);
});

app.get('/api/spotify/callback', async (req, res) => {
  if (!spotifyClientId || !spotifyClientSecret) {
    res.status(500).json({ error: 'Spotify credentials not configured' });
    return;
  }
  const code = req.query['code'] as string | undefined;
  const state = req.query['state'] as string | undefined;
  const error = req.query['error'] as string | undefined;

  const frontendUrl = process.env.FRONTEND_URL || 'http://127.0.0.1:5173';

  if (error) {
    console.error('Spotify auth error:', error);
    res.redirect(`${frontendUrl}/music`);
    return;
  }

  if (!code || !state || state !== pendingSpotifyState) {
    res.status(400).json({ error: 'Invalid callback parameters' });
    return;
  }

  pendingSpotifyState = null;

  try {
    await exchangeCodeForTokens(spotifyClientId, spotifyClientSecret, code);
    res.redirect(`${frontendUrl}/music`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Spotify token exchange error:', message);
    res.status(500).json({ error: 'Failed to authenticate with Spotify' });
  }
});

app.get('/api/spotify/status', async (_req, res) => {
  res.json({ authenticated: await isAuthenticated() });
});

app.post('/api/spotify/logout', async (_req, res) => {
  await clearTokens();
  res.json({ success: true });
});

app.get('/api/spotify/preview', async (req, res) => {
  const artist = req.query['artist'] as string | undefined;
  if (!artist) {
    res.status(400).json({ error: 'Missing artist parameter' });
    return;
  }

  try {
    const result = await fetchArtistTopPreview(artist);
    if (!result) {
      res.json({ error: 'No preview available' });
      return;
    }
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Preview fetch error:', message);
    res.status(500).json({ error: 'Failed to fetch preview' });
  }
});

// --- Dismissed Cards ---

app.get('/api/dismissed/:category', async (req, res) => {
  const category = req.params['category'] as string;
  if (!['game', 'movie', 'album'].includes(category)) {
    res.status(400).json({ error: 'Invalid category' });
    return;
  }
  const ids = await dbGetDismissedCards(category);
  res.json(ids);
});

app.post('/api/dismissed/:category/:itemId', async (req, res) => {
  const category = req.params['category'] as string;
  const itemId = req.params['itemId'] as string;
  if (!['game', 'movie', 'album'].includes(category)) {
    res.status(400).json({ error: 'Invalid category' });
    return;
  }
  await dbDismissCard(category, itemId);
  const ids = await dbGetDismissedCards(category);
  res.json(ids);
});

app.get('/api/gaming/releases', async (_req, res) => {
  try {
    console.log('Fetching IGDB releases...');
    const releases = await fetchTodayReleases(clientId, clientSecret);
    console.log(`Got ${releases.length} releases from IGDB`);

    console.log('Backfilling Steam App IDs...');
    await backfillSteamAppIds(releases);

    console.log('Fetching Steam reviews and descriptions...');
    const [reviewsMap, descriptionsMap] = await Promise.all([
      fetchAllSteamReviews(releases),
      fetchAllSteamDescriptions(releases),
    ]);
    console.log(`Got reviews for ${reviewsMap.size} games, descriptions for ${descriptionsMap.size} games`);

    const enriched: GameReleaseWithReviews[] = releases.map((game) => ({
      ...game,
      steamReviews: game.steamAppId ? (reviewsMap.get(game.steamAppId) ?? null) : null,
      steamDescription: game.steamAppId ? (descriptionsMap.get(game.steamAppId) ?? null) : null,
    }));

    enriched.sort((a, b) => {
      const aPopularity = (a.hypes ?? 0) + (a.follows ?? 0);
      const bPopularity = (b.hypes ?? 0) + (b.follows ?? 0);

      if (aPopularity !== bPopularity) return bPopularity - aPopularity;

      return a.name.localeCompare(b.name);
    });

    const dismissedGames = new Set(await dbGetDismissedCards('game'));
    const filtered = enriched.filter((g) => !dismissedGames.has(String(g.id)));

    res.json(filtered);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error fetching releases:', message);
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch game releases' });
  }
});

app.get('/api/movies/upcoming', async (_req, res) => {
  if (!tmdbApiKey) {
    res.status(500).json({ error: 'TMDB_API_KEY not configured' });
    return;
  }
  try {
    console.log('Fetching upcoming Friday movies from TMDB...');
    const movies = await fetchUpcomingFridayMovies(tmdbApiKey);
    console.log(`Got ${movies.length} movies from TMDB`);
    const dismissedMovies = new Set(await dbGetDismissedCards('movie'));
    const filtered = movies.filter((m: { id: number }) => !dismissedMovies.has(String(m.id)));
    res.json(filtered);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error fetching movies:', message);
    res.status(500).json({ error: 'Failed to fetch movie releases' });
  }
});

app.get('/api/movies/now-playing', async (_req, res) => {
  if (!tmdbApiKey) {
    res.status(500).json({ error: 'TMDB_API_KEY not configured' });
    return;
  }
  try {
    console.log('Fetching now-playing movies from TMDB...');
    const movies = await fetchNowPlayingMovies(tmdbApiKey);
    console.log(`Got ${movies.length} now-playing movies from TMDB`);
    const dismissedMovies = new Set(await dbGetDismissedCards('movie'));
    const filtered = movies.filter((m: { id: number }) => !dismissedMovies.has(String(m.id)));
    res.json(filtered);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error fetching now-playing movies:', message);
    res.status(500).json({ error: 'Failed to fetch now-playing movies' });
  }
});

app.get('/api/movies/director/:personId/filmography', async (req, res) => {
  if (!tmdbApiKey) {
    res.status(500).json({ error: 'TMDB_API_KEY not configured' });
    return;
  }
  const personId = Number(req.params['personId']);
  if (!Number.isFinite(personId) || personId <= 0) {
    res.status(400).json({ error: 'Invalid personId' });
    return;
  }
  try {
    const films = await fetchDirectorFilmography(tmdbApiKey, personId);
    res.json(films);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error fetching filmography:', message);
    res.status(500).json({ error: 'Failed to fetch filmography' });
  }
});

app.get('/api/music/charts', async (_req, res) => {
  if (!lastfmApiKey) {
    res.status(500).json({ error: 'LASTFM_CLIENT_ID not configured' });
    return;
  }
  try {
    console.log('Fetching top charts from Last.fm...');
    const charts = await fetchTopCharts(lastfmApiKey);
    console.log(`Got ${charts.topTracks.length} top tracks and ${Object.keys(charts.topAlbumsByGenre).length} genre groups`);
    res.json(charts);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error fetching charts:', message);
    res.status(500).json({ error: 'Failed to fetch top charts' });
  }
});

app.get('/api/music/upcoming', async (_req, res) => {
  try {
    console.log('Fetching upcoming Friday albums from MusicBrainz...');
    const albums = await fetchUpcomingFridayAlbums();
    console.log(`Got ${albums.length} albums from MusicBrainz`);

    if (lastfmApiKey) {
      console.log('Fetching artist popularity from Last.fm...');
      const popularityMap = await fetchAllArtistPopularity(lastfmApiKey, albums);
      console.log(`Got popularity data for ${popularityMap.size} artists`);

      for (const album of albums) {
        const info = popularityMap.get(album.artist);
        album.artistListeners = info?.listeners ?? null;
        album.genre = info?.genre ?? undefined;
      }

      albums.sort((a, b) => {
        const aHas = a.artistListeners != null;
        const bHas = b.artistListeners != null;

        if (aHas && !bHas) return -1;
        if (!aHas && bHas) return 1;

        if (aHas && bHas) {
          return b.artistListeners! - a.artistListeners!;
        }

        return a.artist.localeCompare(b.artist);
      });
    }

    // Tag albums from Spotify library
    if (spotifyClientId && spotifyClientSecret && await isAuthenticated()) {
      try {
        const accessToken = await ensureValidToken(spotifyClientId, spotifyClientSecret);
        const spotifyArtists = await fetchSpotifyArtistNames(accessToken);
        console.log(`Got ${spotifyArtists.size} unique artists from Spotify`);

        for (const album of albums) {
          const artistParts = album.artist.split(',').map((s) => s.trim().toLowerCase());
          if (artistParts.some((part) => spotifyArtists.has(part))) {
            album.inSpotifyLibrary = true;
          }
        }
      } catch (err) {
        console.error('Spotify artist fetch error:', err instanceof Error ? err.message : err);
      }
    }

    const dismissedAlbums = new Set(await dbGetDismissedCards('album'));
    const filtered = albums.filter((a) => !dismissedAlbums.has(String(a.id)));
    res.json(filtered);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error fetching albums:', message);
    res.status(500).json({ error: 'Failed to fetch album releases' });
  }
});

app.get('/api/weather/forecast', async (req, res) => {
  if (!openweatherApiKey) {
    res.status(500).json({ error: 'OPENWEATHER_API_KEY not configured' });
    return;
  }
  const lat = req.query['lat'] as string | undefined;
  const lon = req.query['lon'] as string | undefined;
  if (!lat || !lon) {
    res.status(400).json({ error: 'Missing lat and lon query parameters' });
    return;
  }
  try {
    console.log(`Fetching weather for lat=${lat}, lon=${lon}...`);
    const base = `https://api.openweathermap.org/data/2.5`;
    const params = `lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&units=metric&appid=${openweatherApiKey}`;
    const [currentRes, forecastRes] = await Promise.all([
      fetch(`${base}/weather?${params}`),
      fetch(`${base}/forecast?${params}`),
    ]);
    if (!currentRes.ok) throw new Error(`OpenWeather current API error: ${currentRes.status}`);
    if (!forecastRes.ok) throw new Error(`OpenWeather forecast API error: ${forecastRes.status}`);
    const current = await currentRes.json();
    const forecast = await forecastRes.json();
    res.json({ current, forecast });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error fetching weather:', message);
    res.status(500).json({ error: 'Failed to fetch weather forecast' });
  }
});

// --- Watched Items (unified: movie | tv | album | book) ---

const VALID_CATEGORIES = ['movie', 'tv', 'album', 'book'] as const;

const OLD_WATCHED_FILE = path.join(process.cwd(), 'data', 'watched-movies.json');
const WATCHED_ITEMS_FILE = path.join(process.cwd(), 'data', 'watched-items.json');

interface LegacyWatchedMovie {
  id: number;
  title: string;
  posterUrl: string | null;
  releaseDate: string;
  addedAt: string;
}

function sortWatchedItems(items: WatchedItem[], category: string): WatchedItem[] {
  if (category === 'movie' || category === 'tv') {
    return [...items].sort((a, b) => b.subtitle.localeCompare(a.subtitle));
  }
  return items;
}

function readWatchedItems(category: string): WatchedItem[] {
  try {
    const all = JSON.parse(fs.readFileSync(WATCHED_ITEMS_FILE, 'utf-8')) as WatchedItem[];
    return sortWatchedItems(all.filter((i) => i.category === category), category);
  } catch {
    // Fall back to old watched-movies.json for movie category
    if (category === 'movie') {
      try {
        const old = JSON.parse(fs.readFileSync(OLD_WATCHED_FILE, 'utf-8')) as LegacyWatchedMovie[];
        return old.map((m) => ({
          id: String(m.id),
          category: 'movie',
          title: m.title,
          subtitle: m.releaseDate ? m.releaseDate.slice(0, 4) : '',
          imageUrl: m.posterUrl,
          addedAt: m.addedAt,
          rating: null,
        }));
      } catch {
        return [];
      }
    }
    return [];
  }
}

function writeWatchedItem(item: WatchedItem): void {
  const dir = path.dirname(WATCHED_ITEMS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  let all: WatchedItem[] = [];
  try {
    all = JSON.parse(fs.readFileSync(WATCHED_ITEMS_FILE, 'utf-8'));
  } catch {
    // Start fresh — but try migrating old movies first
    if (fs.existsSync(OLD_WATCHED_FILE)) {
      try {
        const old = JSON.parse(fs.readFileSync(OLD_WATCHED_FILE, 'utf-8')) as LegacyWatchedMovie[];
        all = old.map((m) => ({
          id: String(m.id),
          category: 'movie',
          title: m.title,
          subtitle: m.releaseDate ? m.releaseDate.slice(0, 4) : '',
          imageUrl: m.posterUrl,
          addedAt: m.addedAt,
          rating: null,
        }));
      } catch { /* ignore */ }
    }
  }
  const exists = all.some((i) => i.category === item.category && i.id === item.id);
  if (!exists) all.push(item);
  fs.writeFileSync(WATCHED_ITEMS_FILE, JSON.stringify(all, null, 2));
}

function deleteWatchedItem(category: string, id: string): void {
  let all: WatchedItem[] = [];
  try {
    all = JSON.parse(fs.readFileSync(WATCHED_ITEMS_FILE, 'utf-8'));
  } catch {
    return;
  }
  all = all.filter((i) => !(i.category === category && i.id === id));
  fs.writeFileSync(WATCHED_ITEMS_FILE, JSON.stringify(all, null, 2));
}

function updateWatchedItemRating(category: string, id: string, rating: number | null): void {
  let all: WatchedItem[] = [];
  try {
    all = JSON.parse(fs.readFileSync(WATCHED_ITEMS_FILE, 'utf-8'));
  } catch {
    return;
  }
  const item = all.find((i) => i.category === category && i.id === id);
  if (item) item.rating = rating;
  fs.writeFileSync(WATCHED_ITEMS_FILE, JSON.stringify(all, null, 2));
}

app.get('/api/watched/:category', async (req, res) => {
  const category = req.params['category'] as string;
  if (!(VALID_CATEGORIES as readonly string[]).includes(category)) {
    res.status(400).json({ error: 'Invalid category' });
    return;
  }
  if (hasDatabase()) {
    const items = await dbGetWatchedItems(category);
    if (items) {
      res.json(items);
      return;
    }
  }
  res.json(readWatchedItems(category));
});

app.post('/api/watched/:category', async (req, res) => {
  const category = req.params['category'] as string;
  if (!(VALID_CATEGORIES as readonly string[]).includes(category)) {
    res.status(400).json({ error: 'Invalid category' });
    return;
  }
  const { id, title, subtitle, imageUrl } = req.body;
  if (!id || !title) {
    res.status(400).json({ error: 'Missing id or title' });
    return;
  }
  const item: WatchedItem = {
    id: String(id),
    category,
    title,
    subtitle: subtitle ?? '',
    imageUrl: imageUrl ?? null,
    addedAt: new Date().toISOString(),
    rating: null,
  };

  if (hasDatabase()) {
    await dbInsertWatchedItem(item);
    const items = await dbGetWatchedItems(category);
    res.json(items ?? []);
    return;
  }

  writeWatchedItem(item);
  res.json(readWatchedItems(category));
});

app.delete('/api/watched/:category/:id', async (req, res) => {
  const category = req.params['category'] as string;
  const id = req.params['id'] as string;
  if (!(VALID_CATEGORIES as readonly string[]).includes(category)) {
    res.status(400).json({ error: 'Invalid category' });
    return;
  }

  if (hasDatabase()) {
    await dbDeleteWatchedItem(category, id);
    const items = await dbGetWatchedItems(category);
    res.json(items ?? []);
    return;
  }

  deleteWatchedItem(category, id);
  res.json(readWatchedItems(category));
});

app.patch('/api/watched/:category/:id/rating', async (req, res) => {
  const category = req.params['category'] as string;
  const id = req.params['id'] as string;
  if (!(VALID_CATEGORIES as readonly string[]).includes(category)) {
    res.status(400).json({ error: 'Invalid category' });
    return;
  }
  const { rating } = req.body as { rating: unknown };
  if (rating !== null && (!Number.isInteger(rating) || (rating as number) < 1 || (rating as number) > 5)) {
    res.status(400).json({ error: 'Rating must be an integer 1–5 or null' });
    return;
  }
  const ratingValue = rating as number | null;

  if (hasDatabase()) {
    await dbUpdateWatchedItemRating(category, id, ratingValue);
    const items = await dbGetWatchedItems(category);
    res.json(items ?? []);
    return;
  }

  updateWatchedItemRating(category, id, ratingValue);
  res.json(readWatchedItems(category));
});

app.get('/api/movies/search', async (req, res) => {
  if (!tmdbApiKey) {
    res.status(500).json({ error: 'TMDB_API_KEY not configured' });
    return;
  }
  const q = req.query['q'] as string | undefined;
  if (!q) {
    res.status(400).json({ error: 'Missing q parameter' });
    return;
  }
  try {
    const results = await searchMovies(tmdbApiKey, q);
    res.json(results);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error searching movies:', message);
    res.status(500).json({ error: 'Failed to search movies' });
  }
});

app.get('/api/tv/search', async (req, res) => {
  if (!tmdbApiKey) {
    res.status(500).json({ error: 'TMDB_API_KEY not configured' });
    return;
  }
  const q = req.query['q'] as string | undefined;
  if (!q) {
    res.status(400).json({ error: 'Missing q parameter' });
    return;
  }
  try {
    const results = await searchTV(tmdbApiKey, q);
    res.json(results);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error searching TV shows:', message);
    res.status(500).json({ error: 'Failed to search TV shows' });
  }
});

app.get('/api/albums/search', async (req, res) => {
  if (!lastfmApiKey) {
    res.status(500).json({ error: 'LASTFM_CLIENT_ID not configured' });
    return;
  }
  const q = req.query['q'] as string | undefined;
  if (!q) {
    res.status(400).json({ error: 'Missing q parameter' });
    return;
  }
  try {
    const results = await searchAlbums(lastfmApiKey, q);
    res.json(results);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error searching albums:', message);
    res.status(500).json({ error: 'Failed to search albums' });
  }
});

app.get('/api/books/search', async (req, res) => {
  const q = req.query['q'] as string | undefined;
  if (!q) {
    res.status(400).json({ error: 'Missing q parameter' });
    return;
  }
  try {
    const results = await searchBooks(q);
    res.json(results);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error searching books:', message);
    res.status(500).json({ error: 'Failed to search books' });
  }
});

const PORT = process.env.PORT || 3001;

(async () => {
  await initDb();

  // JSON file migration: copy watched-movies.json into watched-items.json if needed
  if (fs.existsSync(OLD_WATCHED_FILE) && !fs.existsSync(WATCHED_ITEMS_FILE)) {
    try {
      const old = JSON.parse(fs.readFileSync(OLD_WATCHED_FILE, 'utf-8')) as LegacyWatchedMovie[];
      const migrated: WatchedItem[] = old.map((m) => ({
        id: String(m.id),
        category: 'movie',
        title: m.title,
        subtitle: m.releaseDate ? m.releaseDate.slice(0, 4) : '',
        imageUrl: m.posterUrl,
        addedAt: m.addedAt,
        rating: null,
      }));
      const dir = path.dirname(WATCHED_ITEMS_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(WATCHED_ITEMS_FILE, JSON.stringify(migrated, null, 2));
      console.log(`Migrated ${migrated.length} movies from watched-movies.json to watched-items.json`);
    } catch (err) {
      console.error('Failed to migrate watched-movies.json:', err);
    }
  }

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
})();

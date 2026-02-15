import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fetchTodayReleases } from './igdb.ts';
import { fetchAllSteamReviews } from './steam.ts';
import { fetchUpcomingFridayMovies, fetchNowPlayingMovies, fetchDirectorFilmography } from './tmdb.ts';
import { fetchUpcomingFridayAlbums } from './musicbrainz.ts';
import { fetchAllArtistPopularity, fetchTopCharts } from './lastfm.ts';
import {
  getAuthUrl,
  exchangeCodeForTokens,
  ensureValidToken,
  fetchSpotifyArtistNames,
  isAuthenticated,
  clearTokens,
  fetchArtistTopPreview,
} from './spotify.ts';
import type { GameReleaseWithReviews } from './types.ts';

const clientId = process.env['TWITCH_CLIENT_ID'];
const clientSecret = process.env['TWITCH_CLIENT_SECRET'];
const tmdbApiKey = process.env['TMDB_API_KEY'];
const lastfmApiKey = process.env['LASTFM_CLIENT_ID'];
const spotifyClientId = process.env['SPOTIFY_CLIENT_ID'];
const spotifyClientSecret = process.env['SPOTIFY_CLIENT_SECRET'];

if (!clientId || !clientSecret) {
  console.error('Missing required environment variables: TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET');
  console.error('Copy .env.example to .env and fill in your Twitch credentials.');
  process.exit(1);
}

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());

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

app.get('/api/spotify/status', (_req, res) => {
  res.json({ authenticated: isAuthenticated() });
});

app.post('/api/spotify/logout', (_req, res) => {
  clearTokens();
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

app.get('/api/gaming/releases', async (_req, res) => {
  try {
    console.log('Fetching IGDB releases...');
    const releases = await fetchTodayReleases(clientId, clientSecret);
    console.log(`Got ${releases.length} releases from IGDB`);

    console.log('Fetching Steam reviews...');
    const reviewsMap = await fetchAllSteamReviews(releases);
    console.log(`Got reviews for ${reviewsMap.size} games`);

    const enriched: GameReleaseWithReviews[] = releases.map((game) => ({
      ...game,
      steamReviews: game.steamAppId ? (reviewsMap.get(game.steamAppId) ?? null) : null,
    }));

    enriched.sort((a, b) => {
      const aHasReviews = a.steamReviews !== null;
      const bHasReviews = b.steamReviews !== null;

      if (aHasReviews && !bHasReviews) return -1;
      if (!aHasReviews && bHasReviews) return 1;

      if (aHasReviews && bHasReviews) {
        return b.steamReviews!.totalReviews - a.steamReviews!.totalReviews;
      }

      return a.name.localeCompare(b.name);
    });

    res.json(enriched);
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
    res.json(movies);
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
    res.json(movies);
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
    if (spotifyClientId && spotifyClientSecret && isAuthenticated()) {
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

    res.json(albums);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error fetching albums:', message);
    res.status(500).json({ error: 'Failed to fetch album releases' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

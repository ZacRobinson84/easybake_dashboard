import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fetchTodayReleases } from './igdb.ts';
import { fetchAllSteamReviews } from './steam.ts';
import type { GameReleaseWithReviews } from './types.ts';

const clientId = process.env['TWITCH_CLIENT_ID'];
const clientSecret = process.env['TWITCH_CLIENT_SECRET'];

if (!clientId || !clientSecret) {
  console.error('Missing required environment variables: TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET');
  console.error('Copy .env.example to .env and fill in your Twitch credentials.');
  process.exit(1);
}

const app = express();

app.use(cors({ origin: 'http://localhost:5173' }));

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

app.listen(3001, () => {
  console.log('Server running on http://localhost:3001');
});

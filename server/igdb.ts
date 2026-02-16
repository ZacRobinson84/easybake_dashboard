import type { IGDBGame, GameRelease } from './types.ts';

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getTwitchToken(clientId: string, clientSecret: string): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    }),
  });

  if (!res.ok) {
    throw new Error(`Twitch OAuth failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = data.access_token;
  tokenExpiresAt = now + data.expires_in * 1000;
  return cachedToken;
}

export async function fetchTodayReleases(clientId: string, clientSecret: string): Promise<GameRelease[]> {
  const token = await getTwitchToken(clientId, clientSecret);

  const now = new Date();
  const startOfDay = Math.floor(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).getTime() / 1000);
  const endOfDay = startOfDay + 86400;

  const body = [
    'fields name,cover.url,platforms.name,external_games.category,external_games.uid,websites.url,websites.category,hypes,follows;',
    `where first_release_date >= ${startOfDay} & first_release_date < ${endOfDay};`,
    'sort hypes desc;',
    'limit 50;',
  ].join('\n');

  const res = await fetch('https://api.igdb.com/v4/games', {
    method: 'POST',
    headers: {
      'Client-ID': clientId,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'text/plain',
      'Accept': 'application/json',
    },
    body,
  });

  if (!res.ok) {
    throw new Error(`IGDB API failed: ${res.status} ${await res.text()}`);
  }

  const games = (await res.json()) as IGDBGame[];

  return games.map((game) => {
    const steamExternal = game.external_games?.find((eg) => eg.category === 1);
    let coverUrl: string | null = null;
    if (game.cover?.url) {
      coverUrl = `https:${game.cover.url.replace('t_thumb', 't_cover_big')}`;
    }

    // Prefer official website (category 1), then any available website
    const officialSite = game.websites?.find((w) => w.category === 1);
    const websiteUrl = officialSite?.url ?? game.websites?.[0]?.url ?? null;

    return {
      id: game.id,
      name: game.name,
      coverUrl,
      platforms: game.platforms?.map((p) => p.name) ?? [],
      steamAppId: steamExternal?.uid ?? null,
      websiteUrl,
      hypes: game.hypes ?? 0,
      follows: game.follows ?? 0,
    };
  });
}

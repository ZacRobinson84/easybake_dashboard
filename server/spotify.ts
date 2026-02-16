import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { randomBytes } from 'crypto';
import { hasDatabase, dbLoadTokens, dbSaveTokens, dbClearTokens } from './db.ts';

const TOKEN_FILE = '.spotify-tokens.json';
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || 'http://127.0.0.1:5173/api/spotify/callback';
const SCOPES = 'user-top-read user-read-recently-played';

interface SpotifyTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

function loadTokensFromFile(): SpotifyTokens | null {
  if (!existsSync(TOKEN_FILE)) return null;
  try {
    return JSON.parse(readFileSync(TOKEN_FILE, 'utf-8')) as SpotifyTokens;
  } catch {
    return null;
  }
}

function saveTokensToFile(tokens: SpotifyTokens): void {
  writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2));
}

async function loadTokens(): Promise<SpotifyTokens | null> {
  if (hasDatabase()) {
    return dbLoadTokens();
  }
  return loadTokensFromFile();
}

async function saveTokens(tokens: SpotifyTokens): Promise<void> {
  if (hasDatabase()) {
    await dbSaveTokens(tokens);
    return;
  }
  saveTokensToFile(tokens);
}

export async function isAuthenticated(): Promise<boolean> {
  const tokens = await loadTokens();
  return tokens !== null;
}

export async function clearTokens(): Promise<void> {
  if (hasDatabase()) {
    await dbClearTokens();
    return;
  }
  if (existsSync(TOKEN_FILE)) unlinkSync(TOKEN_FILE);
}

export function getAuthUrl(clientId: string): { url: string; state: string } {
  const state = randomBytes(16).toString('hex');
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: SCOPES,
    redirect_uri: REDIRECT_URI,
    state,
  });
  return { url: `https://accounts.spotify.com/authorize?${params}`, state };
}

export async function exchangeCodeForTokens(
  clientId: string,
  clientSecret: string,
  code: string,
): Promise<void> {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Spotify token exchange failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  await saveTokens({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  });
}

async function refreshAccessToken(clientId: string, clientSecret: string): Promise<string> {
  const tokens = await loadTokens();
  if (!tokens) throw new Error('No Spotify tokens found');

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokens.refresh_token,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Spotify token refresh failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  await saveTokens({
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? tokens.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  });

  return data.access_token;
}

export async function ensureValidToken(clientId: string, clientSecret: string): Promise<string> {
  const tokens = await loadTokens();
  if (!tokens) throw new Error('No Spotify tokens found');

  if (Date.now() < tokens.expires_at - 60_000) {
    return tokens.access_token;
  }

  return refreshAccessToken(clientId, clientSecret);
}

export async function fetchArtistTopPreview(
  artistName: string,
): Promise<{ trackName: string; previewUrl: string } | null> {
  // Use iTunes Search API — free, no auth, reliable 30-second previews
  const res = await fetch(
    `https://itunes.apple.com/search?term=${encodeURIComponent(artistName)}&entity=song&limit=10&attribute=artistTerm`,
  );
  if (!res.ok) return null;

  const data = (await res.json()) as {
    results: Array<{ trackName: string; previewUrl?: string; artistName: string }>;
  };

  // Find first result with a preview URL whose artist name matches
  const nameLower = artistName.toLowerCase();
  const track = data.results.find(
    (t) => t.previewUrl && t.artistName.toLowerCase() === nameLower,
  ) ?? data.results.find((t) => t.previewUrl);

  if (!track?.previewUrl) return null;
  return { trackName: track.trackName, previewUrl: track.previewUrl };
}

export async function fetchSpotifyArtistNames(accessToken: string): Promise<Set<string>> {
  const artistNames = new Set<string>();

  const fetches = [
    fetch('https://api.spotify.com/v1/me/top/artists?time_range=short_term&limit=50', {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
    fetch('https://api.spotify.com/v1/me/top/artists?time_range=medium_term&limit=50', {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
    fetch('https://api.spotify.com/v1/me/player/recently-played?limit=50', {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  ];

  const [shortTermRes, mediumTermRes, recentRes] = await Promise.all(fetches);

  for (const res of [shortTermRes, mediumTermRes]) {
    if (res.ok) {
      const data = (await res.json()) as {
        items: Array<{ name: string }>;
      };
      for (const artist of data.items) {
        artistNames.add(artist.name.toLowerCase());
      }
    }
  }

  if (recentRes.ok) {
    const data = (await recentRes.json()) as {
      items: Array<{ track: { artists: Array<{ name: string }> } }>;
    };
    for (const item of data.items) {
      for (const artist of item.track.artists) {
        artistNames.add(artist.name.toLowerCase());
      }
    }
  }

  return artistNames;
}

import pg from 'pg';

const { Pool } = pg;

const pool = process.env['DATABASE_URL']
  ? new Pool({ connectionString: process.env['DATABASE_URL'], ssl: { rejectUnauthorized: false } })
  : null;

export function hasDatabase(): boolean {
  return pool !== null;
}

export async function initDb(): Promise<void> {
  if (!pool) {
    console.log('DATABASE_URL not set — using file-based storage');
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS watched_movies (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      poster_url TEXT,
      release_date TEXT NOT NULL DEFAULT '',
      added_at TEXT NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS spotify_tokens (
      id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      expires_at BIGINT NOT NULL
    )
  `);

  console.log('Database tables initialized');
}

// --- Watched Movies ---

interface WatchedMovie {
  id: number;
  title: string;
  posterUrl: string | null;
  releaseDate: string;
  addedAt: string;
}

export async function dbGetWatchedMovies(): Promise<WatchedMovie[] | null> {
  if (!pool) return null;
  const { rows } = await pool.query('SELECT id, title, poster_url, release_date, added_at FROM watched_movies');
  return rows.map((r: { id: number; title: string; poster_url: string | null; release_date: string; added_at: string }) => ({
    id: r.id,
    title: r.title,
    posterUrl: r.poster_url,
    releaseDate: r.release_date,
    addedAt: r.added_at,
  }));
}

export async function dbInsertWatchedMovie(movie: WatchedMovie): Promise<void> {
  if (!pool) return;
  await pool.query(
    `INSERT INTO watched_movies (id, title, poster_url, release_date, added_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO NOTHING`,
    [movie.id, movie.title, movie.posterUrl, movie.releaseDate, movie.addedAt],
  );
}

export async function dbDeleteWatchedMovie(id: number): Promise<void> {
  if (!pool) return;
  await pool.query('DELETE FROM watched_movies WHERE id = $1', [id]);
}

// --- Spotify Tokens ---

interface SpotifyTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

export async function dbLoadTokens(): Promise<SpotifyTokens | null> {
  if (!pool) return null;
  const { rows } = await pool.query('SELECT access_token, refresh_token, expires_at FROM spotify_tokens WHERE id = 1');
  if (rows.length === 0) return null;
  const r = rows[0] as { access_token: string; refresh_token: string; expires_at: string };
  return { access_token: r.access_token, refresh_token: r.refresh_token, expires_at: Number(r.expires_at) };
}

export async function dbSaveTokens(tokens: SpotifyTokens): Promise<void> {
  if (!pool) return;
  await pool.query(
    `INSERT INTO spotify_tokens (id, access_token, refresh_token, expires_at)
     VALUES (1, $1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET access_token = $1, refresh_token = $2, expires_at = $3`,
    [tokens.access_token, tokens.refresh_token, tokens.expires_at],
  );
}

export async function dbClearTokens(): Promise<void> {
  if (!pool) return;
  await pool.query('DELETE FROM spotify_tokens WHERE id = 1');
}

export async function dbIsAuthenticated(): Promise<boolean | null> {
  if (!pool) return null;
  const tokens = await dbLoadTokens();
  return tokens !== null;
}

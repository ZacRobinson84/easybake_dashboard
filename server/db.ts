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
    CREATE TABLE IF NOT EXISTS watched_items (
      id TEXT NOT NULL,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT NOT NULL DEFAULT '',
      image_url TEXT,
      added_at TEXT NOT NULL,
      PRIMARY KEY (category, id)
    )
  `);

  // Migrate existing watched_movies into watched_items (idempotent)
  await pool.query(`
    INSERT INTO watched_items (id, category, title, subtitle, image_url, added_at)
    SELECT id::TEXT, 'movie', title, COALESCE(release_date, ''), poster_url, added_at
    FROM watched_movies
    ON CONFLICT (category, id) DO NOTHING
  `);

  await pool.query(`
    ALTER TABLE watched_items ADD COLUMN IF NOT EXISTS rating INTEGER DEFAULT NULL
  `);

  await pool.query(`
    ALTER TABLE watched_items ADD COLUMN IF NOT EXISTS director TEXT DEFAULT NULL
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS spotify_tokens (
      id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      expires_at BIGINT NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS dismissed_cards (
      category TEXT NOT NULL,
      item_id TEXT NOT NULL,
      dismissed_at TEXT NOT NULL,
      PRIMARY KEY (category, item_id)
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

// --- Watched Items (unified: movie | tv | album | book) ---

export interface WatchedItem {
  id: string;
  category: string;
  title: string;
  subtitle: string;
  imageUrl: string | null;
  addedAt: string;
  rating: number | null;
  director: string | null;
}

export async function dbGetWatchedItems(category: string): Promise<WatchedItem[] | null> {
  if (!pool) return null;
  const { rows } = await pool.query(
    `SELECT id, category, title, subtitle, image_url, added_at, rating, director FROM watched_items WHERE category = $1
     ORDER BY
       CASE WHEN $1 IN ('movie', 'tv') THEN subtitle END DESC NULLS LAST,
       added_at DESC`,
    [category],
  );
  return rows.map((r: { id: string; category: string; title: string; subtitle: string; image_url: string | null; added_at: string; rating: number | null; director: string | null }) => ({
    id: r.id,
    category: r.category,
    title: r.title,
    subtitle: r.subtitle,
    imageUrl: r.image_url,
    addedAt: r.added_at,
    rating: r.rating ?? null,
    director: r.director ?? null,
  }));
}

export async function dbInsertWatchedItem(item: WatchedItem): Promise<void> {
  if (!pool) return;
  await pool.query(
    `INSERT INTO watched_items (id, category, title, subtitle, image_url, added_at, rating, director)
     VALUES ($1, $2, $3, $4, $5, $6, NULL, $7)
     ON CONFLICT (category, id) DO NOTHING`,
    [item.id, item.category, item.title, item.subtitle, item.imageUrl, item.addedAt, item.director ?? null],
  );
}

export async function dbUpdateWatchedItemRating(category: string, id: string, rating: number | null): Promise<void> {
  if (!pool) return;
  await pool.query(
    'UPDATE watched_items SET rating = $1 WHERE category = $2 AND id = $3',
    [rating, category, id],
  );
}

export async function dbDeleteWatchedItem(category: string, id: string): Promise<void> {
  if (!pool) return;
  await pool.query('DELETE FROM watched_items WHERE category = $1 AND id = $2', [category, id]);
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

// --- Dismissed Cards ---

export async function dbGetDismissedCards(category: string): Promise<string[]> {
  if (!pool) return [];
  const { rows } = await pool.query('SELECT item_id FROM dismissed_cards WHERE category = $1', [category]);
  return rows.map((r: { item_id: string }) => r.item_id);
}

export async function dbDismissCard(category: string, itemId: string): Promise<void> {
  if (!pool) return;
  await pool.query(
    `INSERT INTO dismissed_cards (category, item_id, dismissed_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (category, item_id) DO NOTHING`,
    [category, itemId, new Date().toISOString()],
  );
}

export async function dbIsAuthenticated(): Promise<boolean | null> {
  if (!pool) return null;
  const tokens = await dbLoadTokens();
  return tokens !== null;
}

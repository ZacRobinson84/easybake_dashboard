# EasyBake Dashboard

A personal entertainment dashboard that aggregates upcoming releases and trending content across games, movies, and music into a single interface.

## Tech Stack

**Frontend:** React 19, TypeScript, Tailwind CSS 4, React Router 7, Lucide React (icons), Vite 7

**Backend:** Express 5 (Node.js), TypeScript (via tsx), PostgreSQL (pg), JWT auth with bcryptjs

**External APIs:**
- IGDB (Twitch) + Steam — game releases, reviews, descriptions
- TMDB — movie releases, now playing, director filmography, search
- MusicBrainz + Last.fm — album releases, artist popularity, charts
- Spotify — library integration (OAuth), artist matching, track previews
- OpenWeatherMap — weather forecast

**Deployment:** Vite dev server proxies `/api` to Express on port 3001. Config files for Railway and Vercel are present.

## Project Structure

- `src/` — React frontend (pages: Home, Movies, Music, Gaming; components for layout and cards)
- `server/` — Express API server with per-service modules (igdb, steam, tmdb, musicbrainz, lastfm, spotify, db)
- `data/` — Local JSON fallback storage (watched movies)

## Development

```
npm run dev        # runs both Vite + Express concurrently
npm run build      # tsc + vite build
npm start          # production server
```

## Environment Variables

Requires a `.env` file with: `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `TMDB_API_KEY`, `LASTFM_CLIENT_ID`, `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `OPENWEATHER_API_KEY`, `JWT_SECRET`, `DASHBOARD_PASSWORD_HASH`, and optionally `DATABASE_URL`, `FRONTEND_URL`, `PORT`.

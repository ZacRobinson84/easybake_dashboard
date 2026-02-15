import type { MovieRelease, DirectorFilm } from './types.ts';

function formatDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getReleaseWeek(): { friday: string; weekStart: string } {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
  let diff: number;
  if (day === 6) {
    // Saturday → use yesterday (Friday)
    diff = -1;
  } else if (day === 0) {
    // Sunday → use last Friday
    diff = -2;
  } else {
    // Mon–Fri → use this week's Friday
    diff = 5 - day;
  }
  const friday = new Date(now);
  friday.setDate(friday.getDate() + diff);
  const weekStart = new Date(friday);
  weekStart.setDate(weekStart.getDate() - 6); // Saturday before
  return { friday: formatDate(friday), weekStart: formatDate(weekStart) };
}

interface TMDBMovie {
  id: number;
  title: string;
  poster_path: string | null;
  release_date: string;
  overview: string;
  popularity: number;
  genre_ids: number[];
}

interface TMDBCreditsResponse {
  crew: { id: number; job: string; name: string }[];
  cast: { name: string; order: number }[];
}

export async function fetchUpcomingFridayMovies(apiKey: string): Promise<MovieRelease[]> {
  const { friday, weekStart } = getReleaseWeek();

  const url = new URL('https://api.themoviedb.org/3/discover/movie');
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('primary_release_date.gte', weekStart);
  url.searchParams.set('primary_release_date.lte', friday);
  url.searchParams.set('sort_by', 'popularity.desc');
  url.searchParams.set('region', 'US');
  url.searchParams.set('with_release_type', '2|3'); // theatrical

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`TMDB discover failed: ${res.status}`);
  const data = (await res.json()) as { results: TMDBMovie[] };

  const movies = data.results;

  const creditResults = await Promise.allSettled(
    movies.map(async (movie) => {
      const creditsUrl = `https://api.themoviedb.org/3/movie/${movie.id}/credits?api_key=${apiKey}`;
      const creditsRes = await fetch(creditsUrl);
      if (!creditsRes.ok) return { director: null, directorId: null, cast: [] as string[] };
      const credits = (await creditsRes.json()) as TMDBCreditsResponse;
      const directorEntry = credits.crew.find((c) => c.job === 'Director');
      const director = directorEntry?.name ?? null;
      const directorId = directorEntry?.id ?? null;
      const cast = credits.cast
        .sort((a, b) => a.order - b.order)
        .slice(0, 4)
        .map((c) => c.name);
      return { director, directorId, cast };
    })
  );

  return movies.map((movie, i): MovieRelease => {
    const creditResult = creditResults[i];
    const credits = creditResult?.status === 'fulfilled' ? creditResult.value : { director: null, directorId: null, cast: [] };
    return {
      id: movie.id,
      title: movie.title,
      posterUrl: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
      releaseDate: movie.release_date,
      director: credits.director,
      directorId: credits.directorId,
      cast: credits.cast,
      overview: movie.overview,
      tmdbUrl: `https://www.themoviedb.org/movie/${movie.id}`,
      fridayDate: friday,
      revenue: null,
      isHorror: movie.genre_ids.includes(27),
    };
  });
}

interface TMDBPersonCreditsResponse {
  crew: { title: string; release_date: string; poster_path: string | null; job: string }[];
}

export async function fetchNowPlayingMovies(apiKey: string): Promise<MovieRelease[]> {
  const url = new URL('https://api.themoviedb.org/3/movie/now_playing');
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('region', 'US');

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`TMDB now_playing failed: ${res.status}`);
  const data = (await res.json()) as { results: TMDBMovie[]; total_pages: number };

  const pageFetches = [];
  const maxPages = Math.min(data.total_pages, 10);
  for (let page = 2; page <= maxPages; page++) {
    url.searchParams.set('page', String(page));
    pageFetches.push(fetch(url.toString()).then(r => r.json()));
  }
  const extraPages = await Promise.all(pageFetches);
  const movies = [...data.results, ...extraPages.flatMap((p: any) => p.results)] as TMDBMovie[];

  const detailResults = await Promise.allSettled(
    movies.map(async (movie) => {
      const detailUrl = `https://api.themoviedb.org/3/movie/${movie.id}?api_key=${apiKey}&append_to_response=credits`;
      const detailRes = await fetch(detailUrl);
      if (!detailRes.ok) return { director: null, directorId: null, cast: [] as string[], revenue: null as number | null };
      const detail = (await detailRes.json()) as { revenue?: number; credits?: TMDBCreditsResponse };
      const credits = detail.credits;
      const directorEntry = credits?.crew.find((c) => c.job === 'Director');
      const director = directorEntry?.name ?? null;
      const directorId = directorEntry?.id ?? null;
      const cast = credits?.cast
        .sort((a, b) => a.order - b.order)
        .slice(0, 4)
        .map((c) => c.name) ?? [];
      const revenue = detail.revenue && detail.revenue > 0 ? detail.revenue : null;
      return { director, directorId, cast, revenue };
    })
  );

  const results = movies.map((movie, i): MovieRelease => {
    const detailResult = detailResults[i];
    const detail = detailResult?.status === 'fulfilled' ? detailResult.value : { director: null, directorId: null, cast: [], revenue: null };
    return {
      id: movie.id,
      title: movie.title,
      posterUrl: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
      releaseDate: movie.release_date,
      director: detail.director,
      directorId: detail.directorId,
      cast: detail.cast,
      overview: movie.overview,
      tmdbUrl: `https://www.themoviedb.org/movie/${movie.id}`,
      fridayDate: '',
      revenue: detail.revenue,
      popularity: movie.popularity,
      isHorror: movie.genre_ids.includes(27),
    };
  });

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  results.sort((a, b) => {
    const aOld = new Date(a.releaseDate) < sixMonthsAgo ? 1 : 0;
    const bOld = new Date(b.releaseDate) < sixMonthsAgo ? 1 : 0;
    if (aOld !== bOld) return aOld - bOld;
    return (b.popularity ?? 0) - (a.popularity ?? 0);
  });

  return results;
}

export async function fetchDirectorFilmography(apiKey: string, personId: number): Promise<DirectorFilm[]> {
  const url = `https://api.themoviedb.org/3/person/${personId}/movie_credits?api_key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB person credits failed: ${res.status}`);
  const data = (await res.json()) as TMDBPersonCreditsResponse;

  return data.crew
    .filter((c) => c.job === 'Director')
    .sort((a, b) => (b.release_date ?? '').localeCompare(a.release_date ?? ''))
    .map((c) => ({
      title: c.title,
      year: c.release_date ? c.release_date.slice(0, 4) : '',
      posterUrl: c.poster_path ? `https://image.tmdb.org/t/p/w200${c.poster_path}` : null,
    }));
}

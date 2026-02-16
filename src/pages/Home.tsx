import { useEffect, useState, useRef, useCallback } from 'react';
import { Loader2, MapPin, Film, Search, X } from 'lucide-react';
import { useAuth } from '../AuthContext';

interface ForecastEntry {
  dt: number;
  main: { temp_min: number; temp_max: number };
  weather: { icon: string; description: string }[];
}

interface DaySummary {
  label: string;
  dayName: string;
  high: number;
  low: number;
  icon: string;
  description: string;
}

interface MovieSearchResult {
  id: number;
  title: string;
  posterUrl: string | null;
  releaseDate: string;
}

interface WatchedMovie {
  id: number;
  title: string;
  posterUrl: string | null;
  addedAt: string;
}

const FALLBACK_LAT = 44.98;
const FALLBACK_LON = -64.13;

export default function Home() {
  const { authFetch } = useAuth();
  const [days, setDays] = useState<DaySummary[]>([]);
  const [cityName, setCityName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Watched movies state
  const [watchedMovies, setWatchedMovies] = useState<WatchedMovie[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MovieSearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchWeather = (lat: number, lon: number) => {
      authFetch(`/api/weather/forecast?lat=${lat}&lon=${lon}`)
        .then((res) => {
          if (!res.ok) throw new Error(`Server error: ${res.status}`);
          return res.json();
        })
        .then((data: {
          current: { name: string; main: { temp: number; temp_min: number; temp_max: number }; weather: { icon: string; description: string }[] };
          forecast: { city: { name: string }; list: ForecastEntry[] };
        }) => {
          setCityName(data.current.name);

          const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          const todayDn = dayNames[new Date().getDay()];

          // Today from current weather
          const summaries: DaySummary[] = [{
            label: 'Today',
            dayName: todayDn,
            high: Math.round(data.current.main.temp_max),
            low: Math.round(data.current.main.temp_min),
            icon: data.current.weather[0].icon,
            description: data.current.weather[0].description,
          }];

          // Group forecast entries by local date
          const toLocalDate = (d: Date) =>
            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          const today = toLocalDate(new Date());
          const grouped = new Map<string, ForecastEntry[]>();
          for (const entry of data.forecast.list) {
            const key = toLocalDate(new Date(entry.dt * 1000));
            if (key === today) continue;
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key)!.push(entry);
          }

          for (const [dateKey, entries] of grouped) {
            if (summaries.length >= 5) break;
            const highs = entries.map((e) => e.main.temp_max);
            const lows = entries.map((e) => e.main.temp_min);
            const middayEntry = entries.find((e) => {
              const h = new Date(e.dt * 1000).getHours();
              return h >= 11 && h <= 14;
            }) || entries[Math.floor(entries.length / 2)];

            const date = new Date(dateKey + 'T12:00:00');
            const dn = dayNames[date.getDay()];
            summaries.push({
              label: dn,
              dayName: dn,
              high: Math.round(Math.max(...highs)),
              low: Math.round(Math.min(...lows)),
              icon: middayEntry.weather[0].icon,
              description: middayEntry.weather[0].description,
            });
          }

          setDays(summaries);
          setLoading(false);
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : 'Failed to fetch weather');
          setLoading(false);
        });
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude),
        () => fetchWeather(FALLBACK_LAT, FALLBACK_LON),
        { timeout: 5000 },
      );
    } else {
      fetchWeather(FALLBACK_LAT, FALLBACK_LON);
    }
  }, []);

  // Fetch watched movies on mount
  useEffect(() => {
    authFetch('/api/movies/watched')
      .then((res) => res.json())
      .then(setWatchedMovies)
      .catch(() => {});
  }, [authFetch]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(() => {
      authFetch(`/api/movies/search?q=${encodeURIComponent(q.trim())}`)
        .then((res) => res.json())
        .then((results: MovieSearchResult[]) => {
          setSearchResults(results.slice(0, 8));
          setShowDropdown(true);
          setSearching(false);
        })
        .catch(() => setSearching(false));
    }, 400);
  }, [authFetch]);

  const addMovie = (movie: MovieSearchResult) => {
    authFetch('/api/movies/watched', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: movie.id, title: movie.title, posterUrl: movie.posterUrl, releaseDate: movie.releaseDate }),
    })
      .then((res) => res.json())
      .then(setWatchedMovies)
      .catch(() => {});
    setShowDropdown(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  const removeMovie = (id: number) => {
    authFetch(`/api/movies/watched/${id}`, { method: 'DELETE' })
      .then((res) => res.json())
      .then(setWatchedMovies)
      .catch(() => {});
  };

  const containerStyle = { clipPath: 'polygon(0 0, calc(100% - 2.25rem) 0, 100% 2.25rem, 100% 100%, 0 100%)' };

  return (
    <div className="p-6 md:p-10 space-y-6">
      {/* Weather Widget */}
      <div className="max-w-xl rounded-xl bg-[#BB7044]/15 p-4" style={containerStyle}>
        <div className="mb-3 flex items-center gap-3">
          <div className="flex items-center gap-1.5 shrink-0">
            <MapPin className="h-4 w-4 text-white/50" />
            <h2 className="text-base font-semibold text-white/70 font-nunito-black">
              {cityName || '5-Day Forecast'}
            </h2>
          </div>
          <div className="h-px flex-1 bg-white/15 mr-2" />
        </div>

        {loading && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && days.length === 0 && (
          <div className="py-10 text-center text-gray-500">
            No forecast data available
          </div>
        )}

        {!loading && !error && days.length > 0 && (
          <div className="grid grid-cols-5 gap-1.5 sm:gap-3">
            {days.map((day, i) => {
              const positionColors = [
                'bg-amber-500/15',
                'bg-rose-500/15',
                'bg-sky-500/15',
                'bg-emerald-500/15',
                'bg-indigo-500/15',
              ];
              return (
              <div
                key={day.label}
                className={`flex flex-col items-center rounded-lg p-2 sm:p-3 ${positionColors[i]}`}
              >
                <span className="text-xs font-semibold text-white/70 sm:text-sm">{day.label}</span>
                <img
                  src={`https://openweathermap.org/img/wn/${day.icon}@2x.png`}
                  alt={day.description}
                  className="h-10 w-10 sm:h-12 sm:w-12"
                />
                <span className="text-sm font-bold text-white">{day.high}°</span>
                <span className="text-xs text-white/40">{day.low}°</span>
                <span className="mt-1 text-center text-[10px] leading-tight text-white/50 sm:text-xs">
                  {day.description}
                </span>
              </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Movies Watched Widget */}
      <div className="max-w-2xl rounded-xl bg-[#BB7044]/15 p-4" style={containerStyle}>
        <div className="mb-3 flex items-center gap-3">
          <div className="flex items-center gap-1.5 shrink-0">
            <Film className="h-4 w-4 text-white/50" />
            <h2 className="text-base font-semibold text-white/70 font-nunito-black">
              Movies Watched in 2026
            </h2>
          </div>
          <div className="h-px flex-1 bg-white/15 mr-2" />
        </div>

        {/* Search bar */}
        <div className="relative mb-4" ref={dropdownRef}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search for a movie..."
              className="w-full rounded-lg bg-white/10 py-2 pl-9 pr-3 text-sm text-white placeholder-white/30 outline-none focus:ring-1 focus:ring-white/25"
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-white/40" />
            )}
          </div>

          {/* Search results dropdown */}
          {showDropdown && searchResults.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-lg bg-[#2a1f1a] border border-white/10 shadow-xl max-h-72 overflow-y-auto">
              {searchResults.map((movie) => (
                <button
                  key={movie.id}
                  onClick={() => addMovie(movie)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-white/10 transition-colors"
                >
                  {movie.posterUrl ? (
                    <img src={movie.posterUrl} alt="" className="h-12 w-8 rounded object-cover shrink-0" />
                  ) : (
                    <div className="h-12 w-8 rounded bg-white/10 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="text-sm text-white truncate">{movie.title}</div>
                    <div className="text-xs text-white/40">
                      {movie.releaseDate ? movie.releaseDate.slice(0, 4) : ''}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Poster grid */}
        {watchedMovies.length === 0 ? (
          <div className="py-6 text-center text-sm text-white/30">
            No movies added yet. Search above to add movies you've watched.
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {watchedMovies.map((movie) => (
              <div key={movie.id} className="group relative">
                <button
                  onClick={() => removeMovie(movie.id)}
                  className="absolute right-1 top-1 z-10 hidden group-hover:flex h-5 w-5 items-center justify-center rounded bg-black/15 text-white/30 hover:bg-black/30 hover:text-white/60 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
                {movie.posterUrl ? (
                  <img
                    src={movie.posterUrl}
                    alt={movie.title}
                    className="w-full rounded-lg object-cover aspect-[2/3]"
                  />
                ) : (
                  <div className="w-full rounded-lg bg-white/10 aspect-[2/3] flex items-center justify-center">
                    <Film className="h-8 w-8 text-white/20" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

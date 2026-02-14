import { useEffect, useRef, useState } from 'react';
import { Clapperboard, Loader2 } from 'lucide-react';
import MovieCard from '../components/movies/MovieCard';

interface MovieRelease {
  id: number;
  title: string;
  posterUrl: string | null;
  releaseDate: string;
  director: string | null;
  directorId: number | null;
  cast: string[];
  overview: string;
  tmdbUrl: string;
  fridayDate: string;
  revenue: number | null;
}

type Tab = 'releases' | 'in-theatres';

export default function Movies() {
  const [activeTab, setActiveTab] = useState<Tab>('releases');

  // Releases state
  const [movies, setMovies] = useState<MovieRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fridayLabel, setFridayLabel] = useState('');

  // Now-playing state
  const [nowPlaying, setNowPlaying] = useState<MovieRelease[]>([]);
  const [nowPlayingLoading, setNowPlayingLoading] = useState(false);
  const [nowPlayingError, setNowPlayingError] = useState<string | null>(null);
  const nowPlayingFetched = useRef(false);

  // Swipe tracking
  const touchStartX = useRef(0);

  useEffect(() => {
    fetch('/api/movies/upcoming')
      .then((res) => {
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        return res.json();
      })
      .then((data: MovieRelease[]) => {
        setMovies(data);
        if (data.length > 0 && data[0].fridayDate) {
          const [y, m, d] = data[0].fridayDate.split('-').map(Number);
          const date = new Date(y, m - 1, d);
          setFridayLabel(date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }));
        }
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to fetch movies');
        setLoading(false);
      });
  }, []);

  // Lazy-fetch now-playing on first switch
  useEffect(() => {
    if (activeTab !== 'in-theatres' || nowPlayingFetched.current) return;
    nowPlayingFetched.current = true;
    setNowPlayingLoading(true);
    fetch('/api/movies/now-playing')
      .then((res) => {
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        return res.json();
      })
      .then((data: MovieRelease[]) => {
        setNowPlaying(data);
        setNowPlayingLoading(false);
      })
      .catch((err: unknown) => {
        setNowPlayingError(err instanceof Error ? err.message : 'Failed to fetch now-playing movies');
        setNowPlayingLoading(false);
      });
  }, [activeTab]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      setActiveTab(diff > 0 ? 'in-theatres' : 'releases');
    }
  };

  const currentMovies = activeTab === 'releases' ? movies : nowPlaying;
  const currentLoading = activeTab === 'releases' ? loading : nowPlayingLoading;
  const currentError = activeTab === 'releases' ? error : nowPlayingError;
  const subtitle = activeTab === 'releases' ? fridayLabel : 'Now showing in US theatres';
  const emptyMessage = activeTab === 'releases'
    ? 'No movie releases this Friday'
    : 'No movies currently in theatres';

  return (
    <div
      className="p-6 md:p-10"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <Clapperboard className="h-6 w-6 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold text-white">Movies</h1>
            {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
          </div>
        </div>

        {/* Tab pills */}
        <div className="flex gap-2 sm:ml-auto">
          <button
            onClick={() => setActiveTab('releases')}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors sm:px-4 sm:text-sm ${
              activeTab === 'releases'
                ? 'bg-indigo-600 text-white'
                : 'border border-gray-600 text-gray-400 hover:border-gray-400 hover:text-gray-300'
            }`}
          >
            This Week's Releases
          </button>
          <button
            onClick={() => setActiveTab('in-theatres')}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors sm:px-4 sm:text-sm ${
              activeTab === 'in-theatres'
                ? 'bg-indigo-600 text-white'
                : 'border border-gray-600 text-gray-400 hover:border-gray-400 hover:text-gray-300'
            }`}
          >
            In Theatres Now
          </button>
        </div>
      </div>

      {/* Mobile dot indicators */}
      <div className="mb-4 flex justify-center gap-2 md:hidden">
        <span
          className={`h-2 w-2 rounded-full transition-colors ${
            activeTab === 'releases' ? 'bg-indigo-600' : 'bg-gray-600'
          }`}
        />
        <span
          className={`h-2 w-2 rounded-full transition-colors ${
            activeTab === 'in-theatres' ? 'bg-indigo-600' : 'bg-gray-600'
          }`}
        />
      </div>

      {currentLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      )}

      {currentError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {currentError}
        </div>
      )}

      {!currentLoading && !currentError && currentMovies.length === 0 && (
        <div className="py-20 text-center text-gray-500">
          {emptyMessage}
        </div>
      )}

      {!currentLoading && !currentError && currentMovies.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
          {currentMovies.map((movie) => (
            <MovieCard
              key={movie.id}
              title={movie.title}
              posterUrl={movie.posterUrl}
              director={movie.director}
              directorId={movie.directorId}
              cast={movie.cast}
              tmdbUrl={movie.tmdbUrl}
            />
          ))}
        </div>
      )}
    </div>
  );
}

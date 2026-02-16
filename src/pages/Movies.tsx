import { useEffect, useRef, useState } from 'react';
import { Clapperboard, Loader2, X } from 'lucide-react';
import MovieCard from '../components/movies/MovieCard';
import { useAuth } from '../AuthContext';

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
  isHorror?: boolean;
}

type Tab = 'releases' | 'in-theatres';

export default function Movies() {
  const { authFetch } = useAuth();
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

  const handleDismiss = async (id: number) => {
    if (!window.confirm('Remove this card?')) return;
    try {
      await authFetch(`/api/dismissed/movie/${id}`, { method: 'POST' });
      setMovies((prev) => prev.filter((m) => m.id !== id));
      setNowPlaying((prev) => prev.filter((m) => m.id !== id));
    } catch {}
  };

  // Swipe tracking
  const touchStartX = useRef(0);

  useEffect(() => {
    authFetch('/api/movies/upcoming')
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
    authFetch('/api/movies/now-playing')
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
      <div className="mb-4 flex items-end gap-0">
        <div
          className="inline-block rounded-xl bg-[#BB7044]/15 p-4 pr-10"
          style={{ clipPath: 'polygon(0 0, calc(100% - 2.25rem) 0, 100% 2.25rem, 100% 100%, 0 100%)' }}
        >
          <h1 className="inline-flex items-center gap-2 text-2xl font-bold text-white">
            Movies <Clapperboard className="h-5 w-5 text-indigo-600" />
          </h1>
          {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>
        <div className="h-px flex-1 self-end" style={{ background: 'linear-gradient(to right, rgba(255,255,255,0), rgba(255,255,255,0.28) 3%, rgba(255,255,255,0.28) 97%, rgba(255,255,255,0))' }} />
      </div>

      {/* Tab pills */}
      <div className="mb-6 flex gap-2">
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
            <div key={movie.id} className="group relative h-full">
              <button
                onClick={() => handleDismiss(movie.id)}
                className="absolute right-1 top-1 z-10 hidden group-hover:flex h-5 w-5 items-center justify-center rounded bg-black/15 text-white/30 hover:bg-black/30 hover:text-white/60 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
              <MovieCard
                title={movie.title}
                posterUrl={movie.posterUrl}
                director={movie.director}
                directorId={movie.directorId}
                cast={movie.cast}
                tmdbUrl={movie.tmdbUrl}
                isHorror={movie.isHorror}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

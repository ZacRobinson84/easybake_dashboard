import { useEffect, useState } from 'react';
import { Calendar, Loader2, X } from 'lucide-react';
import GameCard from '../components/gaming/GameCard';
import { useAuth } from '../AuthContext';

interface GameRelease {
  id: number;
  name: string;
  coverUrl: string | null;
  platforms: string[];
  steamAppId: string | null;
  websiteUrl: string | null;
  steamReviews: {
    totalPositive: number;
    totalNegative: number;
    totalReviews: number;
    reviewScoreDesc: string;
  } | null;
  steamDescription: string | null;
}

export default function Gaming() {
  const { authFetch } = useAuth();
  const [games, setGames] = useState<GameRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authFetch('/api/gaming/releases')
      .then((res) => {
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        return res.json();
      })
      .then((data: GameRelease[]) => {
        setGames(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to fetch releases');
        setLoading(false);
      });
  }, []);

  const handleDismiss = async (id: number) => {
    if (!window.confirm('Remove this card?')) return;
    try {
      await authFetch(`/api/dismissed/game/${id}`, { method: 'POST' });
      setGames((prev) => prev.filter((g) => g.id !== id));
    } catch {}
  };

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="p-6 md:p-10">
      <div className="mb-6 flex items-end gap-0">
        <div
          className="inline-block rounded-xl bg-[#BB7044]/15 p-4 pr-10"
          style={{ clipPath: 'polygon(0 0, calc(100% - 2.25rem) 0, 100% 2.25rem, 100% 100%, 0 100%)' }}
        >
          <h1 className="inline-flex items-center gap-2 text-2xl font-bold text-white">
            New Game Releases <Calendar className="h-5 w-5 text-indigo-600" />
          </h1>
          <p className="text-sm text-gray-500">{today}</p>
        </div>
        <div className="h-px flex-1 self-end" style={{ background: 'linear-gradient(to right, rgba(255,255,255,0), rgba(255,255,255,0.28) 3%, rgba(255,255,255,0.28) 97%, rgba(255,255,255,0))' }} />
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && games.length === 0 && (
        <div className="py-20 text-center text-gray-500">
          No releases today
        </div>
      )}

      {!loading && !error && games.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
          {games.map((game) => (
            <div key={game.id} className="group relative h-full">
              <button
                onClick={() => handleDismiss(game.id)}
                className="absolute right-1 top-1 z-10 hidden group-hover:flex h-5 w-5 items-center justify-center rounded bg-black/15 text-white/30 hover:bg-black/30 hover:text-white/60 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
              <GameCard
                name={game.name}
                coverUrl={game.coverUrl}
                platforms={game.platforms}
                steamAppId={game.steamAppId}
                websiteUrl={game.websiteUrl}
                steamReviews={game.steamReviews}
                steamDescription={game.steamDescription}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

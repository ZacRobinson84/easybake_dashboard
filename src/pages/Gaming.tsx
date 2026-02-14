import { useEffect, useState } from 'react';
import { Calendar, Loader2 } from 'lucide-react';
import GameCard from '../components/gaming/GameCard';

interface GameRelease {
  id: number;
  name: string;
  coverUrl: string | null;
  platforms: string[];
  steamAppId: string | null;
  steamReviews: {
    totalPositive: number;
    totalNegative: number;
    totalReviews: number;
    reviewScoreDesc: string;
  } | null;
}

export default function Gaming() {
  const [games, setGames] = useState<GameRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/gaming/releases')
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

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="p-6 md:p-10">
      <div className="mb-6 flex items-center gap-3">
        <Calendar className="h-6 w-6 text-indigo-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Today's Game Releases</h1>
          <p className="text-sm text-gray-500">{today}</p>
        </div>
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
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {games.map((game) => (
            <GameCard
              key={game.id}
              name={game.name}
              coverUrl={game.coverUrl}
              platforms={game.platforms}
              steamAppId={game.steamAppId}
              steamReviews={game.steamReviews}
            />
          ))}
        </div>
      )}
    </div>
  );
}

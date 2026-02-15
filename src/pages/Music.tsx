import { useEffect, useState } from 'react';
import { Music2, Loader2 } from 'lucide-react';
import AlbumCard from '../components/music/AlbumCard';

interface AlbumRelease {
  id: string;
  title: string;
  artist: string;
  coverUrl: string | null;
  releaseDate: string;
  type: string;
  fridayDate: string;
  artistListeners?: number | null;
}

export default function Music() {
  const [albums, setAlbums] = useState<AlbumRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fridayLabel, setFridayLabel] = useState('');

  useEffect(() => {
    fetch('/api/music/upcoming')
      .then((res) => {
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        return res.json();
      })
      .then((data: AlbumRelease[]) => {
        setAlbums(data);
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
        setError(err instanceof Error ? err.message : 'Failed to fetch albums');
        setLoading(false);
      });
  }, []);

  return (
    <div className="p-6 md:p-10">
      <div className="mb-6 flex items-center gap-3">
        <Music2 className="h-6 w-6 text-indigo-600" />
        <div>
          <h1 className="text-2xl font-bold text-white">New Album Releases</h1>
          {fridayLabel && <p className="text-sm text-gray-500">{fridayLabel}</p>}
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

      {!loading && !error && albums.length === 0 && (
        <div className="py-20 text-center text-gray-500">
          No album releases this Friday
        </div>
      )}

      {!loading && !error && albums.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
          {albums.map((album) => (
            <AlbumCard
              key={album.id}
              title={album.title}
              artist={album.artist}
              coverUrl={album.coverUrl}
              type={album.type}
            />
          ))}
        </div>
      )}
    </div>
  );
}

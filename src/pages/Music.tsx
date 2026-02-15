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
  inSpotifyLibrary?: boolean;
  genre?: string;
}

export default function Music() {
  const [albums, setAlbums] = useState<AlbumRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fridayLabel, setFridayLabel] = useState('');
  const [spotifyConnected, setSpotifyConnected] = useState(false);

  useEffect(() => {
    fetch('/api/spotify/status')
      .then((res) => res.json())
      .then((data: { authenticated: boolean }) => setSpotifyConnected(data.authenticated))
      .catch(() => {});
  }, []);

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

  const spotifyAlbums = albums.filter((a) => a.inSpotifyLibrary);
  const otherAlbums = albums.filter((a) => !a.inSpotifyLibrary);

  const genreRenames: Record<string, string> = {
    'atmospheric black metal': 'Atmos Black Metal',
  };
  const capitalize = (s: string) => genreRenames[s.toLowerCase()] ?? s.replace(/\b\w/g, (c) => c.toUpperCase());

  const gridClasses = 'grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10';

  return (
    <div className="p-6 md:p-10">
      <div className="mb-6 flex items-center gap-3">
        <Music2 className="h-6 w-6 text-indigo-600" />
        <div>
          <h1 className="text-2xl font-bold text-white">New Album Releases</h1>
          {fridayLabel && <p className="text-sm text-gray-500">{fridayLabel}</p>}
        </div>
        <div className="ml-auto">
          {!spotifyConnected ? (
            <a
              href="/api/spotify/login"
              className="inline-flex items-center gap-2 rounded-full bg-[#1DB954] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1ed760]"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
              </svg>
              Connect Spotify
            </a>
          ) : (
            <button
              onClick={() => {
                fetch('/api/spotify/logout', { method: 'POST' })
                  .then(() => {
                    setSpotifyConnected(false);
                    window.location.reload();
                  })
                  .catch(() => {});
              }}
              className="inline-flex items-center gap-2 rounded-full bg-gray-700 px-4 py-2 text-sm font-semibold text-gray-300 transition-colors hover:bg-gray-600"
            >
              Disconnect Spotify
            </button>
          )}
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
        <>
          {spotifyAlbums.length > 0 && (
            <div className="mb-8">
              <h2 className="mb-3 inline-block rounded-lg bg-[#8B5E3C] px-4 py-1.5 text-lg font-semibold text-white">From Your Artists</h2>
              <div className={gridClasses}>
                {spotifyAlbums.map((album) => (
                  <AlbumCard
                    key={album.id}
                    title={album.title}
                    artist={album.artist}
                    coverUrl={album.coverUrl}
                    type={album.type}
                  />
                ))}
              </div>
            </div>
          )}

          {otherAlbums.length > 0 && (
            <div>
              {spotifyAlbums.length > 0 && (
                <h2 className="mb-3 inline-block rounded-lg bg-[#8B5E3C] px-4 py-1.5 text-lg font-semibold text-white">All Upcoming</h2>
              )}
              {(() => {
                const genreGroups = new Map<string, AlbumRelease[]>();
                for (const album of otherAlbums) {
                  const genre = album.genre || 'Other';
                  if (genre.toLowerCase() === 'my top songs') continue;
                  if (!genreGroups.has(genre)) genreGroups.set(genre, []);
                  genreGroups.get(genre)!.push(album);
                }
                const genreOrder = [
                  'punk', 'hardcore', 'metal', 'death metal', 'electronic', 'house',
                  'hip hop', 'rap', 'indie', 'indie rock', 'indie pop', 'pop', 'rock',
                  'screamo', 'shoegaze', 'uk rap',
                ];
                const sortedGenres = [...genreGroups.keys()].sort((a, b) => {
                  if (a === 'Other') return 1;
                  if (b === 'Other') return -1;
                  const aIdx = genreOrder.indexOf(a.toLowerCase());
                  const bIdx = genreOrder.indexOf(b.toLowerCase());
                  if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
                  if (aIdx !== -1) return -1;
                  if (bIdx !== -1) return 1;
                  return a.localeCompare(b);
                });
                return (
                  <>
                    {/* Mobile: single full-width grid */}
                    <div className="md:hidden">
                      {sortedGenres.map((genre) => {
                        const albums = genreGroups.get(genre)!;
                        return (
                          <div key={genre} className="mb-6 rounded-xl bg-[#C88B4A]/15 p-4" style={{ clipPath: 'polygon(0 0, calc(100% - 2.25rem) 0, 100% 2.25rem, 100% 100%, 0 100%)' }}>
                            <div className="mb-3 flex items-center gap-3"><h2 className="text-base font-semibold text-[#8B5E3C] shrink-0">{capitalize(genre)}</h2><div className="h-px flex-1 bg-white/15 mr-2" /></div>
                            <div className={gridClasses}>
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
                          </div>
                        );
                      })}
                    </div>
                    {/* Desktop: genres side by side */}
                    <div className="hidden md:flex md:flex-wrap md:gap-x-6">
                      {sortedGenres.map((genre) => {
                        const albums = genreGroups.get(genre)!;
                        return (
                          <div key={genre} className={`mb-6 rounded-xl bg-[#C88B4A]/15 p-4${genre.toLowerCase() === 'other' ? ' w-full' : ''}`} style={{ clipPath: 'polygon(0 0, calc(100% - 2.25rem) 0, 100% 2.25rem, 100% 100%, 0 100%)' }}>
                            <div className="mb-3 flex items-center gap-3"><h2 className="text-base font-semibold text-[#8B5E3C] shrink-0">{capitalize(genre)}</h2><div className="h-px flex-1 bg-white/15 mr-2" /></div>
                            <div className="grid gap-3" style={{ gridTemplateColumns: genre.toLowerCase() === 'other' ? 'repeat(auto-fill, 8rem)' : `repeat(${Math.min(albums.length, 10)}, 8rem)` }}>
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
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </>
      )}
    </div>
  );
}

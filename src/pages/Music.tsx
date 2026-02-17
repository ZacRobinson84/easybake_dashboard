import { useEffect, useState, useRef, useCallback } from 'react';
import { Music2, Loader2, ChevronLeft, ChevronRight, X, Unplug } from 'lucide-react';
import AlbumCard from '../components/music/AlbumCard';
import type { PlaybackState } from '../components/music/AlbumCard';
import { useAuth } from '../AuthContext';

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

interface ChartTrack {
  name: string;
  artist: string;
  playcount: number;
  listeners: number;
  url: string;
  imageUrl: string | null;
}

interface ChartAlbum {
  name: string;
  artist: string;
  url: string;
  imageUrl: string | null;
  genre: string;
  releaseDate: string | null;
}

interface ChartArtist {
  name: string;
  playcount: number;
  listeners: number;
  url: string;
  imageUrl: string | null;
}

interface TopChartsResponse {
  topTracks: ChartTrack[];
  topAlbums: ChartAlbum[];
  topArtists: ChartArtist[];
  topAlbumsByGenre: Record<string, ChartAlbum[]>;
}

type Tab = 'releases' | 'top-charts';

export default function Music() {
  const { authFetch } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('releases');

  // Releases state
  const [albums, setAlbums] = useState<AlbumRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fridayLabel, setFridayLabel] = useState('');
  const [spotifyConnected, setSpotifyConnected] = useState(false);

  // Charts state
  const [charts, setCharts] = useState<TopChartsResponse | null>(null);
  const [chartsLoading, setChartsLoading] = useState(false);
  const [chartsError, setChartsError] = useState<string | null>(null);
  const chartsFetched = useRef(false);
  const [chartListIndex, setChartListIndex] = useState(0);

  // Swipe tracking
  const touchStartX = useRef(0);

  // Audio playback state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentArtist, setCurrentArtist] = useState<string | null>(null);
  const [artistStates, setArtistStates] = useState<Map<string, PlaybackState>>(new Map());

  const getPlaybackState = useCallback(
    (artist: string): PlaybackState => artistStates.get(artist) ?? 'idle',
    [artistStates],
  );

  const setArtistState = useCallback((artist: string, state: PlaybackState) => {
    setArtistStates((prev) => {
      const next = new Map(prev);
      if (state === 'idle') {
        next.delete(artist);
      } else {
        next.set(artist, state);
      }
      return next;
    });
  }, []);

  const handleTogglePlay = useCallback(async (artist: string) => {
    if (currentArtist === artist) {
      const audio = audioRef.current;
      if (audio) {
        if (audio.paused) {
          audio.play();
          setArtistState(artist, 'playing');
        } else {
          audio.pause();
          setArtistState(artist, 'idle');
          setCurrentArtist(null);
        }
      }
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    if (currentArtist) {
      setArtistState(currentArtist, 'idle');
    }

    setCurrentArtist(artist);
    setArtistState(artist, 'loading');

    try {
      const res = await authFetch(`/api/spotify/preview?artist=${encodeURIComponent(artist)}`);
      const data = await res.json() as { trackName?: string; previewUrl?: string; error?: string };

      if (!data.previewUrl) {
        setArtistState(artist, 'no-preview');
        setCurrentArtist(null);
        setTimeout(() => setArtistState(artist, 'idle'), 2000);
        return;
      }

      const audio = new Audio(data.previewUrl);
      audioRef.current = audio;

      audio.addEventListener('ended', () => {
        setArtistState(artist, 'idle');
        setCurrentArtist(null);
      });

      await audio.play();
      setArtistState(artist, 'playing');
    } catch {
      setArtistState(artist, 'no-preview');
      setCurrentArtist(null);
      setTimeout(() => setArtistState(artist, 'idle'), 2000);
    }
  }, [currentArtist, setArtistState, authFetch]);

  useEffect(() => {
    authFetch('/api/spotify/status')
      .then((res) => res.json())
      .then((data: { authenticated: boolean }) => setSpotifyConnected(data.authenticated))
      .catch(() => {});
  }, [authFetch]);

  const handleDismiss = async (id: string) => {
    if (!window.confirm('Remove this card?')) return;
    try {
      await authFetch(`/api/dismissed/album/${id}`, { method: 'POST' });
      setAlbums((prev) => prev.filter((a) => a.id !== id));
    } catch {}
  };

  useEffect(() => {
    authFetch('/api/music/upcoming')
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

  // Lazy-fetch charts on first switch
  useEffect(() => {
    if (activeTab !== 'top-charts' || chartsFetched.current) return;
    chartsFetched.current = true;
    setChartsLoading(true);
    authFetch('/api/music/charts')
      .then((res) => {
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        return res.json();
      })
      .then((data: TopChartsResponse) => {
        setCharts(data);
        setChartsLoading(false);
      })
      .catch((err: unknown) => {
        setChartsError(err instanceof Error ? err.message : 'Failed to fetch charts');
        setChartsLoading(false);
      });
  }, [activeTab]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      setActiveTab(diff > 0 ? 'top-charts' : 'releases');
    }
  };

  const spotifyAlbums = albums.filter((a) => a.inSpotifyLibrary);
  const otherAlbums = albums.filter((a) => !a.inSpotifyLibrary);

  const genreRenames: Record<string, string> = {
    'atmospheric black metal': 'Atmos Black Metal',
  };
  const capitalize = (s: string) => genreRenames[s.toLowerCase()] ?? s.replace(/\b\w/g, (c) => c.toUpperCase());

  const gridClasses = 'grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10';

  const renderAlbumCard = (album: AlbumRelease) => (
    <div key={album.id} className="group relative h-full">
      <button
        onClick={() => handleDismiss(album.id)}
        className="absolute right-1 top-1 z-10 hidden group-hover:flex h-5 w-5 items-center justify-center rounded bg-black/15 text-white/30 hover:bg-black/30 hover:text-white/60 transition-colors"
      >
        <X className="h-3 w-3" />
      </button>
      <AlbumCard
        title={album.title}
        artist={album.artist}
        coverUrl={album.coverUrl}
        type={album.type}
        playbackState={getPlaybackState(album.artist)}
        onTogglePlay={handleTogglePlay}
      />
    </div>
  );

  const formatPlaycount = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return String(n);
  };

  const currentLoading = activeTab === 'releases' ? loading : chartsLoading;
  const currentError = activeTab === 'releases' ? error : chartsError;
  const subtitle = activeTab === 'releases' ? fridayLabel : 'Most popular on Last.fm';

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
            {activeTab === 'releases' ? 'New Album Releases' : 'Top Charts'} <Music2 className="h-5 w-5 text-indigo-600" />
          </h1>
          {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>
        <div className="h-px flex-1 self-end" style={{ background: 'linear-gradient(to right, rgba(255,255,255,0), rgba(255,255,255,0.28) 3%, rgba(255,255,255,0.28) 97%, rgba(255,255,255,0))' }} />
      </div>

      {/* Tab pills + Spotify button */}
      <div className="mb-6 flex items-center gap-2">
        <button
          onClick={() => setActiveTab('releases')}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors sm:px-4 sm:text-sm ${
            activeTab === 'releases'
              ? 'bg-indigo-600 text-white'
              : 'border border-gray-600 text-gray-400 hover:border-gray-400 hover:text-gray-300'
          }`}
        >
          New Releases
        </button>
        <button
          onClick={() => setActiveTab('top-charts')}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors sm:px-4 sm:text-sm ${
            activeTab === 'top-charts'
              ? 'bg-indigo-600 text-white'
              : 'border border-gray-600 text-gray-400 hover:border-gray-400 hover:text-gray-300'
          }`}
        >
          Top Charts
        </button>
        {activeTab === 'releases' && (
          <>
            {!spotifyConnected ? (
              <a
                href="/api/spotify/login"
                title="Connect Spotify"
                className="ml-2 rounded-full bg-[#1DB954] p-1.5 text-white transition-colors hover:bg-[#1ed760]"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                </svg>
              </a>
            ) : (
              <button
                onClick={() => {
                  authFetch('/api/spotify/logout', { method: 'POST' })
                    .then(() => {
                      setSpotifyConnected(false);
                      window.location.reload();
                    })
                    .catch(() => {});
                }}
                title="Disconnect Spotify"
                className="ml-2 rounded-full bg-gray-700 p-1.5 text-gray-400 transition-colors hover:bg-gray-600 hover:text-gray-300"
              >
                <Unplug className="h-4 w-4" />
              </button>
            )}
          </>
        )}
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
            activeTab === 'top-charts' ? 'bg-indigo-600' : 'bg-gray-600'
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

      {/* === Releases Tab === */}
      {activeTab === 'releases' && !loading && !error && albums.length === 0 && (
        <div className="py-20 text-center text-gray-500">
          No album releases this Friday
        </div>
      )}

      {activeTab === 'releases' && !loading && !error && albums.length > 0 && (
        <>
          {spotifyAlbums.length > 0 && (
            <div className="mb-8">
              <h2 className="mb-3 inline-block rounded-lg bg-indigo-600/70 px-4 py-1.5 text-lg font-semibold text-white">From Your Artists</h2>
              <div className={gridClasses}>
                {spotifyAlbums.map(renderAlbumCard)}
              </div>
            </div>
          )}

          {otherAlbums.length > 0 && (
            <div>
              {spotifyAlbums.length > 0 && (
                <h2 className="mb-3 inline-block rounded-lg bg-indigo-600/70 px-4 py-1.5 text-lg font-semibold text-white">All Upcoming</h2>
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
                        const genreAlbums = genreGroups.get(genre)!;
                        return (
                          <div key={genre} className="mb-6 rounded-xl bg-[#BB7044]/15 p-4" style={{ clipPath: 'polygon(0 0, calc(100% - 2.25rem) 0, 100% 2.25rem, 100% 100%, 0 100%)' }}>
                            <div className="mb-3 flex items-center gap-3"><h2 className="text-base font-semibold text-white/70 shrink-0 font-nunito-black">{capitalize(genre)}</h2><div className="h-px flex-1 bg-white/15 mr-2" /></div>
                            <div className={gridClasses}>
                              {genreAlbums.map(renderAlbumCard)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {/* Desktop: genres side by side */}
                    <div className="hidden md:flex md:flex-wrap md:gap-x-6">
                      {sortedGenres.map((genre) => {
                        const genreAlbums = genreGroups.get(genre)!;
                        return (
                          <div key={genre} className={`mb-6 rounded-xl bg-[#BB7044]/15 p-4${genre.toLowerCase() === 'other' ? ' w-full' : ''}`} style={{ clipPath: 'polygon(0 0, calc(100% - 2.25rem) 0, 100% 2.25rem, 100% 100%, 0 100%)' }}>
                            <div className="mb-3 flex items-center gap-3"><h2 className="text-base font-semibold text-white/70 shrink-0 font-nunito-black">{capitalize(genre)}</h2><div className="h-px flex-1 bg-white/15 mr-2" /></div>
                            <div className="grid gap-3" style={{ gridTemplateColumns: genre.toLowerCase() === 'other' ? 'repeat(auto-fill, 8rem)' : `repeat(${Math.min(genreAlbums.length, 10)}, 8rem)` }}>
                              {genreAlbums.map(renderAlbumCard)}
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

      {/* === Top Charts Tab === */}
      {activeTab === 'top-charts' && !chartsLoading && !chartsError && charts && (() => {
        const chartListTitles = ['Top 20 Songs', 'Top 20 Albums', 'Top 20 Artists'];

        const formatAlbumDate = (dateStr: string | null) => {
          if (!dateStr) return '';
          const [y, m, d] = dateStr.split('-').map(Number);
          const date = new Date(y, m - 1, d);
          return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        };

        const renderChartRow = (rank: number, imageUrl: string | null, primary: string, secondary: string | null, stat: string) => (
          <div
            className="grid items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-white/5 transition-colors"
            style={{ gridTemplateColumns: '1.5rem 2.25rem 1fr auto' }}
          >
            <span className="text-right text-sm font-bold text-white/40">{rank}</span>
            {imageUrl ? (
              <img src={imageUrl} alt="" className="h-9 w-9 rounded object-cover" />
            ) : (
              <div className="h-9 w-9 rounded bg-white/10 flex items-center justify-center">
                <Music2 className="h-4 w-4 text-white/30" />
              </div>
            )}
            <div className="min-w-0 flex items-center gap-3">
              <div className="min-w-0 shrink">
                <p className="truncate text-sm font-medium text-white">{primary}</p>
                {secondary && <p className="truncate text-xs text-gray-400">{secondary}</p>}
              </div>
              <div className="flex-1 border-b border-dotted border-white/30 min-w-3 self-center" />
            </div>
            <span className="text-right text-xs text-gray-500 whitespace-nowrap">{stat}</span>
          </div>
        );

        const renderSongsList = () => (
          <div className="space-y-1">
            {charts.topTracks.map((track, i) => renderChartRow(i + 1, track.imageUrl, track.name, track.artist, `${formatPlaycount(track.playcount)} plays`))}
          </div>
        );

        const renderAlbumsList = () => (
          <div className="space-y-1">
            {charts.topAlbums.map((album, i) => renderChartRow(i + 1, album.imageUrl, album.name, album.artist, formatAlbumDate(album.releaseDate)))}
          </div>
        );

        const renderArtistsList = () => (
          <div className="space-y-1">
            {charts.topArtists.map((artist, i) => renderChartRow(i + 1, artist.imageUrl, artist.name, null, `${formatPlaycount(artist.listeners)} listeners`))}
          </div>
        );

        const chartLists = [renderSongsList, renderAlbumsList, renderArtistsList];

        const containerStyle = { clipPath: 'polygon(0 0, calc(100% - 2.25rem) 0, 100% 2.25rem, 100% 100%, 0 100%)' };

        return (
          <>
            {/* Desktop: 3-column grid */}
            <div className="hidden md:grid md:grid-cols-3 md:gap-6 mb-8">
              {chartListTitles.map((title, idx) => (
                <div key={title} className="rounded-xl bg-[#BB7044]/15 p-4" style={containerStyle}>
                  <div className="mb-3 flex items-center gap-3">
                    <h2 className="text-base font-semibold text-white/70 shrink-0 font-nunito-black">{title}</h2>
                    <div className="h-px flex-1 bg-white/15 mr-2" />
                  </div>
                  {chartLists[idx]()}
                </div>
              ))}
            </div>

            {/* Mobile: carousel */}
            <div className="md:hidden mb-8">
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => setChartListIndex((i) => Math.max(0, i - 1))}
                  disabled={chartListIndex === 0}
                  className="text-white/50 hover:text-white/80 disabled:opacity-30 transition-colors p-1"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="text-sm font-semibold text-white/70">{chartListTitles[chartListIndex]}</span>
                <button
                  onClick={() => setChartListIndex((i) => Math.min(2, i + 1))}
                  disabled={chartListIndex === 2}
                  className="text-white/50 hover:text-white/80 disabled:opacity-30 transition-colors p-1"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
              <div className="rounded-xl bg-[#BB7044]/15 p-4" style={containerStyle}>
                {chartLists[chartListIndex]()}
              </div>
              <div className="flex justify-center gap-2 mt-3">
                {[0, 1, 2].map((idx) => (
                  <span
                    key={idx}
                    className={`h-2 w-2 rounded-full transition-colors ${chartListIndex === idx ? 'bg-indigo-600' : 'bg-gray-600'}`}
                  />
                ))}
              </div>
            </div>

            {/* Top Albums by Genre */}
            {Object.keys(charts.topAlbumsByGenre).length > 0 && (
              <>
                {/* Mobile: stacked */}
                <div className="md:hidden">
                  {Object.entries(charts.topAlbumsByGenre).map(([genre, genreAlbums]) => (
                    <div key={genre} className="mb-6 rounded-xl bg-[#BB7044]/15 p-4" style={containerStyle}>
                      <div className="mb-3 flex items-center gap-3">
                        <h2 className="text-base font-semibold text-white/70 shrink-0 font-nunito-black">{capitalize(genre)}</h2>
                        <div className="h-px flex-1 bg-white/15 mr-2" />
                      </div>
                      <div className={gridClasses}>
                        {genreAlbums.map((album) => (
                          <AlbumCard
                            key={`${album.name}-${album.artist}`}
                            title={album.name}
                            artist={album.artist}
                            coverUrl={album.imageUrl}
                            type=""
                            playbackState={getPlaybackState(album.artist)}
                            onTogglePlay={handleTogglePlay}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Desktop: side by side */}
                <div className="hidden md:flex md:flex-wrap md:gap-x-6">
                  {Object.entries(charts.topAlbumsByGenre).map(([genre, genreAlbums]) => (
                    <div key={genre} className="mb-6 rounded-xl bg-[#BB7044]/15 p-4" style={containerStyle}>
                      <div className="mb-3 flex items-center gap-3">
                        <h2 className="text-base font-semibold text-white/70 shrink-0 font-nunito-black">{capitalize(genre)}</h2>
                        <div className="h-px flex-1 bg-white/15 mr-2" />
                      </div>
                      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(genreAlbums.length, 10)}, 8rem)` }}>
                        {genreAlbums.map((album) => (
                          <AlbumCard
                            key={`${album.name}-${album.artist}`}
                            title={album.name}
                            artist={album.artist}
                            coverUrl={album.imageUrl}
                            type=""
                            playbackState={getPlaybackState(album.artist)}
                            onTogglePlay={handleTogglePlay}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        );
      })()}
    </div>
  );
}

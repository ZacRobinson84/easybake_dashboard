import { useEffect, useState, useRef, useCallback } from 'react';
import { Film, Tv, Music, BookOpen, Search, X, Loader2 } from 'lucide-react';
import ColorThief from 'colorthief';
import { useAuth } from '../../AuthContext';

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

interface WatchedItem {
  id: string;
  category: string;
  title: string;
  subtitle: string;
  imageUrl: string | null;
  addedAt: string;
}

interface SearchResult {
  id: string | number;
  title: string;
  subtitle: string;
  imageUrl: string | null;
  releaseDate?: string;
}

type TabKey = 'movie' | 'tv' | 'album' | 'book';

const TABS: {
  key: TabKey;
  label: string;
  searchEndpoint: string;
  Icon: typeof Film;
  aspect: string;
}[] = [
  { key: 'movie',  label: 'Movies',  searchEndpoint: '/api/movies/search', Icon: Film,     aspect: 'aspect-[2/3]' },
  { key: 'tv',     label: 'Television', searchEndpoint: '/api/tv/search',  Icon: Tv,       aspect: 'aspect-[2/3]' },
  { key: 'album',  label: 'Music',   searchEndpoint: '/api/albums/search', Icon: Music,    aspect: 'aspect-square' },
  { key: 'book',   label: 'Books',   searchEndpoint: '/api/books/search',  Icon: BookOpen, aspect: 'aspect-[2/3]' },
];

function normalizeSearchResult(raw: Record<string, unknown>, tab: TabKey): SearchResult {
  // Movies from TMDB search return { id: number, title, posterUrl, releaseDate }
  // TV returns { id: number, title, subtitle, imageUrl, releaseDate }
  // Albums return { id: string, title, subtitle, imageUrl }
  // Books return { id: string, title, subtitle, imageUrl, releaseDate }
  if (tab === 'movie') {
    return {
      id: raw['id'] as number,
      title: (raw['title'] as string) ?? '',
      subtitle: raw['releaseDate'] ? String(raw['releaseDate']).slice(0, 4) : '',
      imageUrl: (raw['posterUrl'] as string | null) ?? null,
      releaseDate: (raw['releaseDate'] as string) ?? '',
    };
  }
  return {
    id: raw['id'] as string,
    title: (raw['title'] as string) ?? '',
    subtitle: (raw['subtitle'] as string) ?? '',
    imageUrl: (raw['imageUrl'] as string | null) ?? null,
    releaseDate: (raw['releaseDate'] as string) ?? '',
  };
}

function WatchedAlbumCard({ item, onRemove }: { item: WatchedItem; onRemove: () => void }) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [gradientStyle, setGradientStyle] = useState<React.CSSProperties | undefined>(undefined);

  const handleImageLoad = () => {
    const img = imgRef.current;
    if (!img) return;
    try {
      const colorThief = new ColorThief();
      const [r, g, b] = colorThief.getColor(img);
      const [h, s] = rgbToHsl(r, g, b);
      const [r1, g1, b1] = hslToRgb(h, Math.min(s, 0.5), 0.74);
      const [r2, g2, b2] = hslToRgb(h, Math.min(s, 0.6), 0.60);
      setGradientStyle({ background: `linear-gradient(to top, rgb(${r1},${g1},${b1}), rgb(${r2},${g2},${b2}))` });
    } catch { /* fallback: no gradient */ }
  };

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-lg">
      <button
        onClick={onRemove}
        className="absolute right-1 top-1 z-10 hidden group-hover:flex h-5 w-5 items-center justify-center rounded bg-black/15 text-white/30 hover:bg-black/30 hover:text-white/60 transition-colors"
      >
        <X className="h-3 w-3" />
      </button>
      <div className="aspect-square overflow-hidden rounded-t-lg bg-white/10">
        {item.imageUrl ? (
          <img
            ref={imgRef}
            src={item.imageUrl}
            alt={item.title}
            crossOrigin="anonymous"
            onLoad={handleImageLoad}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Music className="h-8 w-8 text-white/20" />
          </div>
        )}
      </div>
      <div className="rounded-b-lg p-2" style={gradientStyle ?? { background: 'rgba(255,255,255,0.08)' }}>
        <p className="text-xs font-semibold text-white line-clamp-1">{item.title}</p>
        <p className="text-[10px] text-white/70 line-clamp-1">{item.subtitle}</p>
      </div>
    </div>
  );
}

export default function WatchedItemsWidget() {
  const { authFetch } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('movie');

  // Per-tab state: items, search
  const [items, setItems] = useState<Record<TabKey, WatchedItem[] | null>>({
    movie: null, tv: null, album: null, book: null,
  });
  const [fetched, setFetched] = useState<Record<TabKey, boolean>>({
    movie: false, tv: false, album: false, book: false,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch items for a tab (lazy)
  const fetchItems = useCallback((tab: TabKey) => {
    authFetch(`/api/watched/${tab}`)
      .then((res) => res.json())
      .then((data: WatchedItem[]) => {
        setItems((prev) => ({ ...prev, [tab]: data }));
        setFetched((prev) => ({ ...prev, [tab]: true }));
      })
      .catch(() => {
        setFetched((prev) => ({ ...prev, [tab]: true }));
      });
  }, [authFetch]);

  // Load initial tab on mount
  useEffect(() => {
    fetchItems('movie');
  }, [fetchItems]);

  // Switch tab
  const handleTabSwitch = (tab: TabKey) => {
    setActiveTab(tab);
    setSearchQuery('');
    setSearchResults([]);
    setShowDropdown(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!fetched[tab]) {
      fetchItems(tab);
    }
  };

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

  const tab = TABS.find((t) => t.key === activeTab)!;
  const currentItems = items[activeTab];

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
      authFetch(`${tab.searchEndpoint}?q=${encodeURIComponent(q.trim())}`)
        .then((res) => res.json())
        .then((results: Record<string, unknown>[]) => {
          setSearchResults(results.slice(0, 8).map((r) => normalizeSearchResult(r, activeTab)));
          setShowDropdown(true);
          setSearching(false);
        })
        .catch(() => setSearching(false));
    }, 400);
  }, [authFetch, tab.searchEndpoint, activeTab]);

  const addItem = (result: SearchResult) => {
    authFetch(`/api/watched/${activeTab}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: String(result.id),
        title: result.title,
        subtitle: result.subtitle,
        imageUrl: result.imageUrl,
      }),
    })
      .then((res) => res.json())
      .then((data: WatchedItem[]) => setItems((prev) => ({ ...prev, [activeTab]: data })))
      .catch(() => {});
    setShowDropdown(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  const removeItem = (id: string) => {
    authFetch(`/api/watched/${activeTab}/${encodeURIComponent(id)}`, { method: 'DELETE' })
      .then((res) => res.json())
      .then((data: WatchedItem[]) => setItems((prev) => ({ ...prev, [activeTab]: data })))
      .catch(() => {});
  };

  const containerStyle = { clipPath: 'polygon(0 0, calc(100% - 2.25rem) 0, 100% 2.25rem, 100% 100%, 0 100%)' };

  return (
    <div className="max-w-2xl rounded-xl bg-[#BB7044]/15 p-4" style={containerStyle}>
      {/* Header */}
      <div className="mb-3 flex items-center gap-3">
        <div className="flex items-center gap-1.5 shrink-0">
          <tab.Icon className="h-4 w-4 text-white/50" />
          <h2 className="text-base font-semibold text-white/70 font-nunito-black">
            Media Log 2026
          </h2>
        </div>
        <div className="h-px flex-1 bg-white/15 mr-2" />
      </div>

      {/* Folder tabs */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handleTabSwitch(key)}
            className={`rounded px-3 py-1 text-xs font-medium transition-colors sm:px-4 sm:text-sm ${
              activeTab === key
                ? 'bg-[#BB7044]/30 text-white/80'
                : 'bg-black/30 text-white/35 hover:bg-black/20 hover:text-white/55'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Search bar */}
      <div className="relative mb-4" ref={dropdownRef}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder={`Search for ${tab.key === 'album' ? 'an album' : `a ${tab.label.toLowerCase().replace('t.v.', 'TV show')}`}...`}
            className="w-full rounded-lg bg-white/10 py-2 pl-9 pr-3 text-sm text-white placeholder-white/30 outline-none focus:ring-1 focus:ring-white/25"
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-white/40" />
          )}
        </div>

        {/* Search results dropdown */}
        {showDropdown && searchResults.length > 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-lg bg-[#2a1f1a] border border-white/10 shadow-xl max-h-72 overflow-y-auto">
            {searchResults.map((result) => (
              <button
                key={String(result.id)}
                onClick={() => addItem(result)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-white/10 transition-colors"
              >
                {result.imageUrl ? (
                  <img
                    src={result.imageUrl}
                    alt=""
                    className={`h-12 rounded object-cover shrink-0 ${tab.aspect === 'aspect-square' ? 'w-12' : 'w-8'}`}
                  />
                ) : (
                  <div className={`h-12 rounded bg-white/10 shrink-0 ${tab.aspect === 'aspect-square' ? 'w-12' : 'w-8'}`} />
                )}
                <div className="min-w-0">
                  <div className="text-sm text-white truncate">{result.title}</div>
                  <div className="text-xs text-white/40">{result.subtitle}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Loading */}
      {!fetched[activeTab] && (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
        </div>
      )}

      {/* Empty state */}
      {fetched[activeTab] && (!currentItems || currentItems.length === 0) && (
        <div className="py-6 text-center text-sm text-white/30">
          Nothing logged yet. Search above to add some.
        </div>
      )}

      {/* Art grid */}
      {fetched[activeTab] && currentItems && currentItems.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {currentItems.map((item) =>
            activeTab === 'album' ? (
              <WatchedAlbumCard key={item.id} item={item} onRemove={() => removeItem(item.id)} />
            ) : (
              <div key={item.id} className="group relative">
                <button
                  onClick={() => removeItem(item.id)}
                  className="absolute right-1 top-1 z-10 hidden group-hover:flex h-5 w-5 items-center justify-center rounded bg-black/15 text-white/30 hover:bg-black/30 hover:text-white/60 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    title={item.title}
                    className={`w-full rounded-lg object-cover ${tab.aspect}`}
                  />
                ) : (
                  <div className={`w-full rounded-lg bg-white/10 flex items-center justify-center ${tab.aspect}`}>
                    <tab.Icon className="h-8 w-8 text-white/20" />
                  </div>
                )}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

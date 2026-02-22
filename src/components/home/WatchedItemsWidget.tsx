import { useEffect, useState, useRef, useCallback } from 'react';
import { Film, Tv, Music, BookOpen, Search, X, Loader2, Star } from 'lucide-react';
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
  rating?: number | null;
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
      subtitle: (raw['releaseDate'] as string) ?? '',
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

function StarRating({ savedRating, onRate }: { savedRating: number | null | undefined; onRate: (r: number) => void }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const locked = savedRating != null;
  const display = locked ? savedRating : (hovered ?? 0);

  if (locked) {
    return (
      <div className="absolute inset-x-0 bottom-0 z-[5] hidden group-hover:flex items-center justify-center gap-px py-1 bg-black/40 rounded-b-lg">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star key={n} className={`h-3 w-3 ${n <= display ? 'text-yellow-400 fill-yellow-400' : 'text-white/40'}`} />
        ))}
      </div>
    );
  }

  return (
    <div className="absolute inset-x-0 bottom-0 z-[5] hidden group-hover:flex items-center justify-center gap-px py-1 bg-black/40 rounded-b-lg">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          onClick={(e) => { e.stopPropagation(); onRate(n); }}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(null)}
          className="p-0.5"
        >
          <Star
            className={`h-3 w-3 transition-colors ${n <= display ? 'text-yellow-400 fill-yellow-400' : 'text-white/40'}`}
          />
        </button>
      ))}
    </div>
  );
}

function ItemBottomSheet({
  item,
  tab,
  onRate,
  onRemove,
  onClose,
}: {
  item: WatchedItem;
  tab: typeof TABS[number];
  onRate: (r: number) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const locked = item.rating != null;
  const [hovered, setHovered] = useState<number | null>(null);
  const [visible, setVisible] = useState(false);
  const display = locked ? item.rating! : (hovered ?? 0);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  return (
    <div
      className={`absolute inset-0 z-20 bg-[#2a1f1a]/60 rounded-xl shadow-xl backdrop-blur-sm transition-opacity duration-200 flex flex-col items-center justify-center gap-4 px-5 py-5 ${visible ? 'opacity-100' : 'opacity-0'}`}
    >
      {/* Close button — floats just above the artwork, right-aligned */}
      <div className="w-full flex justify-end shrink-0">
        <button
          onClick={onClose}
          className="h-7 w-7 flex items-center justify-center rounded-full bg-white/10 text-white/50 hover:bg-white/20"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Artwork — desired size, shrinks when card is short */}
      <div className={`shrink min-h-0 flex items-center justify-center ${tab.aspect === 'aspect-square' ? 'h-56' : 'h-60'}`}>
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.title}
            className={`h-full w-auto rounded-lg shadow-lg ${tab.aspect === 'aspect-square' ? 'max-w-56' : 'max-w-40'}`}
          />
        ) : (
          <div className={`h-full rounded-lg bg-white/10 flex items-center justify-center ${tab.aspect === 'aspect-square' ? 'aspect-square' : 'aspect-[2/3]'}`}>
            <tab.Icon className="h-16 w-16 text-white/20" />
          </div>
        )}
      </div>

      {/* Title / subtitle */}
      <div className="text-center shrink-0">
        <p className="text-sm font-semibold text-white leading-tight">{item.title}</p>
        <p className="text-xs text-white/50">{item.subtitle}</p>
      </div>

      {/* Stars */}
      <div className="flex items-center gap-2 shrink-0">
        {[1, 2, 3, 4, 5].map((n) =>
          locked ? (
            <Star
              key={n}
              className={`h-7 w-7 ${n <= display ? 'text-yellow-400 fill-yellow-400' : 'text-white/25'}`}
            />
          ) : (
            <button
              key={n}
              onMouseEnter={() => setHovered(n)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onRate(n)}
              className="p-0.5"
            >
              <Star
                className={`h-7 w-7 transition-colors ${n <= display ? 'text-yellow-400 fill-yellow-400' : 'text-white/25'}`}
              />
            </button>
          )
        )}
        {locked && <span className="ml-1 text-xs text-white/40">Rated</span>}
      </div>

      {/* Remove button */}
      <button
        onClick={() => { onRemove(); onClose(); }}
        className="shrink-0 text-sm text-red-400/80 hover:text-red-400 transition-colors"
      >
        Remove from log
      </button>
    </div>
  );
}

function WatchedAlbumCard({ item, onRemove, onRate, onTap }: { item: WatchedItem; onRemove: () => void; onRate: (r: number) => void; onTap: () => void }) {
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
    <div className="group relative flex flex-col overflow-hidden rounded-lg" onClick={(e) => { if ((e.nativeEvent as PointerEvent).pointerType === 'touch') onTap(); }}>
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="absolute right-1 top-1 z-10 hidden group-hover:flex h-5 w-5 items-center justify-center rounded bg-black/15 text-white/30 hover:bg-black/30 hover:text-white/60 transition-colors"
      >
        <X className="h-3 w-3" />
      </button>
      <div className="relative aspect-square overflow-hidden rounded-t-lg bg-white/10">
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
        <StarRating savedRating={item.rating} onRate={onRate} />
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
  const [sheetItemId, setSheetItemId] = useState<string | null>(null);

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
  const sheetItem = sheetItemId ? (currentItems?.find(i => i.id === sheetItemId) ?? null) : null;

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

  const rateItem = (id: string, rating: number) => {
    authFetch(`/api/watched/${activeTab}/${encodeURIComponent(id)}/rating`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating }),
    })
      .then((res) => res.json())
      .then((data: WatchedItem[]) => setItems((prev) => ({ ...prev, [activeTab]: data })))
      .catch(() => {});
  };

  const containerStyle = { clipPath: 'polygon(0 0, calc(100% - 2.25rem) 0, 100% 2.25rem, 100% 100%, 0 100%)' };

  return (
    <div className="relative max-w-2xl">
    <div className="rounded-xl bg-[#BB7044]/15 p-4" style={containerStyle}>
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
            className={`cursor-pointer rounded px-3 py-2 text-sm font-medium transition-colors sm:px-4 ${
              activeTab === key
                ? 'bg-[#BB7044]/30 text-white/80'
                : 'bg-black/10 text-white/30 hover:bg-black/20 hover:text-white/50'
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
            placeholder={`Search for ${{ movie: 'a movie', tv: 'a TV show', album: 'an album', book: 'a book' }[tab.key]}...`}
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
              <WatchedAlbumCard key={item.id} item={item} onRemove={() => removeItem(item.id)} onRate={(r) => rateItem(item.id, r)} onTap={() => setSheetItemId(item.id)} />
            ) : (
              <div key={item.id} className="group relative overflow-hidden rounded-lg" onClick={(e) => { if ((e.nativeEvent as PointerEvent).pointerType === 'touch') setSheetItemId(item.id); }}>
                <button
                  onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}
                  className="absolute right-1 top-1 z-10 hidden group-hover:flex h-5 w-5 items-center justify-center rounded bg-black/15 text-white/30 hover:bg-black/30 hover:text-white/60 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    title={item.title}
                    className={`w-full object-cover ${tab.aspect}`}
                  />
                ) : (
                  <div className={`w-full bg-white/10 flex items-center justify-center ${tab.aspect}`}>
                    <tab.Icon className="h-8 w-8 text-white/20" />
                  </div>
                )}
                <StarRating savedRating={item.rating} onRate={(r) => rateItem(item.id, r)} />
              </div>
            )
          )}
        </div>
      )}

    </div>

      {/* Mobile bottom sheet — outside the clipped div so rounded-xl applies cleanly */}
      {sheetItem && (
        <ItemBottomSheet
          item={sheetItem}
          tab={tab}
          onRate={(r) => rateItem(sheetItem.id, r)}
          onRemove={() => removeItem(sheetItem.id)}
          onClose={() => setSheetItemId(null)}
        />
      )}
    </div>
  );
}

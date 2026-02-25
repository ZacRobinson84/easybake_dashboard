import { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, ChevronsUp, Lock, Loader2, Newspaper, Unlock } from 'lucide-react';
import { useAuth } from '../../AuthContext';

interface NewsItem {
  title: string;
  link: string;
  date: string;
  source: string;
  snippet: string;
}

const SOURCE_BADGE = 'bg-gray-500/65 text-white';

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function NewsWidget() {
  const { authFetch } = useAuth();
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [eyeOpen, setEyeOpen] = useState(false);

  const handleToggle = useCallback(() => {
    if (animating) return;
    setAnimating(true);

    if (!unlocked) {
      // Unlocking: open lock, then slide overlay up
      setEyeOpen(true);
      setTimeout(() => {
        setUnlocked(true);
        setAnimating(false);
      }, 500);
    } else {
      // Locking: slide overlay down, then close lock
      setUnlocked(false);
      setTimeout(() => {
        setEyeOpen(false);
        setTimeout(() => setAnimating(false), 300);
      }, 600);
    }
  }, [unlocked, animating]);

  useEffect(() => {
    authFetch('/api/news')
      .then((res) => {
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        return res.json();
      })
      .then((data: NewsItem[]) => setItems(data))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to fetch news'))
      .finally(() => setLoading(false));
  }, []);

  const containerStyle = { clipPath: 'polygon(0 0, calc(100% - 2.25rem) 0, 100% 2.25rem, 100% 100%, 0 100%)' };

  return (
    <div className="max-w-2xl rounded-xl bg-[#BB7044]/15 p-4 pb-0 md:pb-5" style={containerStyle}>
      <div className="mb-3 flex items-center gap-3">
        <div className="flex items-center gap-1.5 shrink-0">
          <Newspaper className="h-4 w-4 text-white/50" />
          <h2 className="text-base font-semibold text-white/70 font-nunito-black">News</h2>
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

      {!loading && !error && items.length === 0 && (
        <div className="py-10 text-center text-gray-500">No news articles available</div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="flex flex-col items-center">
          {/* Articles + overlay wrapper */}
          <div className="relative w-full overflow-hidden rounded-lg">
            <div className="max-h-96 overflow-y-auto space-y-1 pb-1 scrollbar-thin-brown">
              {items.map((item, i) => {
                const rowColors = [
                  'bg-amber-500/15 hover:bg-amber-500/45',
                  'bg-rose-500/15 hover:bg-rose-500/45',
                  'bg-sky-500/15 hover:bg-sky-500/45',
                  'bg-emerald-500/15 hover:bg-emerald-500/45',
                  'bg-indigo-500/15 hover:bg-indigo-500/45',
                ];
                return (
                <div
                  key={`${item.link}-${i}`}
                  className={`group/article relative block rounded-lg p-2 transition-colors cursor-pointer ${rowColors[i % rowColors.length]}`}
                  onClick={() => {
                    if (item.snippet) {
                      setExpandedIndex(expandedIndex === i ? null : i);
                    }
                  }}
                >
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute top-1.5 right-1.5 p-1 rounded-md bg-white/10 hover:bg-white/25 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                    aria-label="Open article"
                  >
                    <ArrowUpRight className="h-3.5 w-3.5 text-white/70" />
                  </a>
                  <div className="flex items-center gap-2 mb-0.5 pr-7">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${SOURCE_BADGE}`}>
                      {item.source}
                    </span>
                    <span className="text-[10px] text-white/70">{timeAgo(item.date)}</span>
                  </div>
                  <p className="text-sm text-white line-clamp-2 pr-7">{item.title}</p>
                  {item.snippet && (
                    <p className={`text-xs text-white/60 line-clamp-1 mt-0.5 grid transition-[grid-template-rows] duration-200 overflow-hidden ${expandedIndex === i ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}><span className="min-h-0">{item.snippet}</span></p>
                  )}
                </div>
                );
              })}
            </div>

            {/* Lock overlay — mobile only, blocks interaction so touch passes through to page scroll */}
            <div
              className={`md:hidden absolute inset-0 rounded-lg overflow-hidden transition-transform duration-300 ease-in-out ${unlocked ? '-translate-y-full' : 'translate-y-0'}`}
              style={{ pointerEvents: unlocked ? 'none' : 'auto' }}
            >
              <div className="absolute inset-0 bg-white/35" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[38%] z-10 rounded-full bg-[#BB7044]/30 p-5">
                {eyeOpen
                  ? <Unlock className="h-20 w-20 text-white" />
                  : <Lock className="h-20 w-20 text-white" />
                }
              </div>
            </div>
          </div>

          {/* Chevron toggle button — mobile only */}
          <button
            onClick={handleToggle}
            className="md:hidden my-2 p-1 rounded-lg border-2 border-white/40 hover:border-white/60 transition-colors"
            aria-label={unlocked ? 'Lock articles' : 'Unlock articles'}
          >
            <ChevronsUp className={`h-6 w-6 text-white/70 transition-transform duration-300 ${unlocked ? 'rotate-180' : ''}`} />
          </button>
        </div>
      )}
    </div>
  );
}

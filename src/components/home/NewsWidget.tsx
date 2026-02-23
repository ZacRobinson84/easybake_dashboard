import { useEffect, useState } from 'react';
import { Loader2, Newspaper } from 'lucide-react';
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

  useEffect(() => {
    authFetch('/api/news')
      .then((res) => {
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        return res.json();
      })
      .then((data: NewsItem[]) => setItems(data.slice(0, 20)))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to fetch news'))
      .finally(() => setLoading(false));
  }, []);

  const containerStyle = { clipPath: 'polygon(0 0, calc(100% - 2.25rem) 0, 100% 2.25rem, 100% 100%, 0 100%)' };

  return (
    <div className="max-w-2xl rounded-xl bg-[#BB7044]/15 p-4" style={containerStyle}>
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
        <div className="max-h-96 overflow-y-auto space-y-1">
          {items.map((item, i) => {
            const rowColors = [
              'bg-amber-500/15 hover:bg-amber-500/45',
              'bg-rose-500/15 hover:bg-rose-500/45',
              'bg-sky-500/15 hover:bg-sky-500/45',
              'bg-emerald-500/15 hover:bg-emerald-500/45',
              'bg-indigo-500/15 hover:bg-indigo-500/45',
            ];
            return (
            <a
              key={`${item.link}-${i}`}
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className={`group/article block rounded-lg p-2 transition-colors ${rowColors[i % rowColors.length]}`}
              onClick={(e) => {
                // On touch devices: first tap expands snippet, second tap follows link
                if ('ontouchstart' in window && item.snippet) {
                  if (expandedIndex !== i) {
                    e.preventDefault();
                    setExpandedIndex(i);
                  }
                }
              }}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${SOURCE_BADGE}`}>
                  {item.source}
                </span>
                <span className="text-[10px] text-white/70">{timeAgo(item.date)}</span>
              </div>
              <p className="text-sm text-white line-clamp-2">{item.title}</p>
              {item.snippet && (
                <p className={`text-xs text-white/60 line-clamp-1 mt-0.5 grid transition-[grid-template-rows] duration-200 overflow-hidden ${expandedIndex === i ? 'grid-rows-[1fr]' : 'grid-rows-[0fr] md:delay-400 md:group-hover/article:grid-rows-[1fr]'}`}><span className="min-h-0">{item.snippet}</span></p>
              )}
            </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

import RSSParser from 'rss-parser';
import type { NewsItem } from './types.ts';

const RSS_FEEDS = [
  { url: 'https://hnrss.org/frontpage', name: 'Hacker News' },
  { url: 'https://www.theverge.com/rss/index.xml', name: 'The Verge' },
  { url: 'https://feeds.arstechnica.com/arstechnica/index', name: 'Ars Technica' },
  { url: 'https://mkaku.org/home/feed/', name: 'Michio Kaku' },
  { url: 'https://kotaku.com/rss', name: 'Kotaku' },
  { url: 'https://www.cbc.ca/webfeed/rss/rss-topstories', name: 'CBC Top Stories' },
  { url: 'https://www.cbc.ca/webfeed/rss/rss-sports-nba', name: 'CBC NBA' },
  { url: 'https://www.cbc.ca/webfeed/rss/rss-canada-novascotia', name: 'CBC Nova Scotia' },
  { url: 'https://www.cbc.ca/webfeed/rss/rss-canada', name: 'CBC Canada' },
  { url: 'https://www.cbc.ca/webfeed/rss/rss-technology', name: 'CBC Tech' },
  { url: 'https://www.cbc.ca/webfeed/rss/rss-politics', name: 'CBC Politics' },
];

const parser = new RSSParser({ timeout: 10000 });

let newsCache: { data: NewsItem[]; timestamp: number } | null = null;
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ').trim();
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + '…';
}

export async function fetchNews(): Promise<NewsItem[]> {
  if (newsCache && Date.now() - newsCache.timestamp < CACHE_TTL) {
    return newsCache.data;
  }

  console.log('Fetching RSS feeds...');
  const results = await Promise.allSettled(
    RSS_FEEDS.map(async (feed) => {
      const parsed = await parser.parseURL(feed.url);
      return (parsed.items || []).map((item): NewsItem => {
        let snippet = '';
        if (item.contentSnippet) {
          snippet = item.contentSnippet;
        } else if (item.content) {
          snippet = stripHtml(item.content);
        } else if (item.summary) {
          snippet = stripHtml(item.summary);
        }
        snippet = truncate(snippet.replace(/\s+/g, ' ').trim(), 200);

        return {
          title: item.title || 'Untitled',
          link: item.link || '',
          date: item.isoDate || item.pubDate || new Date().toISOString(),
          source: feed.name,
          snippet,
        };
      });
    }),
  );

  const items: NewsItem[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      items.push(...result.value);
    } else {
      console.error('RSS feed fetch failed:', result.reason);
    }
  }

  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  newsCache = { data: items, timestamp: Date.now() };
  return items;
}

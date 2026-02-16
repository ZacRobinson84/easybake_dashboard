import type { GameRelease, SteamReviewSummary } from './types.ts';

export async function fetchSteamReviews(steamAppId: string): Promise<SteamReviewSummary | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(
      `https://store.steampowered.com/appreviews/${steamAppId}?json=1&language=all&purchase_type=all`,
      { signal: controller.signal },
    );
    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = (await res.json()) as {
      success: number;
      query_summary?: {
        total_positive: number;
        total_negative: number;
        total_reviews: number;
        review_score_desc: string;
      };
    };

    if (!data.success || !data.query_summary) return null;

    const qs = data.query_summary;
    return {
      totalPositive: qs.total_positive,
      totalNegative: qs.total_negative,
      totalReviews: qs.total_reviews,
      reviewScoreDesc: qs.review_score_desc,
    };
  } catch {
    return null;
  }
}

const PC_PLATFORMS = ['pc (microsoft windows)', 'mac', 'linux'];

function isPcGame(game: GameRelease): boolean {
  return game.platforms.some((p) => PC_PLATFORMS.includes(p.toLowerCase()));
}

export async function searchSteamAppId(gameName: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(
      `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(gameName)}&l=english&cc=US`,
      { signal: controller.signal },
    );
    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = (await res.json()) as {
      total: number;
      items?: { id: number; name: string }[];
    };

    if (!data.items?.length) return null;

    // Only accept an exact (case-insensitive) name match
    const match = data.items.find((item) => item.name.toLowerCase() === gameName.toLowerCase());
    return match ? String(match.id) : String(data.items[0].id);
  } catch {
    return null;
  }
}

export async function backfillSteamAppIds(games: GameRelease[]): Promise<void> {
  const needsSearch = games.filter((g) => g.steamAppId === null && isPcGame(g));
  if (needsSearch.length === 0) return;

  const results = await Promise.allSettled(
    needsSearch.map(async (g) => {
      const appId = await searchSteamAppId(g.name);
      return { game: g, appId };
    }),
  );

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.appId) {
      result.value.game.steamAppId = result.value.appId;
    }
  }
}

export async function fetchSteamDescription(steamAppId: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(
      `https://store.steampowered.com/api/appdetails?appids=${steamAppId}`,
      { signal: controller.signal },
    );
    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = (await res.json()) as Record<string, { success: boolean; data?: { short_description?: string } }>;
    const entry = data[steamAppId];
    if (!entry?.success || !entry.data?.short_description) return null;

    return entry.data.short_description;
  } catch {
    return null;
  }
}

export async function fetchAllSteamDescriptions(games: GameRelease[]): Promise<Map<string, string>> {
  const steamGames = games.filter((g) => g.steamAppId !== null);
  const results = await Promise.allSettled(
    steamGames.map(async (g) => {
      const description = await fetchSteamDescription(g.steamAppId!);
      return { steamAppId: g.steamAppId!, description };
    }),
  );

  const map = new Map<string, string>();
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.description) {
      map.set(result.value.steamAppId, result.value.description);
    }
  }
  return map;
}

export async function fetchAllSteamReviews(games: GameRelease[]): Promise<Map<string, SteamReviewSummary>> {
  const steamGames = games.filter((g) => g.steamAppId !== null);
  const results = await Promise.allSettled(
    steamGames.map(async (g) => {
      const reviews = await fetchSteamReviews(g.steamAppId!);
      return { steamAppId: g.steamAppId!, reviews };
    }),
  );

  const map = new Map<string, SteamReviewSummary>();
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.reviews) {
      map.set(result.value.steamAppId, result.value.reviews);
    }
  }
  return map;
}

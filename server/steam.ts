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

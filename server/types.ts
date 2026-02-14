export interface IGDBExternalGame {
  category: number;
  uid: string;
}

export interface IGDBCover {
  url: string;
}

export interface IGDBPlatform {
  name: string;
}

export interface IGDBGame {
  id: number;
  name: string;
  cover?: IGDBCover;
  platforms?: IGDBPlatform[];
  external_games?: IGDBExternalGame[];
}

export interface GameRelease {
  id: number;
  name: string;
  coverUrl: string | null;
  platforms: string[];
  steamAppId: string | null;
}

export interface SteamReviewSummary {
  totalPositive: number;
  totalNegative: number;
  totalReviews: number;
  reviewScoreDesc: string;
}

export interface GameReleaseWithReviews extends GameRelease {
  steamReviews: SteamReviewSummary | null;
}
